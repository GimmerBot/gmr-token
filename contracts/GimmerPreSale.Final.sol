pragma solidity ^0.4.17;

import '../submodules/zeppelin-solidity/contracts/math/SafeMath.sol';
//import '../submodules/zeppelin-solidity/contracts/ownership/Ownable.sol';
import '../submodules/zeppelin-solidity/contracts/lifecycle/Pausable.sol';

/**
 * @title ERC20Basic
 * @dev Simpler version of ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/179
 */
contract ERC20Basic {
    uint256 public totalSupply;
    mapping(address => uint256) balances;
    function balanceOf(address _owner) public constant returns (uint256) { 
        return balances[_owner]; 
    }
    // Transfer is disabled for users
    //function transfer(address to, uint256 value) public returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
}

/**
* @title Gimmer Crowd Sale
* @dev Gimmer Crowd Sale contract
*/
contract GimmerPreSale is ERC20Basic, Pausable {
    using SafeMath for uint256;

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

    // Mapping with all the campaign supporters
    mapping(address => Supporter) public supportersMap;

    // Address to forward all Wei to
    address public fundWallet;

    // Address that manages approval of KYC
    address public kycManager;

    // How many sold in PreSale
    uint256 public tokensSold;

    // amount of raised money in wei
    uint256 public weiRaised;

    // Maximum amount that can be sold during the Pre Sale period
    uint256 public constant PRE_SALE_TOKEN_CAP = 15000000 ether;

    // The minimum allowed transaction in wei on the presale
    uint256 public constant PRE_SALE_WEI_MIN_TRANSACTION = 30 ether;

    // The minimum amount needed to receive in Wei to change the price to preSaleBonusPrice
    uint256 public constant PRE_SALE_BONUS_1_WEI_MIN = 3000 ether;

    // The minimum amount needed to receive in Wei to change the price to preSaleBonusPrice
    uint256 public constant PRE_SALE_BONUS_2_WEI_MIN = 300 ether;

    // The price for people that buy more than PRE_SALE_BONUS_1_WEI_MIN (Band 1)
    uint256 public constant TOKEN_RATE_BAND_1 = 1400;

    // The price for people that buy more than PRE_SALE_BONUS_1_WEI_MIN (Band 2)
    uint256 public constant TOKEN_RATE_BAND_2 = 1300;

    // The price for people that buy less than both bonus (Band 3)
    uint256 public constant TOKEN_RATE_BAND_3 = 1250;

    // start and end timestamps where investments are allowed (both inclusive)
    uint256 public constant START_TIME = 1511524800;
    uint256 public constant END_TIME = 1514894400;

    // The name of the Token
    string public constant name = "GimmerPreSale Token";

    // The symbol to be shown as the token
    string public constant symbol = "GMRP";

    // The amount of decimals the GMRP token has
    uint256 public constant decimals = 18;

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
    function GimmerPreSale(address _fundWallet, address _kycManagerWallet) {
        require(_fundWallet != address(0));
        require(_kycManagerWallet != address(0));

        fundWallet = _fundWallet;
        kycManager = _kycManagerWallet;
    }

    // fallback function can be used to buy tokens
    function () public payable {
        buyTokens();
    }

    // @return true if the transaction can buy tokens
    function validPurchase() internal constant returns (bool) {
        bool withinPeriod = now >= START_TIME && now <= END_TIME;
        bool higherThanMin = msg.value >= PRE_SALE_WEI_MIN_TRANSACTION;
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
        require(totalTokensSold <= PRE_SALE_TOKEN_CAP);

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
    function getRate(uint256 weiAmount) constant returns (uint256) {
        if (weiAmount >= PRE_SALE_BONUS_1_WEI_MIN)
        {
            return TOKEN_RATE_BAND_1;
        }
        return weiAmount >= PRE_SALE_BONUS_2_WEI_MIN ? TOKEN_RATE_BAND_2 : TOKEN_RATE_BAND_3;
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
    * @dev Throws if called by any account other than the KYC Manager.
    */
    modifier onlyKycManager() {
        require(msg.sender == kycManager);
        _;
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