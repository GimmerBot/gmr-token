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

    string public constant name = "GimmerPreSale";
    string public constant symbol = "GMRP";
    uint256 public constant decimals = 18;

    // start and end timestamps where investments are allowed (both inclusive)
    uint256 public startTime;
    uint256 public endTime;

    uint256 public baseRate;
    uint256 public bonusRate;

    address public fundWallet;

    // Address that manages approval of KYC
    address public kycManager;

    // How many sold in PreSale
    uint256 public tokensSold;

    // amount of raised money in wei
    uint256 public weiRaised;

    // Maximum amount that can be sold during the Pre Sale period
    uint256 public constant PRE_SALE_TOKEN_CAP = 15 * 10**6 * 10**18;

    // The minimum amount needed to receive in Wei to change the price to preSaleBonusPrice
    uint256 public constant PRE_SALE_BONUS_WEI_MIN = 3000 * 10**18;

    // The minimum allowed transaction in wei on the presale
    uint256 public constant PRE_SALE_WEI_MIN_TRANSACTION = 1 * 10**18;
    

    /**
    * event for token purchase logging
    * @param purchaser who paid for the tokens
    * @param beneficiary who got the tokens
    * @param value weis paid for purchase
    * @param amount amount of tokens purchased
    */
    event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);


    event Mint(address indexed to, uint256 amount);

    /**
    * @dev 
    */
    function GimmerPreSale(uint256 _startTime, uint256 _endTime, uint256 _baseRate, uint256 _bonusRate, address _fundWallet, address _kycManagerWallet) {
        require(_startTime >= now);
        require(_endTime >= _startTime);
        require(_baseRate > 0);
        require(_bonusRate > 0);
        require(_fundWallet != address(0));
        require(_kycManagerWallet != address(0));

        startTime = _startTime;
        endTime = _endTime;
        baseRate = _baseRate;
        bonusRate = _bonusRate;
        fundWallet = _fundWallet;
        kycManager = _kycManagerWallet;
    }

    // fallback function can be used to buy tokens
    function () public payable {
        buyTokens(msg.sender);
    }

    // @return true if the transaction can buy tokens
    function validPurchase() internal constant returns (bool) {
        bool withinPeriod = now >= startTime && now <= endTime;
        bool higherThanMin = msg.value >= PRE_SALE_WEI_MIN_TRANSACTION;
        return withinPeriod && higherThanMin;
    }

    // low level token purchase function
    function buyTokens(address beneficiary) whenNotPaused public payable {
        require(beneficiary != address(0));
        require(validPurchase());

        // make sure the user buying tokens has KYC
        Supporter storage sup = supportersMap[beneficiary];
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
        mint(beneficiary, tokens);
        TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

        // and forward the funds to the
        forwardFunds();
    }

    function getRate(uint256 weiAmount) constant returns (uint256) {
        return weiAmount > PRE_SALE_BONUS_WEI_MIN ? bonusRate : baseRate;
    }

    // send ether to the fund collection wallet
    // override to create custom fund forwarding mechanisms
    function forwardFunds() internal {
        fundWallet.transfer(msg.value);
    }

    // @return true if crowdsale event has ended
    function hasEnded() public constant returns (bool) {
        return now > endTime;
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
    * @dev Changes the KYC manager to a new address
    * @param newKYCManager The new address that will be managing KYC approval
    */
    function setKYCManager(address newKYCManager) public onlyOwner {
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