pragma solidity ^0.4.17;

import '../submodules/zeppelin-solidity/contracts/math/SafeMath.sol';
import './GimmerToken.sol';

/**
* @title Gimmer Crowd Sale
* @dev Gimmer Crowd Sale contract
*/
contract GimmerCrowdSale is Ownable {
    using SafeMath for uint256;

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
    * @dev Supporter structure, which allows us to track
    * how much the user has bought so far, and if he's flagged as known
    */
    struct Supporter {
        // the total amount of Wei this address has sent to this contract
        uint256 weiSpent;
        // if the user has KYC flagged
        bool hasKYC;
    }

    /// Crowdsale Contract
    // The token being sold
    GimmerToken public token;
    // start and end timestamps where investments are allowed (both inclusive)
    uint256 public startTime;
    //uint256 public endTime;
    // address where funds are collected
    address public wallet;
    // amount of raised money in wei
    uint256 public weiRaised;
    
    /**
    * event for token purchase logging
    * @param purchaser who paid for the tokens
    * @param beneficiary who got the tokens
    * @param value weis paid for purchase
    * @param amount amount of tokens purchased
    */
    event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);


    // Mapping with all the campaign supporters
    mapping(address => Supporter) public supportersMap;

    // The current stage of the contract - starting at Deployment
    Stages public currentStage;

    // The current token pricing phase
    uint256 public currentTokenPricePhase;

    // Date to end the presale (cached from tokenDates[0])
    uint256 public preSaleEndTime;

    // PreSale bonus pricing for buyers above PRE_SALE_BONUS_WEI_MIN
    uint256 public preSaleBonusPrice;

    // Beginning date to the withdrawal (cached from tokenDates[last])
    uint256 public startWithdrawalTime;

    // An array holding the 5 token prices for the 5 crowdsale pricing phases
    uint256[5] public tokenPrices;
    // Same but for the dates
    uint256[5] public tokenDates;

    // Address that manages approval of KYC
    address public kycManager;

    // The limit of Wei that someone can spend on this contract before needing KYC approval
    uint256 public saleWeiLimitWithoutKYC;

    // Amount of total tokens sold
    uint256 public tokensSold;

    // Wallet to generate tokens and move them to
    address public freezeWallet;
    // The total amount of tokens frozen when this contract ended (only happens if the lower bound limit has not been reached)
    uint256 public totalTokensFrozen;

    // Maximum amount that can be sold during the Pre Sale period
    uint256 public constant PRE_SALE_TOKEN_CAP = 10000 * 10**8;//13 * 10**6 * 10**8;\

    // The minimum amount needed to receive in Wei to change the price to preSaleBonusPrice
    uint256 public constant PRE_SALE_BONUS_WEI_MIN = 3000 * 10**18;

    // The maximum amount of tokens that can be sold during the entire sale
    uint256 public constant TOKEN_SALE_CAP = 100 * 10**6 * 10**8;

    // The minimum amount of tokens a user is allowed to buy
    uint256 public constant MIN_TOKEN_TRANSACTION = 1 * 10**8;

    // The minimum amount of tokens we need to sell to change the final distribution of tokens
    uint256 public constant LOWER_BOUND_TOKEN_LIMIT = 50 * 10**6 * 10**8;

    function GimmerCrowdSaleB(uint256 _startDate, uint256[5] _saleTokenPrices, uint256[5] _saleDates, uint256 _saleWeiLimitWithoutKYC, address _freezeWallet, uint256 _preSaleBonusPrice) {
        require(_startDate >= now);
        require(_saleWeiLimitWithoutKYC > 0);
        require(_freezeWallet != address(0));

        startTime = _startDate;
        wallet = msg.sender;
        
        // copy args
        tokenPrices = _saleTokenPrices;
        tokenDates = _saleDates;
        saleWeiLimitWithoutKYC = _saleWeiLimitWithoutKYC;
        freezeWallet = _freezeWallet;
        preSaleBonusPrice = _preSaleBonusPrice;

        // initialize the contract
        preSaleEndTime = _saleDates[0];                                                     
        startWithdrawalTime = _saleDates[_saleDates.length - 1];

        kycManager = msg.sender;

        currentStage = Stages.Deployment;
        currentTokenPricePhase = 0;

        token = new GimmerToken();
    }

    /**
    * @dev Receives Wei
    */
    function () public payable {
        buyTokens(msg.sender);
    }

    /**
    * @dev Buys tokens and sends them to the caller
    */
    function buy() public payable {
        buyTokens(msg.sender);
    }

    /**
    * @dev Buys tokens and sends them to a specific address
    * @param beneficiary The address that will receive the GMR tokens
    */
    function buyTokens(address beneficiary) public payable {
        require(beneficiary != address(0));
        require(msg.value != 0);

        updateStage();
        updateTokenPhase();

        uint256 weiAmount = msg.value;
        uint256 totalTokensSold;
        uint256 tokens;
        if (atStage(Stages.PreSale)) {
            // calculate token amount to be created
            uint256 currentTokenPrice;

            if (weiAmount > PRE_SALE_BONUS_WEI_MIN) {
                currentTokenPrice = preSaleBonusPrice;
            } else {
                currentTokenPrice = tokenPrices[currentTokenPricePhase];
            }
            
            tokens = weiAmount.div(currentTokenPrice);
            require(tokens > MIN_TOKEN_TRANSACTION);
        
            totalTokensSold = tokensSold.add(tokens);

            // presale has a hardcap of tokens that can be sold
            require(totalTokensSold <= PRE_SALE_TOKEN_CAP);
        } else if (atStage(Stages.Sale)) {
            // calculate token amount to be created
            uint256 currentTokenPrice = tokenPrices[currentTokenPricePhase];
            tokens = weiAmount.div(currentTokenPrice);
            require(tokens > MIN_TOKEN_TRANSACTION);
        
            totalTokensSold = tokensSold.add(tokens);
        } else {
            // not on presale, not on sale = no tokens
            revert();
        }
        require(totalTokensSold <= TOKEN_SALE_CAP);

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

        wallet.transfer(msg.value);
        //forwardFunds();
    }

    /**
    * @dev Allows the owner to force update the state of the contract
    * without the need to actually send Wei to the contract
    */
    function forceUpdateState() public onlyOwner {
        updateStage();
        updateTokenPhase();
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

    function getTotalTokensSold() public constant returns (uint256) {
        return tokensSold;
    }

    /**
    * @dev Returns if an users has KYC approval or not
    * @return A boolean representing the user's KYC status
    */
    function userHasKYC(address user) public constant returns (bool) {
        return supportersMap[user].hasKYC;
    }

    /**
    * @dev Returns the address of the token contract
    * @return An address for the GimmerToken
    */
    function getTokenContract() public constant returns (address) {
        return token;
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
        if (currentStage == Stages.Deployment) {
            if (now >= startTime) {
                currentStage = Stages.PreSale;
            } else {
                // Deployment stage, before start time shouldnt execute
                revert();
            }
        }
        if (currentStage == Stages.PreSale &&
            now >= preSaleEndTime) {
            currentStage = Stages.Sale;
        } 
        if (currentStage == Stages.Sale &&
            now >= startWithdrawalTime) {
            currentStage = Stages.FinishedSale;

            // get 10%
            finishContract();
        }
    }

    /**
    * @dev Ends the operation of the contract
    */
    function finishContract() internal {
        uint256 tenPC = tokensSold.div(10);
        uint256 totalTokens = tokensSold.add(tenPC);
        
        // if we failed to sell the lower bound limit of tokens,
        // we'll have to mint the remaining tokens and send to a frozen wallet
        if (tokensSold < LOWER_BOUND_TOKEN_LIMIT) {
            totalTokensFrozen = LOWER_BOUND_TOKEN_LIMIT.sub(totalTokens);
            token.mint(freezeWallet, totalTokensFrozen);
        }

        // send 10% to Gimmer Team wallet
        token.mint(wallet, tenPC);

        token.finishMinting();
        token.transferOwnership(wallet);
    }
}