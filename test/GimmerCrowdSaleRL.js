import {advanceBlock} from '../submodules/zeppelin-gimmer/test/helpers/advanceToBlock'
import {increaseTimeTo, duration} from '../submodules/zeppelin-gimmer/test/helpers/increaseTime'
import latestTime from '../submodules/zeppelin-gimmer/test/helpers/latestTime'
import EVMThrow from '../submodules/zeppelin-gimmer/test/helpers/EVMThrow'
const BigNumber = web3.BigNumber

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should()

var GimmerToken = artifacts.require("./GimmerToken.sol");
var GimmerCrowdSale = artifacts.require("./GimmerCrowdSale.sol");

var EthToWei = new BigNumber(10).pow(18);
var ToToken = new BigNumber(10).pow(8);

var Phase1Price = new BigNumber(13158496);
var Phase2Price = new BigNumber(13980902);
var Phase3Price = new BigNumber(14803308);
var Phase4Price = new BigNumber(15625714);
var Phase5Price = new BigNumber(16448122);
var AfterSalePrice = new BigNumber(32896244);

var MinTokenTransaction = ToToken;
var _1Eth = EthToWei;

var StartDate;
var Phase1Date;
var Phase2Date;
var Phase3Date;
var Phase4Date;
var Phase5Date;

var PreSaleWeiCap = new BigNumber(5000).mul(ToToken) // 5000 tokens presale cap
                        .mul(Phase1Price).add(Phase1Price);
var Phase1_1EthWorth = EthToWei.div(Phase1Price).truncated();

async function checkTokenPrice(price) {
    var crowdSale = await GimmerCrowdSale.deployed();
    await crowdSale.forceUpdateState(); // force update so we'll have to get
    var value = await crowdSale.getTokenPrice.call();
    assert.equal(value.toString(), price.toString(), "getTokenPrice returned incorrect pricing for current phase");
}

async function doBuy(acc, amount, expectedStage, expectedPrice) {
    var crowdSale = await GimmerCrowdSale.deployed();
    var token = new GimmerToken(await crowdSale.getTokenContract.call());

    var contractStage = await crowdSale.getCurrentStage.call();
    var mainAcc_start_tokenBalance = await token.balanceOf(acc);
    var currentTokenPrice = await crowdSale.getTokenPrice.call();
    await crowdSale.send(amount.toString());
    var mainAcc_end_tokenBalance = await token.balanceOf(acc);

    assert.equal(contractStage, expectedStage, "Contract should be in Stage " + expectedStage);
    assert.equal(currentTokenPrice.toString(), expectedPrice.toString(), "Contract is showing wrong price for the current phase");
    
    var dif = mainAcc_end_tokenBalance.sub(mainAcc_start_tokenBalance);
    var tokensBought = amount.div(expectedPrice).truncated(); // solidity truncates
    assert.equal(dif.toString(), tokensBought.toString(), "Main account should buy return a specific amount for each phase");
}

