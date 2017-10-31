pragma solidity ^0.4.17;

import '../submodules/zeppelin-gimmer/contracts/crowdsale/LimitedTokenDirectCrowdsale.sol';
import '../submodules/zeppelin-gimmer/contracts/ownership/Ownable.sol';

/**
* @title Gimmer Crowd Sale
* @dev Gimmer Crowd Sale contract
*/
contract GimmerCrowdSale is LimitedTokenDirectCrowdsale, Ownable {
    /**
    * @dev All the stages the contract has
    */
    enum Stages {
        Deployment,
        PreSale,
        Sale,
        AfterSale
    }

    // we start at Deployment stage
    Stages public currentStage;

    // beginning date to the withdrawal
    uint256 public startWithdrawalTime;

    // an array holding the 5 token prices for the 5 weeks of crowdsale
    uint256[5] public tokenPrices;
    // same but for the dates
    uint256[5] public tokenDates;

    // price after the sale
    uint256 public afterSaleTokenPrice;

    // maximum amount that can be sold during the Pre Sale period
    uint256 public preSaleLimit;

    function GimmerCrowdSale(uint256[5] _saleTokenPrices, uint256[5] _saleDates,
                                uint256 _minTokenAcquisition, address _tokenAddress, 
                                uint256 _preSaleLimit, uint256 _weiSaleLimitWithoutKYC)
                                LimitedTokenDirectCrowdsale(_tokenAddress, _minTokenAcquisition, 
                                                        _weiSaleLimitWithoutKYC, msg.sender) public {
        startWithdrawalTime = _saleDates[_saleTokenPrices.length - 1];
        // start the after sale price as the last value in the prices
        afterSaleTokenPrice = _saleTokenPrices[_saleTokenPrices.length - 1];
        
        tokenPrices = _saleTokenPrices;
        tokenDates = _saleDates;
        preSaleLimit = _preSaleLimit;

        currentStage = Stages.Deployment;

        // this constructor initializes the LimitedTokenCrowdsale the creator 
        // of this contract as the wallet that will receive the crowdsale funds
    }

    /**
    * @dev Notifies the contracts to go out of Deployment stage and into PreSale stage.
    * Only executs if the contract knows it has tokens to sell 
    */
    function deploy() public onlyOwner {
        require(atStage(Stages.Deployment));
        // need to have tokens in contract, else something went wrong
        require(token.balanceOf(this) > 0); 
        currentStage = Stages.PreSale;
    }

    /**
    * @dev Sets the price used for the token in the After Sale stage
    * @param newPrice price to sell the token at
    */
    function setAfterSaleTokenPrice(uint256 newPrice) public onlyOwner {
        require(newPrice > 0);
        afterSaleTokenPrice = newPrice;
    }

    /**
    * @dev returns the token price of the direct acquisition of tokens
    * @return An uint256 representing the token price of direct acquisition
    */
    function getDirectTokenPrice() public constant returns (uint256) {
        return afterSaleTokenPrice;
    }

    /**
    * @dev Returns the current token price based on the current sale phase
    * @return An uint256 representing the current token price
    */
    function getTokenPrice() public constant returns (uint256) {
        // uint8 as we will only have 5 dates
        bool hasEnded = true;
        uint256 index = tokenDates.length - 1; // default to the last price (highest)

        // look if we are transactioning before any token progress dates,
        // so the price should actually be cheaper
        for (uint256 i = 0; i < tokenDates.length; i++) {
            if (now < tokenDates[i]) {
                hasEnded = false;
                index = i;
                break;
            }
        }

        if (hasEnded) {
            return afterSaleTokenPrice;
        } else {
            return tokenPrices[index];
        }
    }
    
    /**
    * @dev Returns the current phase of sale the contract is in
    * @return An uint256 representing the current token sale phase
    */
    function getTokenPhase() public constant returns (uint256) {
        for (uint256 i = 0; i < tokenDates.length; i++) {
            if (now < tokenDates[i]) {
                return i;
                break;
            }
        }
        return tokenDates.length - 1;
    }

    /**
    * @dev Receives Wei and re-routes the payment
    * to the correct function based on the current contract stage
    */
    function () public payable {
        buy();
    }

    function buy() public payable {
        // this will update the stage or revert if we are on deployment
        updateStage(); 

        if (currentStage == Stages.PreSale) {
            require((weiRaised.add(msg.value)) <= preSaleLimit);
            // presale has a hardcap of Wei that can be sold
            super.internalBuyToken(msg.value, msg.sender);
        } else if (currentStage == Stages.Sale) {
            // sale has no cap, as long as we have tokens to transfer later we can sell them
            super.internalBuyToken(msg.value, msg.sender);
        } else if (currentStage == Stages.AfterSale) {
            // as long as there are tokens left in the contract's balance,
            // let users buy based on an after sale price
            super.internalBuyTokenDirect(msg.value, msg.sender);
        }
    }

    /**
    * @dev Overrides withdrawToken, allowing withdrawals only after the start date
    * for withdrawals has passed
    */
    function withdrawTokens() public {
        updateStage();
        require(atStage(Stages.AfterSale));
        super.withdrawTokens();
    }

    /**
    * @dev Gets the amount that is locked from returning to the user
    * because the users have not withdrawn yet
    * @return an uint256 holding the amount left to pay to users
    */
    function getAmountLeftToWidthdraw() public constant returns (uint256) {
        return tokensToWithdraw;
    }

    /**
    * @dev Withdrawal method for returning tokens to owner wallet
    * Doesn't allow withdrawal if the value exceeds what
    * the contract still has to pay in withdrawals
    * @param amount the amount of tokens to send to the owner
    */
    function returnTokens(uint256 amount) public onlyOwner {
        updateStage();
        require(atStage(Stages.AfterSale));
        uint256 balance = token.balanceOf(this);

        // remove what the users havent withdrawn yet
        uint256 remaining = balance.sub(tokensToWithdraw);
        require(remaining >= amount);

        if (!token.transfer(owner, amount)) {
            revert();
        }
    }

    /**
    * @dev Allows the owner to force update the current stage of the contract
    */
    function forceUpdateStage() public onlyOwner {
        updateStage();
    }

    /**
    * @dev Updates the current stage of the contract, while also failing
    * to progress if we are still in the Deployment stage
    */
    function updateStage() internal {
        require(!atStage(Stages.Deployment));
        
        if (currentStage == Stages.PreSale &&
            now >= tokenDates[0]) {
            currentStage = Stages.Sale;
        } 
        // dont use else if here - if the contract stagnated
        // we might be changing stage TWICE in the same update!

        if (currentStage == Stages.Sale &&
            now >= startWithdrawalTime) {
            currentStage = Stages.AfterSale;
        }
    }

    /**
    * @dev If the contract is at a stage
    * @param _stage the stage to compare to the current one
    * @return a boolean representing if the contract is at the specific stage
    */
    function atStage(Stages _stage) internal constant returns(bool) {
        return currentStage == _stage;
    }

    /**
    * @dev returns the stage the contract is currently in
    * @return an uint256 representing the current stage the contract is in
    */
    function getCurrentStage() constant public returns (Stages) {
        return currentStage;
    }

    /**
    * @dev Function called by the owner to withdraw all Wei inside the contract,
    * locked for execution only at the AfterSale
    */
    function withdrawFunds() public onlyOwner {
        updateStage();
        require(atStage(Stages.AfterSale));
        internalWithdrawFunds();
    }

    /**
    * @dev Allows the owner of the contract to approve an user's KYC
    */
    function approveUserKYC(address user) public onlyOwner {
        internalApproveUserKYC(user);
    }

    /**
    * @dev Allow the owner to change the limit allowed for sales with no KYC
    * (future proofing against KYC possible updates)
    */
    function updateSaleLimitWithoutKYC(uint256 _weiSaleLimitWithoutKYC) public onlyOwner {
        weiSaleLimitWithoutKYC = _weiSaleLimitWithoutKYC;
    }
}