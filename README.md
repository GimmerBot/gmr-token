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
truffle test test\GimmerTokenSale.js --network ganache

```

## Running coverage tests

(see testrpc.txt)

```
testrpc-sc -args
./node_modules/.bin/solidity-coverage
```

## Built With

* [OpenZeppelin](https://github.com/OpenZeppelin/zeppelin-solidity)
