pragma solidity ^0.4.17;

import '../submodules/zeppelin-gimmer/contracts/token/StandardToken.sol';
import '../submodules/zeppelin-gimmer/contracts/ownership/Ownable.sol';

/**
 * @title SimpleToken
 * @dev Very simple ERC20 Token example, where all tokens are pre-assigned to the creator.
 * Note they can later distribute these tokens as they wish using `transfer` and other
 * `StandardToken` functions.
 */
contract GimmerToken is StandardToken, Ownable {

  uint256 public sellPrice;
  uint256 public buyPrice;

  // this needs to be lowercase to be read by the clients
  string public constant name = "Gimmer";
  string public constant symbol = "GMR";  
  uint8 public constant decimals = 8;
  uint256 public constant INITIAL_SUPPLY = 100000000 * (10 ** uint256(decimals));

  /**
   * @dev Constructor that gives msg.sender all of existing tokens.
   */
  function GimmerToken() public {
    totalSupply = INITIAL_SUPPLY;
    balances[msg.sender] = INITIAL_SUPPLY;
  }
  
  function setPrices(uint256 newSellPrice, uint256 newBuyPrice) public onlyOwner {
      sellPrice = newSellPrice;
      buyPrice = newBuyPrice;
  }

  function buy() public payable returns (uint amount) {
      amount = msg.value / buyPrice;                    // calculates the amount
      require(balances[this] >= amount);               // checks if it has enough to sell
      balances[msg.sender] += amount;                  // adds the amount to buyer's balance
      balances[this] -= amount;                        // subtracts amount from seller's balance
      Transfer(this, msg.sender, amount);               // execute an event reflecting the change
      return amount;                                    // ends function and returns
  }

  function sell(uint amount) public returns (uint revenue) {
      require(balances[msg.sender] >= amount);         // checks if the sender has enough to sell
      balances[this] += amount;                        // adds the amount to owner's balance
      balances[msg.sender] -= amount;                  // subtracts the amount from seller's balance
      revenue = amount7; * sellPrice;
      require(msg.sender.send(revenue));                // sends ether to the seller: it's important to do this last to prevent recursion attacks
      Transfer(msg.sender, this, amount);               // executes an event reflecting on the change
      return revenue;                                   // ends function and returns
  } 
}