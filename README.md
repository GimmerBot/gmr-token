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
GimmerToken.sol - Contract file for the GMR token. Basically a MintableToken with the addition that it can only be traded after minting is complete. - https://github.com/GimmerBot/gmr-token/blob/master/contracts/GimmerToken.sol  
GimmerTokenSale.sol - Manages PreSale and Crowd Sale transactions - https://github.com/GimmerBot/gmr-token/blob/master/contracts/GimmerTokenSale.sol  
GimmerTokenSale.js - Automated tests for both the Token Sale and GMR Token contracts. - https://github.com/GimmerBot/gmr-token/blob/master/test/GimmerTokenSale.js  

### Bugs
Found bugs will be rewarded proportionately to their severity.

### Tips
Recommendations and tips about the structure of the contract can also be accepted, though rewards will vary based on their usefulness to us, with the rules we have to implement.

## Built With

* [OpenZeppelin](https://github.com/OpenZeppelin/zeppelin-solidity)
