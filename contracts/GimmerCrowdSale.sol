pragma solidity ^0.4.17;

import '../submodules/zeppelin-gimmer/contracts/crowdsale/LimitedTokenCrowdSale.sol';
import '../submodules/zeppelin-gimmer/contracts/ownership/Ownable.sol';

/**
* @title Gimmer Crowd Sale
* @dev Gimmer Crowd Sale contract
*/
contract GimmerCrowdSale is LimitedTokenCrowdSale, Ownable {
    /**
    * @dev All the stages the contract has
    */
    enum Stages {
        Deployment,
        PreSale,
        Sale,
        AfterSale
    }

    // The current stage of the contract - starting at Deployment
    Stages public currentStage;

    // The current token pricing phase
    uint256 public currentTokenPricePhase;

    // Date to end the presale (cached from tokenDates[0])
    uint256 public preSaleEndTime;

    // Beginning date to the withdrawal (cached from tokenDates[last])
    uint256 public startWithdrawalTime;

    // An array holding the 5 token prices for the 5 crowdsale pricing phases
    uint256[5] public tokenPrices;
    // Same but for the dates
    uint256[5] public tokenDates;

    // Maximum amount that can be sold during the Pre Sale period
    uint256 public preSaleLimit;

    // Address that manages approval of KYC
    address public kycManager;

    function GimmerCrowdSale(uint256[5] _saleTokenPrices, uint256[5] _saleDates,
                                uint256 _minTokenAcquisition, address _tokenAddress, 
                                uint256 _preSaleLimit, uint256 _weiSaleLimitWithoutKYC)
                                LimitedTokenCrowdSale(_tokenAddress, _minTokenAcquisition, 
                                                        _weiSaleLimitWithoutKYC, msg.sender) public {
        require(_minTokenAcquisition > 0);
        require(_tokenAddress != address(0));
        require(_preSaleLimit > 0);
        require(_weiSaleLimitWithoutKYC > 0);

        preSaleEndTime = _saleDates[0];                                                     
        startWithdrawalTime = _saleDates[_saleTokenPrices.length - 1];
        
        tokenPrices = _saleTokenPrices;
        tokenDates = _saleDates;
        preSaleLimit = _preSaleLimit;
        kycManager = msg.sender;

        currentStage = Stages.Deployment;
        currentTokenPricePhase = 0;
    }

    /**
    * @dev Returns the address of the account that is able to flag supporters' KYC
    * @return an address representing the account that manages KYC approval
    */
    function getKYCManager() public constant returns (address) {
        return kycManager;
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
    * @dev Returns the current token price based on the current sale phase
    * @return An uint256 representing the current token price
    */
    function getTokenPrice() public constant returns (uint256) {
        return tokenPrices[getCurrentTokenPricePhase()];
    }

    /**
    * @dev Returns the current token price based on the current sale phase
    * (this is called by LimitedTokenCrowdsale to determine the current pricing of the tokens)
    * @return An uint256 representing the current token price
    */
    function internalGetTokenPrice() internal constant returns (uint256) {
        return tokenPrices[currentTokenPricePhase];
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
    * @dev returns the current token sale pricing index
    * @return an uint256 representing the current pricing phase
    */
    function getCurrentTokenPricePhase() constant public returns (uint256) {
        for (uint256 i = 0; i < tokenDates.length; i++) {
            if (now < tokenDates[i]) {
                return i;
            }
        }
        return tokenDates.length - 1;
    }

    /**
    * @dev Updates the current token sale phase the contract is
    * based on the current date
    */
    function updateTokenPhase() internal {
        currentTokenPricePhase = getCurrentTokenPricePhase();
    }

    /**
    * @dev Updates the current stage of the contract, while also failing
    * to progress if we are still in the Deployment stage
    */
    function updateStage() internal {
        require(!atStage(Stages.Deployment));
        
        if (currentStage == Stages.PreSale &&
            now >= preSaleEndTime) {
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
    * @dev Receives Wei and re-routes the payment
    * to the correct function based on the current contract stage
    */
    function () public payable {
        buy();
    }

    /**
    * @dev Receives Wei and re-routes the payment
    * to the correct function based on the current contract stage
    */
    function buy() public payable {
        // this will update the stage or revert if we are on deployment
        updateStage();
        updateTokenPhase();

        if (currentStage == Stages.PreSale) {
            require((weiRaised.add(msg.value)) <= preSaleLimit);
            // presale has a hardcap of Wei that can be sold
            super.internalBuyToken(msg.value, msg.sender);
        } else if (currentStage == Stages.Sale) {
            // sale has no cap, as long as we have tokens to transfer later we can sell them
            super.internalBuyToken(msg.value, msg.sender);
        } else {
            // dont allow the user to give us Wei outside of the campaign
            revert();
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
    * @dev Function called by the owner to withdraw all Wei inside the contract,
    * locked for execution only at the AfterSale
    */
    function withdrawFunds() public onlyOwner {
        updateStage();
        require(atStage(Stages.AfterSale));
        internalWithdrawFunds();
    }

    /**
    * @dev Allows the KYC Manager (by default the creator of the contract) to approve an user's KYC
    */
    function approveUserKYC(address user) public {
        require(msg.sender == kycManager);
        internalApproveUserKYC(user);
    }

    /**
    * @dev Allow the owner to change the limit allowed for sales with no KYC
    * (future proofing against KYC possible updates)
    */
    function updateSaleLimitWithoutKYC(uint256 _weiSaleLimitWithoutKYC) public onlyOwner {
        weiSaleLimitWithoutKYC = _weiSaleLimitWithoutKYC;
    }

    /**
    * @dev Changes the KYC manager to a new address
    * @param _newKYCManager the new address for the KYC Manager
    */
    function setKYCManager(address _newKYCManager) public onlyOwner {
        require(_newKYCManager != address(0));
        kycManager = _newKYCManager;
    }
}