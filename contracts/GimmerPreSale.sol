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
    //Transfer is disabled
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
    uint256 public constant decimals = 8;

    // start and end timestamps where investments are allowed (both inclusive)
    uint256 public startTime;
    uint256 public endTime;

    uint256 public price;
    uint256 public bonusPrice;

    address public fundWallet;

    // Address that manages approval of KYC
    address public kycManager;

    // How many sold in PreSale
    uint256 public tokensSold;

    // amount of raised money in wei
    uint256 public weiRaised;

    // Maximum amount that can be sold during the Pre Sale period
    uint256 public constant PRE_SALE_TOKEN_CAP = 15 * 10**6 * 10**8;

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
    function GimmerPreSale(uint256 _startTime, uint256 _endTime, uint256 _price, uint256 _bonusPrice, address _fundWallet, address _kycManagerWallet) {
        require(_startTime >= now);
        require(_endTime >= _startTime);
        require(_price > 0);
        require(_bonusPrice > 0);
        require(_kycManagerWallet != address(0));

        startTime = _startTime;
        endTime = _endTime;
        price = _price;
        bonusPrice = _bonusPrice;
        fundWallet = _fundWallet;
        kycManager = _kycManagerWallet;
    }

    // fallback function can be used to buy tokens
    function () public payable {
        buyTokens(msg.sender);
    }

    /**
    * @dev Buys tokens and sends them to a specific address
    * @param beneficiary The address that will receive the GMR tokens
    */
    function buyTokens(address beneficiary) whenNotPaused public payable {
        require(beneficiary != address(0));
        require(msg.value >= PRE_SALE_WEI_MIN_TRANSACTION);
        require(now >= startTime && now <= endTime);

        Supporter storage sup = supportersMap[beneficiary];
        require(sup.hasKYC);

        uint256 weiAmount = msg.value;
        
        uint256 currentTokenPrice;
        // calculate token amount to be created
        if (weiAmount > PRE_SALE_BONUS_WEI_MIN) {
            currentTokenPrice = bonusPrice;
        } else {
            currentTokenPrice = price;
        }
        
        uint256 tokens = weiAmount.div(currentTokenPrice);

        uint256 totalTokensSold = tokensSold.add(tokens);
        require(totalTokensSold <= PRE_SALE_TOKEN_CAP);

        uint256 totalWei = sup.weiSpent.add(weiAmount);
        sup.weiSpent = totalWei;

        // update state
        weiRaised = weiRaised.add(weiAmount);
        tokensSold = totalTokensSold;

        mint(beneficiary, tokens);
        TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

        fundWallet.transfer(msg.value);
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