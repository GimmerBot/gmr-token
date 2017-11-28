pragma solidity ^0.4.17;

import '../submodules/zeppelin-solidity/contracts/math/SafeMath.sol';
import '../submodules/zeppelin-solidity/contracts/lifecycle/Pausable.sol';

/**
 * @title ERC20Basic
 * @dev Simpler version of ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/179
 */
contract ERC20Basic {
    uint256 public totalSupply;
    mapping(address => uint256) balances;
    function balanceOf(address _owner) public constant returns (uint256) { return balances[_owner]; }
    // Transfer is disabled for users, as these are PreSale tokens
    //function transfer(address to, uint256 value) public returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
}

/**
* @title Gimmer PreSale Smart Contract
*/
contract GimmerPreSaleTimed is ERC20Basic, Pausable {
    using SafeMath for uint256;

    /**
    * @dev Supporter structure, which allows us to track
    * how much the user has bought so far, and if he's flagged as known
    */
    struct Supporter {
        uint256 weiSpent;   // the total amount of Wei this address has sent to this contract
        bool hasKYC;        // if the user has KYC flagged
    }

    mapping(address => Supporter) public supportersMap; // Mapping with all the campaign supporters
    address public fundWallet;      // Address to forward all Ether to
    address public kycManager;      // Address that manages approval of KYC
    uint256 public tokensSold;      // How many tokens sold in PreSale
    uint256 public weiRaised;       // amount of raised money in wei

    uint256 public constant ONE_MILLION = 1000000;
    // Maximum amount that can be sold during the Pre Sale period
    uint256 public constant PRE_SALE_GMRP_TOKEN_CAP = 15 * ONE_MILLION * 1 ether; //15 Million GMRP Tokens


    /* Allowed Contribution in Ether */
    uint256 public constant PRE_SALE_30_ETH     = 30 ether;  // Minimum 30 Ether to get 25% Bonus Tokens
    uint256 public constant PRE_SALE_300_ETH    = 300 ether; // Minimum 300 Ether to get 30% Bonus Tokens
    uint256 public constant PRE_SALE_3000_ETH   = 3000 ether;// Minimum 3000 Ether to get 40% Bonus Tokens

    /* Bonus Tokens based on the ETH Contributed in single transaction */
    uint256 public constant TOKEN_RATE_25_PERCENT_BONUS = 1250; // 25% Bonus Tokens, when >= 30 ETH & < 300 ETH
    uint256 public constant TOKEN_RATE_30_PERCENT_BONUS = 1300; // 30% Bonus Tokens, when >= 300 ETH & < 3000 ETH
    uint256 public constant TOKEN_RATE_40_PERCENT_BONUS = 1400; // 40% Bonus Tokens, when >= 3000 ETH

    /* start and end timestamps where investments are allowed (both inclusive) */
    //uint256 public constant START_TIME  = 1511524800;   //GMT: Friday, 24 November 2017 12:00:00
    //uint256 public constant END_TIME    = 1514894400;   //GMT: Tuesday, 2 January  2018 12:00:00
    uint256 public START_TIME = 1511524800;   //GMT: Friday, 24 November 2017 12:00:00
    uint256 public END_TIME = 1514894400;   //GMT: Tuesday, 2 January  2018 12:00:00

    /* Token metadata */
    string public constant name = "GimmerPreSale Token";
    string public constant symbol = "GMRP";
    uint256 public constant decimals = 18;

    /**
    * @dev Modifier to only allow KYCManager
    */
    modifier onlyKycManager() {
        require(msg.sender == kycManager);
        _;
    }


    /**
    * event for token purchase logging
    * @param purchaser who bought the tokens
    * @param value weis paid for purchase
    * @param amount amount of tokens purchased
    */
    event TokenPurchase(address indexed purchaser, uint256 value, uint256 amount);

    /**
    * event for minting new tokens
    * @param to the person that 
    */
    event Mint(address indexed to, uint256 amount);

    /**
    * @dev 
    */
    function GimmerPreSaleTimed(address _fundWallet, address _kycManagerWallet) public {
        require(_fundWallet != address(0));
        require(_kycManagerWallet != address(0));

        fundWallet = _fundWallet;
        kycManager = _kycManagerWallet;
    }

    // fallback function can be used to buy tokens
    function () public payable {
        buyTokens();
    }

    // This function is to be commented on the final version, this is for testing
    function testSetDates(uint256 startDate, uint256 endDate){
        START_TIME = startDate;
        END_TIME = endDate;
    }

    // @return true if the transaction can buy tokens
    function validPurchase() internal constant returns (bool) {
        bool withinPeriod = now >= START_TIME && now <= END_TIME;
        bool higherThanMin = msg.value >= PRE_SALE_30_ETH;
        return withinPeriod && higherThanMin;
    }

    // low level token purchase function
    function buyTokens() whenNotPaused public payable {
        require(validPurchase());

        // make sure the user buying tokens has KYC
        address sender = msg.sender;
        Supporter storage sup = supportersMap[sender];
        require(sup.hasKYC);

        // calculate token amount to be created
        uint256 weiAmount = msg.value;
        uint256 rate = getRate(weiAmount);
        uint256 tokens = weiAmount.mul(rate);

        // look if we have not yet reached the cap
        uint256 totalTokensSold = tokensSold.add(tokens);
        require(totalTokensSold <= PRE_SALE_GMRP_TOKEN_CAP);

        // update supporter state
        uint256 totalWei = sup.weiSpent.add(weiAmount);
        sup.weiSpent = totalWei;

        // update contract state
        weiRaised = weiRaised.add(weiAmount);
        tokensSold = totalTokensSold;

        // finally mint the coins
        mint(sender, tokens);
        TokenPurchase(sender, weiAmount, tokens);

        // and forward the funds to the wallet
        forwardFunds();
    }

    // returns the rate the user will be paying at,
    // based on the amount of wei sent to the contract
    function getRate(uint256 weiAmount) public pure returns (uint256) {
        if (weiAmount >= PRE_SALE_3000_ETH)
        {
            return TOKEN_RATE_40_PERCENT_BONUS;
        }
        return weiAmount >= PRE_SALE_300_ETH ? TOKEN_RATE_30_PERCENT_BONUS : TOKEN_RATE_25_PERCENT_BONUS;
    }

    // send ether to the fund collection wallet
    // override to create custom fund forwarding mechanisms
    function forwardFunds() internal {
        fundWallet.transfer(msg.value);
    }

    // @return true if crowdsale event has ended
    function hasEnded() public constant returns (bool) {
        return now > END_TIME;
    }


    /**
    * @dev Approves an User's KYC, unfreezing any Wei/Tokens
    * to be withdrawn
    * @param user The user to flag as known
    */
    function approveUserKYC(address user) onlyKycManager public {
        Supporter storage sup = supportersMap[user];
        sup.hasKYC = true;
    }

    /**
    * @dev Changes the KYC manager to a new address
    * @param newKYCManager The new address that will be managing KYC approval
    */
    function setKYCManager(address newKYCManager) onlyOwner public {
        require(newKYCManager != address(0));
        kycManager = newKYCManager;
    }

    /**
    * @dev Returns if an users has KYC approval or not
    * @return A boolean representing the user's KYC status
    */
    function userHasKYC(address user) public constant returns (bool) {
        return supportersMap[user].hasKYC;
    }

    /**
    * @dev Function to mint tokens
    * @param _to The address that will receive the minted tokens.
    * @param _amount The amount of tokens to mint.
    * @return A boolean that indicates if the operation was successful.
    */
    function mint(address _to, uint256 _amount) internal returns (bool) {
        totalSupply = totalSupply.add(_amount);
        balances[_to] = balances[_to].add(_amount);
        Mint(_to, _amount);
        Transfer(0x0, _to, _amount);
        return true;
    }
}