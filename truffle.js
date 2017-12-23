// Allows us to use ES6 in our migrations and tests.
require('babel-register');
require('babel-polyfill');
var HDWalletProvider = require("truffle-hdwallet-provider");

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
            gasPrice: 30000000000 // 30 GWei
        },
        coverage: {
            host: "localhost",
            port: 8555,         // <-- If you change this, also set the port option in .solcover.js.
            network_id: "*",
            gas: 0xfffffffffff,
            gasPrice: 0x01 // low gas price
        }
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    }
};