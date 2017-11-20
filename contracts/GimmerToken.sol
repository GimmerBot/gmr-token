pragma solidity ^0.4.17;

import '../submodules/zeppelin-solidity/contracts/token/MintableToken.sol';
import '../submodules/zeppelin-solidity/contracts/lifecycle/Pausable.sol';

contract GimmerToken is MintableToken, Pausable  {
    // this needs to be lowercase to be read by the clients
    string public constant name = "Gimmer";
    string public constant symbol = "GMR";  
    uint8 public constant decimals = 8;
    uint256 public constant INITIAL_SUPPLY = 0;//25000000 * (10 ** uint256(decimals));

    /**
    * @dev Constructor that gives msg.sender all of existing tokens.
    */
    function GimmerToken() public {
        totalSupply = INITIAL_SUPPLY;
        balances[msg.sender] = INITIAL_SUPPLY;
        paused = true;
    }

    function transferFrom(address _from, address _to, uint256 _value) whenNotPaused public returns (bool) {
        super.transferFrom(_from, _to, _value);
    }

    function approve(address _spender, uint256 _value) whenNotPaused public returns (bool) {
        super.approve(_spender, _value);
    }

    function increaseApproval (address _spender, uint _addedValue) whenNotPaused public returns (bool success) {
        super.increaseApproval(_spender, _addedValue);
    }

    function decreaseApproval (address _spender, uint _subtractedValue) whenNotPaused public returns (bool success) {
        super.decreaseApproval(_spender, _subtractedValue);
    }

    function transfer(address _to, uint256 _value) whenNotPaused public returns (bool) {
        super.transfer(_to, _value);
    }
}