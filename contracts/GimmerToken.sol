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
}