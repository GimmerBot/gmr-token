// Allows us to use ES6 in our migrations and tests.
require('babel-register')
require('babel-polyfill')

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8546,
      network_id: "*", // Match any network id
      from: "3e86Fe56342a9A3e2476eb2Aeb508459cBF1364F"
    },
    rinkeby: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      from: "3e86Fe56342a9A3e2476eb2Aeb508459cBF1364F",
      gas: 4712388
    },
    ganache: {
      host: "localhost",
      port: 4020,
      network_id: "*", // Match any network id
      from: "627306090abaB3A6e1400e9345bC60c78a8BEf57",
    }
    //,
    //live: {
    //  host: "178.25.19.88", // Random IP for example purposes (do not use)
    //  port: 80,
    //  network_id: 1,        // Ethereum public network
    //  // optional config values:
    //  // gas
    //  // gasPrice
    //  // from - default address to use for any transaction Truffle makes during migrations
    //  // provider - web3 provider instance Truffle should use to talk to the Ethereum network.
    //  //          - if specified, host and port are ignored.
    //}
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};