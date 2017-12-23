pragma solidity ^0.4.18;

import './../zeppelin/token/MintableToken.sol';

/**
* @title Gimmer Token Smart Contract
* @author lucas@gimmer.net, jitendra@chittoda.com
*/
contract GimmerToken is MintableToken  {
    // Constants
    string public constant name = "GimmerToken";
    string public constant symbol = "GMR";  
    uint8 public constant decimals = 18;

    /**
    * @dev Modifier to only allow transfers after the minting has been done
    */
    modifier onlyWhenTransferEnabled() {
        require(mintingFinished);
        _;
    }

    modifier validDestination(address _to) {
        require(_to != address(0x0));
        require(_to != address(this));
        _;
    }

    function GimmerToken() public {
    }

    function transferFrom(address _from, address _to, uint256 _value) public        
        onlyWhenTransferEnabled
        validDestination(_to)         
        returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }

    function approve(address _spender, uint256 _value) public
        onlyWhenTransferEnabled         
        returns (bool) {
        return super.approve(_spender, _value);
    }

    function increaseApproval (address _spender, uint _addedValue) public
        onlyWhenTransferEnabled         
        returns (bool) {
        return super.increaseApproval(_spender, _addedValue);
    }

    function decreaseApproval (address _spender, uint _subtractedValue) public
        onlyWhenTransferEnabled         
        returns (bool) {
        return super.decreaseApproval(_spender, _subtractedValue);
    }

    function transfer(address _to, uint256 _value) public
        onlyWhenTransferEnabled
        validDestination(_to)         
        returns (bool) {
        return super.transfer(_to, _value);
    }
}