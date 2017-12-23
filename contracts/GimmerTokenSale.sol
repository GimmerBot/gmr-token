pragma solidity ^0.4.18;

import './GimmerToken.sol';

/**
* @title Gimmer Token Sale Smart Contract
* @author lucas@gimmer.net, jitendra@chittoda.com
*/
contract GimmerTokenSale is Ownable {
    using SafeMath for uint256;

    /**
    * @dev Supporter structure, which allows us to track
    * how much the user has bought so far, and if he's flagged as known
    */
    struct Supporter {
        uint256 weiSpent; // the total amount of Wei this address has sent to this contract
        bool hasKYC; // if the user has KYC flagged
    }

    // Variables
    mapping(address => Supporter) public supportersMap; // Mapping with all the campaign supporters
    GimmerToken public token; // ERC20 GMR Token contract address
    address public fundWallet; // Wallet address to forward all Ether to
    address public kycManagerWallet; // Wallet address that manages the approval of KYC
    uint256 public tokensSold; // How many tokens sold have been sold in total
    uint256 public weiRaised; // Total amount of raised money in Wei
    uint256 public maxTxGas; // Maximum transaction gas price allowed for fair-chance transactions
    uint256 public saleWeiLimitWithoutKYC; // The maximum amount of Wei an address can spend here without needing KYC approval during CrowdSale
    bool public finished; // Flag denoting the owner has invoked finishContract()

    uint256 public constant ONE_MILLION = 1000000; // One million for token cap calculation reference
    uint256 public constant PRE_SALE_GMR_TOKEN_CAP = 15 * ONE_MILLION * 1 ether; // Maximum amount that can be sold during the Pre Sale period
    uint256 public constant GMR_TOKEN_SALE_CAP = 100 * ONE_MILLION * 1 ether; // Maximum amount of tokens that can be sold by this contract
    uint256 public constant MIN_ETHER = 0.1 ether; // Minimum ETH Contribution allowed during the crowd sale

    /* Allowed Contribution in Ether */
    uint256 public constant PRE_SALE_30_ETH = 30 ether; // Minimum 30 Ether to get 25% Bonus Tokens
    uint256 public constant PRE_SALE_300_ETH = 300 ether; // Minimum 300 Ether to get 30% Bonus Tokens
    uint256 public constant PRE_SALE_3000_ETH = 3000 ether; // Minimum 3000 Ether to get 40% Bonus Tokens

    /* Bonus Tokens based on the ETH Contributed in single transaction */
    uint256 public constant TOKEN_RATE_BASE_RATE = 2500; // Base Price for reference only
    uint256 public constant TOKEN_RATE_05_PERCENT_BONUS = 2625; // 05% Bonus Tokens During Crowd Sale's Week 4
    uint256 public constant TOKEN_RATE_10_PERCENT_BONUS = 2750; // 10% Bonus Tokens During Crowd Sale's Week 3
    uint256 public constant TOKEN_RATE_15_PERCENT_BONUS = 2875; // 15% Bonus Tokens During Crowd Sale'sWeek 2
    uint256 public constant TOKEN_RATE_20_PERCENT_BONUS = 3000; // 20% Bonus Tokens During Crowd Sale'sWeek 1
    uint256 public constant TOKEN_RATE_25_PERCENT_BONUS = 3125; // 25% Bonus Tokens, During PreSale when >= 30 ETH & < 300 ETH
    uint256 public constant TOKEN_RATE_30_PERCENT_BONUS = 3250; // 30% Bonus Tokens, During PreSale when >= 300 ETH & < 3000 ETH
    uint256 public constant TOKEN_RATE_40_PERCENT_BONUS = 3500; // 40% Bonus Tokens, During PreSale when >= 3000 ETH

    /* Timestamps where investments are allowed */
    uint256 public constant PRE_SALE_START_TIME = 1516190400; // PreSale Start Time : UTC: Wednesday, 17 January 2018 12:00:00 
    uint256 public constant PRE_SALE_END_TIME = 1517400000; // PreSale End Time : UTC: Wednesday, 31 January 2018 12:00:00
    uint256 public constant START_WEEK_1 = 1517486400; // CrowdSale Start Week-1 : UTC: Thursday, 1 February 2018 12:00:00
    uint256 public constant START_WEEK_2 = 1518091200; // CrowdSale Start Week-2 : UTC: Thursday, 8 February 2018 12:00:00
    uint256 public constant START_WEEK_3 = 1518696000; // CrowdSale Start Week-3 : UTC: Thursday, 15 February 2018 12:00:00
    uint256 public constant START_WEEK_4 = 1519300800; // CrowdSale Start Week-4 : UTC: Thursday, 22 February 2018 12:00:00
    uint256 public constant SALE_END_TIME = 1519905600; // CrowdSale End Time : UTC: Thursday, 1 March 2018 12:00:00

    /**
    * @dev Modifier to only allow KYCManager Wallet
    * to execute a function
    */
    modifier onlyKycManager() {
        require(msg.sender == kycManagerWallet);
        _;
    }

    /**
    * Event for token purchase logging
    * @param purchaser The wallet address that bought the tokens
    * @param value How many Weis were paid for the purchase
    * @param amount The amount of tokens purchased
    */
    event TokenPurchase(address indexed purchaser, uint256 value, uint256 amount);

    /**
     * Event for kyc status change logging
     * @param user User who has had his KYC status changed
     * @param isApproved A boolean representing the KYC approval the user has been changed to
     */
    event KYC(address indexed user, bool isApproved);

    /**
     * Constructor
     * @param _fundWallet Address to forward all received Ethers to
     * @param _kycManagerWallet KYC Manager wallet to approve / disapprove user's KYC
     * @param _saleWeiLimitWithoutKYC Maximum amount of Wei an address can spend in the contract without KYC during the crowdsale
     * @param _maxTxGas Maximum gas price a transaction can have before being reverted
     */
    function GimmerTokenSale(
        address _fundWallet, 
        address _kycManagerWallet,
        uint256 _saleWeiLimitWithoutKYC, 
        uint256 _maxTxGas
    )
    public 
    {
        require(_fundWallet != address(0));
        require(_kycManagerWallet != address(0));
        require(_saleWeiLimitWithoutKYC > 0);
        require(_maxTxGas > 0);

        fundWallet = _fundWallet;
        kycManagerWallet = _kycManagerWallet;
        saleWeiLimitWithoutKYC = _saleWeiLimitWithoutKYC;
        maxTxGas = _maxTxGas;

        token = new GimmerToken();
    }

    /* fallback function can be used to buy tokens */
    function () public payable {
        buyTokens();
    }

    /* low level token purchase function */
    function buyTokens() public payable {
        // Do not allow if gasprice is bigger than the maximum
        // This is for fair-chance for all contributors, so no one can
        // set a too-high transaction price and be able to buy earlier
        require(tx.gasprice <= maxTxGas);
        // valid purchase identifies which stage the contract is at (PreState/Token Sale)
        // making sure were inside the contribution period and the user
        // is sending enough Wei for the stage's rules
        require(validPurchase());

        address sender = msg.sender;
        uint256 weiAmountSent = msg.value;

        // calculate token amount to be created
        uint256 rate = getRate(weiAmountSent);
        uint256 newTokens = weiAmountSent.mul(rate);

        // look if we have not yet reached the cap
        uint256 totalTokensSold = tokensSold.add(newTokens);
        if (isCrowdSaleRunning()) {
            require(totalTokensSold <= GMR_TOKEN_SALE_CAP);
        } else if (isPreSaleRunning()) { 
            require(totalTokensSold <= PRE_SALE_GMR_TOKEN_CAP);
        }

        // update supporter state
        Supporter storage sup = supportersMap[sender];
        uint256 totalWei = sup.weiSpent.add(weiAmountSent);
        sup.weiSpent = totalWei;

        // update contract state
        weiRaised = weiRaised.add(weiAmountSent);
        tokensSold = totalTokensSold;

        // mint the coins
        token.mint(sender, newTokens);
        TokenPurchase(sender, weiAmountSent, newTokens);

        // forward the funds to the wallet
        fundWallet.transfer(msg.value);
    }

    /**
    * @dev Ends the operation of the contract
    */
    function finishContract() public onlyOwner {
        // make sure the contribution period has ended
        require(now > SALE_END_TIME);
        require(!finished);

        finished = true;

        // send the 10% commission to Gimmer's fund wallet
        uint256 tenPC = tokensSold.div(10);
        token.mint(fundWallet, tenPC);

        // finish the minting of the token, so the system allows transfers
        token.finishMinting();

        // transfer ownership of the token contract to the fund wallet,
        // so it isn't locked to be a child of the crowd sale contract
        token.transferOwnership(fundWallet);
    }

    function setSaleWeiLimitWithoutKYC(uint256 _newSaleWeiLimitWithoutKYC) public onlyKycManager {
        require(_newSaleWeiLimitWithoutKYC > 0);
        saleWeiLimitWithoutKYC = _newSaleWeiLimitWithoutKYC;
    }

    /**
    * @dev Updates the maximum allowed transaction cost that can be received
    * on the buyTokens() function.
    * @param _newMaxTxGas The new maximum transaction cost
    */
    function updateMaxTxGas(uint256 _newMaxTxGas) public onlyKycManager {
        require(_newMaxTxGas > 0);
        maxTxGas = _newMaxTxGas;
    }

    /**
    * @dev Flag an user as known
    * @param _user The user to flag as known
    */
    function approveUserKYC(address _user) onlyKycManager public {
        require(_user != address(0));

        Supporter storage sup = supportersMap[_user];
        sup.hasKYC = true;
        KYC(_user, true);
    }

    /**
     * @dev Flag an user as unknown/disapproved
     * @param _user The user to flag as unknown / suspecious
     */
    function disapproveUserKYC(address _user) onlyKycManager public {
        require(_user != address(0));
        
        Supporter storage sup = supportersMap[_user];
        sup.hasKYC = false;
        KYC(_user, false);
    }

    /**
    * @dev Changes the KYC manager to a new address
    * @param _newKYCManagerWallet The new address that will be managing KYC approval
    */
    function setKYCManager(address _newKYCManagerWallet) onlyOwner public {
        require(_newKYCManagerWallet != address(0));
        kycManagerWallet = _newKYCManagerWallet;
    }
    
    /**
    * @dev Returns true if any of the token sale stages are currently running
    * @return A boolean representing the state of this contract
    */
    function isTokenSaleRunning() public constant returns (bool) {
        return (isPreSaleRunning() || isCrowdSaleRunning());
    }

    /**
    * @dev Returns true if the presale sale is currently running
    * @return A boolean representing the state of the presale
    */
    function isPreSaleRunning() public constant returns (bool) {
        return (now >= PRE_SALE_START_TIME && now < PRE_SALE_END_TIME);
    }

    /**
    * @dev Returns true if the public sale is currently running
    * @return A boolean representing the state of the crowd sale
    */
    function isCrowdSaleRunning() public constant returns (bool) {
        return (now >= START_WEEK_1 && now <= SALE_END_TIME);
    }

    /**
    * @dev Returns true if the public sale has ended
    * @return A boolean representing if we are past the contribution date for this contract
    */
    function hasEnded() public constant returns (bool) {
        return now > SALE_END_TIME;
    }

    /**
    * @dev Returns true if the pre sale has ended
    * @return A boolean representing if we are past the pre sale contribution dates
    */
    function hasPreSaleEnded() public constant returns (bool) {
        return now > PRE_SALE_END_TIME;
    }

    /**
    * @dev Returns if an user has KYC approval or not
    * @return A boolean representing the user's KYC status
    */
    function userHasKYC(address _user) public constant returns (bool) {
        return supportersMap[_user].hasKYC;
    }

    /**
     * @dev Returns the weiSpent of a user
     */
    function userWeiSpent(address _user) public constant returns (uint256) {
        return supportersMap[_user].weiSpent;
    }

    /**
     * @dev Returns the rate the user will be paying at,
     * based on the amount of Wei sent to the contract, and the current time
     * @return An uint256 representing the rate the user will pay for the GMR tokens
     */
    function getRate(uint256 _weiAmount) internal constant returns (uint256) {   
        if (isCrowdSaleRunning()) {
            if (now >= START_WEEK_4) { return TOKEN_RATE_05_PERCENT_BONUS; }
            else if (now >= START_WEEK_3) { return TOKEN_RATE_10_PERCENT_BONUS; }
            else if (now >= START_WEEK_2) { return TOKEN_RATE_15_PERCENT_BONUS; }
            else if (now >= START_WEEK_1) { return TOKEN_RATE_20_PERCENT_BONUS; }
        }
        else if (isPreSaleRunning()) {
            if (_weiAmount >= PRE_SALE_3000_ETH) { return TOKEN_RATE_40_PERCENT_BONUS; }
            else if (_weiAmount >= PRE_SALE_300_ETH) { return TOKEN_RATE_30_PERCENT_BONUS; }
            else if (_weiAmount >= PRE_SALE_30_ETH) { return TOKEN_RATE_25_PERCENT_BONUS; }
        }
    }

    /* @return true if the transaction can buy tokens, otherwise false */
    function validPurchase() internal constant returns (bool) {
        bool userHasKyc = userHasKYC(msg.sender);

        if (isCrowdSaleRunning()) {
            // crowdsale restrictions (KYC only needed after wei limit, minimum of 0.1 ETH tx)
            if(!userHasKyc) {
                Supporter storage sup = supportersMap[msg.sender];
                uint256 ethContribution = sup.weiSpent.add(msg.value);
                if (ethContribution > saleWeiLimitWithoutKYC) {
                    return false;
                }
            }
            return msg.value >= MIN_ETHER;
        }
        else if (isPreSaleRunning()) {
            // presale restrictions (at least 30 eth, always KYC)
            return userHasKyc && msg.value >= PRE_SALE_30_ETH;
        } else {
            return false;
        }
    }
}