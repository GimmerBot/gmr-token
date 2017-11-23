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

* [OpenZeppelin](https://github.com/OpenZeppelin/zeppelin-solidity)

## Comments
### GimmerCrowdSale and GimmerCrowdSaleB

GimmerCrowdSale: Default version inheriting Crowdsale contract directly from OpenZeppelin.
As we overwrite a lot of what is done on the Crowdsale:
- GMR tokens use 8 decimal places, which means we need to divide and truncate on transactions (different than the standard rate)
- The end date is cached and checked by the stage changing functions.
With that in mind we have GimmerCrowdSaleB, which is exactly the same as the GimmerCrowdSale but it only inherits from Ownable, and the Crowdsale functions are copy-pasted and modified as needed from the OpenZeppelin contract. This allows us to have a much lighter contract, as the inheriting was creating a lot of redundancy.

Quick comparison of bytecode size:
GimmerCrowdSale: 23426, 14934 (deployed)
GimmerCrowdSaleB: 15470, 7124 (deployed)