contract ('GimmerCrowdSale', function (caccounts) {
    var mainAcc = caccounts[0];
    var secAcc = caccounts[1];

    // List of Functions
    
    before(async function() {
        //Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
        await advanceBlock();

        StartDate = latestTime() + duration.minutes(31);
        Phase1Date = latestTime() + duration.minutes(1441);
        Phase2Date = latestTime() + duration.minutes(2881);
        Phase3Date = latestTime() + duration.minutes(4321);
        Phase4Date = latestTime() + duration.minutes(5761);
        Phase5Date = latestTime() + duration.minutes(7201);
    });

    describe('Deploying Token Sale', function() {
        it('Reject sending 1 Wei to contract', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.send(1).should.be.rejectedWith(EVMThrow);
        });

        it('Should deploy the contract to stage 1 - PreSale', async function()
        {
            var crowdSale = await GimmerCrowdSale.deployed();
            var initialStage = await crowdSale.getCurrentStage.call();
            
            await increaseTimeTo(StartDate);
            await advanceBlock();

            // force update
            await crowdSale.forceUpdateState();
            var endStage = await crowdSale.getCurrentStage.call();

            assert.equal(initialStage.toNumber(), 0, "Contract should start in stage of Deployment");
            assert.equal(endStage.toNumber(), 1, "Contract should end in stage of PreSale");
        });

        it('Token Price should equal the price for Phase 5', async function () {
            await checkTokenPrice(Phase1Price);
        });
    });
    
    describe('Stage: PreSale (Phase 1)', function(){
        it ('Should be at PreSale/Phase 1', async function() {
            var crowdSale = await GimmerCrowdSale.deployed();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractPhase = await crowdSale.getCurrentTokenPricePhase.call();
            
            assert.equal(contractStage.toNumber(), 1, "Contract is in incorrect stage");
            assert.equal(contractPhase.toNumber(), 0, "Contract is in incorrect phase");
        });

        it('Reject buying less than minimal limit', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = MinTokenTransaction.add(-1);
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 1 ETH worth of tokens at PreSale', async function () {
            await doBuy(mainAcc, _1Eth, 1, Phase1Price);
        });
        
        it('Should change KYC Manager to secondary account', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();

            var startKycManager = await crowdSale.getKYCManager();
            await crowdSale.setKYCManager(secAcc);
            var endKycManager = await crowdSale.getKYCManager();
            
            assert.equal(startKycManager, mainAcc, "KYC Manager should start as main account");
            assert.equal(endKycManager, secAcc, "KYC Manager should end as secondary account");
        });

        it('Should not approve KYC executing from main account', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.approveUserKYC(mainAcc).should.be.rejectedWith(EVMThrow);
        });

        it('Should approve KYC when executing from secondary account', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.approveUserKYC(mainAcc, {from:secAcc});
            var userHasKyc = await crowdSale.userHasKYC(mainAcc);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject buying more than pre sale cap - ' + PreSaleWeiCap.minus(EthToWei).add(Phase1Price), async function () {
            var amount = PreSaleWeiCap.minus(EthToWei).add(Phase1Price);
            var crowdSale = await GimmerCrowdSale.deployed();
            
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy the rest of the tokens to reach the PreSaleCap: ' + PreSaleWeiCap.minus(EthToWei), async function () {
            await doBuy(mainAcc, PreSaleWeiCap.minus(EthToWei), 1, Phase1Price);
        });

        it('Reject payments after presale cap', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.buy.call({from: mainAcc, value:1}).should.be.rejectedWith(EVMThrow)
        });

        it('Token Price should equal the price for Phase 1', async function () {
            await checkTokenPrice(Phase1Price);
        });
    });

    describe('Stage: Sale (Phase 2)', function() {
        it ('Should jump to phase 2 start time', async function() {
            await increaseTimeTo(Phase1Date);
            await advanceBlock();
            
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.forceUpdateState();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractPhase = await crowdSale.getCurrentTokenPricePhase.call();
            
            assert.equal(contractStage.toNumber(), 2, "Contract is in incorrect stage");
            assert.equal(contractPhase.toNumber(), 1, "Contract is in incorrect phase");
        });

        it('Reject buying less than minimal limit', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(7));
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 1 ETH worth of tokens at Sale', async function () {
            await doBuy(mainAcc, _1Eth, 2, Phase2Price);
        });

        it('Token Price should equal the price for Phase 2', async function () {
            await checkTokenPrice(Phase2Price);
        });
    });

    describe('Stage: Sale (Phase 3)', function(){
        it ('Should jump to phase 3 start time', async function() {
            await increaseTimeTo(Phase2Date);
            await advanceBlock();
            
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.forceUpdateState();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractPhase = await crowdSale.getCurrentTokenPricePhase.call();
            
            assert.equal(contractStage.toNumber(), 2, "Contract is in incorrect stage");
            assert.equal(contractPhase.toNumber(), 2, "Contract is in incorrect phase");
        });

        it('Reject buying less than minimal limit', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(7));
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 1 ETH worth of tokens at Sale', async function () {
            await doBuy(mainAcc, _1Eth, 2, Phase3Price);
        });

        it('Token Price should equal the price for Phase 3', async function () {
            await checkTokenPrice(Phase3Price);
        });
    });

    describe('Stage: Sale (Phase 4)', function(){
        it ('Should jump to phase 4 start time', async function() {
            await increaseTimeTo(Phase3Date);
            await advanceBlock();
            
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.forceUpdateState();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractPhase = await crowdSale.getCurrentTokenPricePhase.call();

            assert.equal(contractStage.toNumber(), 2, "Contract is in incorrect stage");
            assert.equal(contractPhase.toNumber(), 3, "Contract is in incorrect phase");
        });

        it('Reject buying less than minimal limit', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(7));
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 1 ETH worth of tokens at Sale', async function () {
            await doBuy(mainAcc, _1Eth, 2, Phase4Price);
        });

        it('Token Price should equal the price for Phase 4', async function () {
            await checkTokenPrice(Phase4Price);
        });
    });

    describe('Stage: Sale (Phase 5)', function(){
        it ('Should jump to phase 5 start time', async function() {
            await increaseTimeTo(Phase4Date);
            await advanceBlock();
            
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.forceUpdateState();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractPhase = await crowdSale.getCurrentTokenPricePhase.call();

            assert.equal(contractStage.toNumber(), 2, "Contract is in incorrect stage");
            assert.equal(contractPhase.toNumber(), 4, "Contract is in incorrect phase");
        });

        it('Reject buying less than minimal limit', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(7));
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 1 ETH worth of tokens at Sale', async function () {
            await doBuy(mainAcc, _1Eth, 2, Phase5Price);
        });

        it('Token Price should equal the price for Phase 5', async function () {
            await checkTokenPrice(Phase5Price);
        });
    });

    describe('Stage: FinishedSale', function(){
        it ('Should jump to after sale start time', async function() {
            await increaseTimeTo(Phase5Date);
            await advanceBlock();
            
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.forceUpdateState();
            var contractStage = await crowdSale.getCurrentStage.call();

            assert.equal(contractStage.toNumber(), 3, "Contract is in incorrect stage");
        });

        it('Reject sending 1 Wei to contract', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.send(1).should.be.rejectedWith(EVMThrow);
        });
    });
});