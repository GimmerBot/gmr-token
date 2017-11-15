pragma solidity ^0.4.17;

import '../submodules/zeppelin-solidity/contracts/token/MintableToken.sol';

contract GimmerToken is MintableToken  {
    // this needs to be lowercase to be read by the clients
    string public constant name = "Gimmer";
    string public constant symbol = "GMR";  
    uint8 public constant decimals = 8;
    uint256 public constant INITIAL_SUPPLY = 25000000 * (10 ** uint256(decimals));

    /**
    * @dev Constructor that gives msg.sender all of existing tokens.
    */
    function GimmerToken() public {
        totalSupply = INITIAL_SUPPLY;
        balances[msg.sender] = INITIAL_SUPPLY;
    }
}