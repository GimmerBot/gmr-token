var GimmerToken = artifacts.require("./GimmerToken.sol");
var GimmerCrowdSale = artifacts.require("./GimmerCrowdSale.sol");
//var GimmerFoundation = artifacts.require("./GimmerFoundation.sol");

function getNow(){
  return new Number(((new Date).getTime()) / 1000.0);
}
function minutesToSeconds(minutes){
  return minutes * 60; // minutes * 60 seconds * 1000
}
function addFromNow(minutes){
  return getNow() + minutesToSeconds(minutes);
}
function a(minutes){
 return Math.trunc(addFromNow(minutes));
}

module.exports = function(deployer) {
  deployer.deploy(GimmerToken).then(function(){
    return deployer.deploy(GimmerCrowdSale, // give the address of the crowd sale
      [13158496, 13980902, 14803308, 15625714, 16448122], // GMR token prices
      [a(0), a(5), a(10), a(15), a(20)], // GMR token dates, in linux time
      1 * Math.pow(10, 8), // minimum amount of tokens the person can buy (1 GMR token and the 8 digits)
      GimmerToken.address,// token address/owner of contract
      17106045000000000000000,// pre sale limit in WEI (17106 ethers/13 mil GMR tokens)
      379982636313// No KYC 5 ETH limit
    ); 
  });
};