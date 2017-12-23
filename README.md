# Gimmer Token Ethereum Contracts

All the Gimmer Solidity contracts will be stored in this repository.

### Prerequisites

```
Truffle 4.01
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
