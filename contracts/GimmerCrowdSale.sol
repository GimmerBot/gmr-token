pragma solidity ^0.4.17;

import '../submodules/zeppelin-solidity/contracts/crowdsale/Crowdsale.sol';
import '../submodules/zeppelin-solidity/contracts/ownership/Ownable.sol';
import './GimmerToken.sol';

/**
* @title Gimmer Crowd Sale
* @dev Gimmer Crowd Sale contract
*/
contract GimmerCrowdSale is Crowdsale, Ownable {
    /**
    * @dev All the stages the contract has
    */
    enum Stages {
        Deployment,
        PreSale,
        Sale,
        FinishedSale
    }

    /**
    * Supporter structure, which allows us to track
    * how much the user has bought so far, and if he's flagged as known
    */
    struct Supporter {
        // the total amount of Wei this address has sent to this contract
        uint256 weiSpent;
        // if the user has KYC flagged
        bool hasKYC;
    }

    // Mapping with all the campaign supporters
    mapping(address => Supporter) public supportersMap;

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
    uint256 public preSaleTokenCap;

    // Address that manages approval of KYC
    address public kycManager;

    // The limit of Wei that someone can spend on this contract before needing KYC approval
    uint256 public saleWeiLimitWithoutKYC;

    // Amount of total tokens sold
    uint256 public tokensSold;

    // The maximum amount of tokens that can be sold during the entire sale
    uint256 public tokenSaleCap;

    // The minimum amount of tokens a user is allowed to buy
    uint256 public minTokenTransaction;

    function GimmerCrowdSale(uint256 startDate, uint256[5] _saleTokenPrices, 
                                uint256[5] _saleDates, uint256 _saleWeiLimitWithoutKYC,
                                uint256 _minTokenTransaction, uint256 _preSaleTokenCap, 
                                uint256 _tokenSaleCap)
                                Crowdsale(startDate, _saleDates[_saleDates.length - 1],
                                            _saleTokenPrices[0], msg.sender) public {
        require(_saleWeiLimitWithoutKYC > 0);
        require(_minTokenTransaction > 0);
        require(_preSaleTokenCap > 0);
        require(_tokenSaleCap > 0);

        // copy args
        tokenPrices = _saleTokenPrices;
        tokenDates = _saleDates;
        minTokenTransaction = _minTokenTransaction;
        preSaleTokenCap = _preSaleTokenCap;
        saleWeiLimitWithoutKYC = _saleWeiLimitWithoutKYC;
        tokenSaleCap = _tokenSaleCap;

        // initialize the contract
        preSaleEndTime = _saleDates[0];                                                     
        startWithdrawalTime = _saleDates[_saleDates.length - 1];

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
    * @dev Returns the current token price based on the current sale phase
    * @return An uint256 representing the current token price
    */
    function getTokenPrice() public constant returns (uint256) {
        return tokenPrices[getCurrentTokenPricePhase()];
    }

    /**
    * @dev returns the stage the contract is currently in
    * @return an uint256 representing the current stage the contract is in
    */
    function getCurrentStage() public constant returns (Stages) {
        return currentStage;
    }

    /**
    * @dev returns the current token sale pricing index
    * @return an uint256 representing the current pricing phase
    */
    function getCurrentTokenPricePhase() public constant returns (uint256) {
        for (uint256 i = 0; i < tokenDates.length; i++) {
            if (now < tokenDates[i]) {
                return i;
            }
        }
        return tokenDates.length - 1;
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
        if (currentStage == Stages.Deployment &&
            now >= startTime) {
            currentStage = Stages.PreSale;
        }
        if (currentStage == Stages.PreSale &&
            now >= preSaleEndTime) {
            currentStage = Stages.Sale;
        } 
        if (currentStage == Stages.Sale &&
            now >= startWithdrawalTime) {
            currentStage = Stages.FinishedSale;
        }
    }

    /**
    * @dev Receives Wei
    */
    function () public payable {
        buy();
    }

    /**
    * @dev Receives Wei and re-routes the payment
    * to the correct function based on the current contract stage
    */
    function buy() public payable {
        buyTokens(msg.sender);
    }

    function buyTokens(address beneficiary) public payable {
        require(beneficiary != address(0));
        require(validPurchase());

        updateStage();
        updateTokenPhase();

        require(atStage(Stages.Sale));

        // calculate token amount to be created
        uint256 currentTokenPrice = tokenPrices[currentTokenPricePhase];
        uint256 weiAmount = msg.value;
        uint256 tokens = weiAmount.div(currentTokenPrice);
        require(tokens > minTokenTransaction);
        
        uint256 totalTokensSold = tokensSold.add(tokens);

        if (atStage(Stages.PreSale)) {
            // presale has a hardcap of Wei that can be sold
            require(totalTokensSold <= preSaleTokenCap);
        } 
        require(totalTokensSold <= tokenSaleCap);

        Supporter storage sup = supportersMap[beneficiary];
        uint256 totalWei = sup.weiSpent.add(weiAmount);
        if (!sup.hasKYC && totalWei > saleWeiLimitWithoutKYC) {
            revert();
        }
        // add to the total to be withdrawn
        sup.weiSpent = totalWei;

        // update state
        weiRaised = weiRaised.add(weiAmount);
        tokensSold = totalTokensSold;

        token.mint(beneficiary, tokens);
        TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

        forwardFunds();
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
    * @dev Allows the owner to force update the current stage of the contract
    */
    function forceUpdateStage() public onlyOwner {
        updateStage();
    }

    /**
    * @dev Approves an User's KYC, unfreezing any Wei/Tokens
    * to be withdrawn
    * @param user The user to flag as known
    */
    function approveUserKYC(address user) public {
        require(msg.sender == kycManager);

        Supporter storage sup = supportersMap[user];
        sup.hasKYC = true;
    }

    /**
    * @dev Allow the owner to change the limit allowed for sales with no KYC
    * (future proofing against KYC possible updates)
    * @param _saleWeiLimitWithoutKYC The value to change the no-KYC sale limit to
    */
    function updateSaleLimitWithoutKYC(uint256 _saleWeiLimitWithoutKYC) public onlyOwner {
        saleWeiLimitWithoutKYC = _saleWeiLimitWithoutKYC;
    }

    /**
    * @dev Changes the KYC manager to a new address
    * @param _newKYCManager The new address that will be managing KYC approval
    */
    function setKYCManager(address _newKYCManager) public onlyOwner {
        require(_newKYCManager != address(0));
        kycManager = _newKYCManager;
    }
}