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
```

## Compiling

```
truffle compile
```

## Running Unit Tests

```
truffle develop
> test
```

## Built With

* [OpenZeppelin](https://github.com/OpenZeppelin/zeppelin-solidity) - The Solidity framework used, though we used a fork from it managed by Gimmer, available here: https://github.com/GimmerBot/zeppelin-solidity

## Comments
### LimitedTokenCrowdSale and GimmerCrowdSale