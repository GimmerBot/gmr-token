//var GimmerToken = artifacts.require("./GimmerTokenSale.sol");

function getNow() {
    return new Number(((new Date).getTime()) / 1000.0);
}
function minutesToSeconds(minutes) {
    return minutes * 60; // minutes * 60 seconds * 1000
}
function addFromNow(minutes) {
    return getNow() + minutesToSeconds(minutes);
}
function a(minutes) {
    return Math.trunc(addFromNow(minutes));
}

module.exports = function(deployer) {
    // deployer.deploy(GimmerCrowdSale, // give the address of the crowd sale
    //     a(30),
    //     [13158496, 13980902, 14803308, 15625714, 16448122], // GMR token prices
    //     [a(1400), a(2880), a(4320), a(5760), a(7200)], // GMR token dates, in Unix time
    //     5 * Math.pow(10, 18), // maximum amount of Wei the person can spend without KYC        
    //     0x204d8e205bedc8e12bfc158cba6583966117e3c5, // frozen wallet address
    //     11263626 // pre sale bonus price
    // ); 

    //0000000000000000000000008c789463412b2697185e103ded5f75b9b3931a84000000000000000000000000bb3628807c424b58b8db1ae5e304255b84581af1

    // deployer.deploy(GimmerPreSale, // give the address of the crowd saleddd
    //     "0x8c789463412b2697185e103ded5f75b9b3931a84",// WEI holder
    //     "0xbb3628807c424b58b8db1ae5e304255b84581af1" // KYC manager wallet
    // );//kovan network

    // deployer.deploy(GimmerPreSale, // give the address of the crowd saleddd
    //     "0x204d8e205bedc8e12bfc158cba6583966117e3c5",// WEI holder
    //     "0x6c9e345b09ac4842a4fab60fa68c386e2b11540b" // KYC manager wallet
    // );//rinkeby accounts

    // deployer.deploy(GimmerPreSale, // give the address of the crowd saleddd
    //     "0x627306090abab3a6e1400e9345bc60c78a8bef57",// WEI holder
    //     "0xf17f52151ebef6c7334fad080c5704d77216b732" // KYC manager wallet
    // );//ganache cli

    // deployer.deploy(GimmerPreSale, // give the address of the crowd saleddd
    //     "0xc5fdf4076b8f3a5357c5e395ab970b5b54098fef", // WEI holder
    //     "0x821aea9a577a9b44299b9c15c88cf3087f3b5544" // KYC manager wallet
    // );//truffle test network
    
};