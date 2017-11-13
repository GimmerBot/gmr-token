var GimmerToken = artifacts.require("./GimmerToken.sol");
var GimmerCrowdSale = artifacts.require("./GimmerCrowdSale.sol");
//var GimmerCrowdSaleB = artifacts.require("./GimmerCrowdSaleB.sol");

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
    return deployer.deploy(GimmerCrowdSale, // give the address of the crowd sale
        a(30),
        [13158496, 13980902, 14803308, 15625714, 16448122], // GMR token prices
        [a(1440), a(2880), a(4320), a(5760), a(7200)], // GMR token dates, in Unix time
        5 * Math.pow(10, 18), // maximum amount of Wei the person can spend without KYC
        1 * Math.pow(10, 8), // minimum amount of tokens the person can buy (1 GMR token and the 8 digits)
        50 * Math.pow(10, 8), // pre sale token cap
        90 * Math.pow(10, 6) * Math.pow(10, 8) // token sale cap
    ); 

    // return deployer.deploy(GimmerCrowdSaleB, // give the address of the crowd sale
    //     a(30),
    //     [13158496, 13980902, 14803308, 15625714, 16448122], // GMR token prices
    //     [a(1440), a(2880), a(4320), a(5760), a(7200)], // GMR token dates, in Unix time
    //     1 * Math.pow(10, 8), // minimum amount of tokens the person can buy (1 GMR token and the 8 digits)
    //     50000000000000000000, // temporarily 50 Eth //17106045000000000000000,// pre sale limit in WEI (17106 ethers/13 mil GMR tokens)
    //     379982636313, // No KYC 5 ETH limit
    //     90000000 * Math.pow(10, 8) // maximum ammount of tokens that can be sold during the entire sale
    // ); 
};