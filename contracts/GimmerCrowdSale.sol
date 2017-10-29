pragma solidity ^0.4.17;

import '../submodules/zeppelin-gimmer/contracts/token/ERC20Basic.sol';
import '../submodules/zeppelin-gimmer/contracts/crowdsale/LimitedTokenCrowdSale.sol';
import '../submodules/zeppelin-gimmer/contracts/ownership/Ownable.sol';
import './GimmerToken.sol';

// The Gimmer Crowd Sale: A Limited Token Crowd Sale, 
// owned by the wallet that created it
contract GimmerCrowdSale is LimitedTokenCrowdSale, Ownable {
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
    uint256[] public tokenPrices;
    // same but for the dates
    uint256[] public tokenDates;

    // price after the sale
    uint256 public afterSaleTokenPrice;

    // maximum amount that can be sold during the Pre Sale period
    uint256 public preSaleLimit;

    function GimmerCrowdSale(uint256[] _saleTokenPrices, uint256[] _saleDates,
                                uint256 _minTokenAcquisition, address _tokenAddress, 
                                uint256 _preSaleLimit, uint256 _saleLimitWithoutKYC)
                                LimitedTokenCrowdSale(_saleTokenPrices[0],  _saleDates[0], 
                                                        _tokenAddress, _minTokenAcquisition, 
                                                        _saleLimitWithoutKYC, msg.sender) public {
        startWithdrawalTime = _saleDates[_saleTokenPrices.length - 1];
        // start the after sale price as the last value in the prices
        afterSaleTokenPrice = _saleTokenPrices[_saleTokenPrices.length - 1];
        
        tokenPrices = _saleTokenPrices;
        tokenDates = _saleDates;
        preSaleLimit = _preSaleLimit;

        currentStage = Stages.Deployment;

        // this constructor initializes the LimitedTokenCrowdsale with the 
        // first price, first week date, and the creator of this contract 
        // as the wallet that will receive the crowdsale funds
    }
    
    // only allow the owner to execute
    function updateSaleLimitWithoutKYC(uint256 _saleLimitWithoutKYC) public {
        super.updateSaleLimitWithoutKYC(_saleLimitWithoutKYC);
    }

    // only allow the owner to execute
    function approveUserKYC(address user) public onlyOwner {
        super.approveUserKYC(user);
    }

    // notifies the contracts to go out of Deployment stage and into PreSale stage,
    // marking that everything is ready for sale (contract owns enough tokens to sell)
    function deploy() public onlyOwner {
        require(atStage(Stages.Deployment));
        // need to have tokens in contract, else something went wrong
        require(token.balanceOf(this) > 0); 
        currentStage = Stages.PreSale;
    }

    // Sets the price for the Tokens to be sold at after
    // the token sale ends
    function setAfterSaleTokenPrice(uint256 newPrice) public onlyOwner {
        require(newPrice > 0);
        afterSaleTokenPrice = newPrice;
    }

    // Returns the current token price based on the current sale phase
    function getDirectTokenPrice() public constant returns (uint256) {
        return afterSaleTokenPrice;
    }

    // Returns the current token price based on the current sale phase
    function getWithdrawTokenPrice() public constant returns (uint256) {
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

    function () public payable {
        // block the transaction if the sale hasn't started yet
        require(now > saleStartDate);

        updateStage();
        if (currentStage == Stages.PreSale) {
            require((weiRaised + msg.value) < preSaleLimit);
            super.buyTokenWithdraw();
        } else if (currentStage == Stages.Sale) {
            super.buyTokenWithdraw();
        } else if (currentStage == Stages.AfterSale) {
            // send the funds directly to the user after the sale
            super.buyTokenDirect();
        }
    }

    /* 
    * Override the buyTokenWithdraw to only allow withdraw
    * logic sales to happen during the token sale - users can only
    * withdraw after the fixed time
    */
    function buyTokenWithdraw() public payable {
        updateStage();
        if (atStage(Stages.PreSale)) {
            require((weiRaised + msg.value) < preSaleLimit);
        } else if (!atStage(Stages.Sale)) {
            revert();
        }
        super.buyTokenWithdraw();
    }

    /*
    * Now that users can withdraw directly, we make a direct sale
    */
    function buyTokenDirect() public payable {
        updateStage();
        require(atStage(Stages.AfterSale));
        super.buyTokenDirect();
    }
    
    // Overrides withdrawToken, allowing withdrawals only after the start date
    // for withdrawals has passed
    function withdrawTokens() public {
        updateStage();
        require(atStage(Stages.AfterSale));//restrict from withdrawing on presale
        super.withdrawTokens();
    }

    // Allow calling withdrawFunds only by the owner
    function withdrawFunds() public onlyOwner {
        updateStage();
        require(atStage(Stages.AfterSale));
        super.withdrawFunds();
    }

    // Returns the tokens to their owner, after the campaign withdrawal is allowed:
    // so the main ICO is able to get the tokens back if there's something there
    function returnTokens(uint256 amount) public onlyOwner {
        updateStage();
        require(atStage(Stages.AfterSale));
        uint256 balance = token.balanceOf(this);

        // remove what the users havent withdrawn yet
        uint256 remaining = balance.sub(tokensToWithdraw);
        require(remaining > amount);

        if (!token.transfer(owner, amount)) {
            revert();
        }
    }

    function updateStage() internal {
        require(!atStage(Stages.Deployment));
        
        if (currentStage == Stages.PreSale &&
            now >= tokenDates[1]) {
            currentStage = Stages.Sale;
        } 
        if (currentStage == Stages.Sale &&
            now >= startWithdrawalTime) {
            currentStage = Stages.AfterSale;
        }
    }

    function atStage(Stages _stage) internal constant returns(bool) {
        return currentStage == _stage;
    }

    function getCurrentStage() constant public returns (Stages) {
        return currentStage;
    }
}