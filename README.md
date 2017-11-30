# Gimmer Token Ethereum Contracts

All the Gimmer Solidity contracts will be stored in this repository.

## Getting Started

These instructions will get you a copy of the project ready for testing or deployment on your local machine.

### Prerequisites

```
Truffle 4.0 (Beta 2)
```

Also needed, but included with the project is the Zeppelin-Gimer (OpenZeppelin fork).
To make sure you have your copy, after cloning run:

```
git submodule update --init --recursive  // first time only
git submodule update --recursive --remote // for updating the subrepo later
npm install
```

## Compiling

```
truffle compile
```

## Running Unit Tests

```
ganache.bat
truffle test test\GimmerPreSale.js --network ganache

After executing the GimmerPreSale.js test, it won't execute again under Ganache as the block time is ahead of the contract time (so always start a new instance of Ganache before testing the GimmerPreSale.js)


truffle test test\GimmerPreSaleTimed.js --network ganache

The GimmerPreSaleTimed.js uses the GimmerPreSaleTimed.sol, which is exactly the same contract as the GimmerPreSale.sol but with an additional function that allows us to change the start and end date of the contract, so we can test inside Ganache with unlimited possibilities.

```

## Built With

* [OpenZeppelin](https://github.com/OpenZeppelin/zeppelin-solidity)
