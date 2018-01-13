# Gimmer® Solidity Contracts

All the Gimmer Solidity contracts will be stored in this repository.

### Prerequisites

```
Truffle 4
NPM
```

## Compiling

```
truffle compile
```

## Running Unit+Coverage tests

```
testrpc-sc -args (see testrpc.txt)
./node_modules/.bin/solidity-coverage
```

## Documentation

The documentation can be found in the following link:
https://github.com/GimmerBot/gmr-token/blob/master/documentation/GimmerTokenSaleContracts.pdf

## Bug Bounty

### Files
[GimmerTokenSale.sol](https://github.com/GimmerBot/gmr-token/blob/master/contracts/GimmerTokenSale.sol) - Manages PreSale and Crowd Sale transactions. Highest priority to bugscavenge, as the code is mostly new and directly related to our specific token sale rules.  
[GimmerTokenSale.js](https://github.com/GimmerBot/gmr-token/blob/master/test/GimmerTokenSale.js) - Automated tests for both the Token Sale and GMR Token contracts. Coverage tests using this file can achieve 94% coverage (100% seems impossible at the moment as there are lines in the contract that can never be executed because of date limitations).  
[GimmerToken.sol](https://github.com/GimmerBot/gmr-token/blob/master/contracts/GimmerToken.sol) - Contract file for the GMR token. Basically a MintableToken with the addition that it can only be traded after minting is complete. Code for the GimmerToken is mostly Zeppelins with the addition of the trading block, so for this file in particular we were already covered by Zeppelin's tests.

### Bugs
Found bugs will be rewarded proportionately to their impact/severity.

### Tips
Recommendations and tips about the structure of the contract can also be accepted, though rewards will vary based on their usefulness to us, with the rules we have to implement.

## Built With

* [OpenZeppelin](https://github.com/OpenZeppelin/zeppelin-solidity)
