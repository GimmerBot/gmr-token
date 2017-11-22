import {advanceBlock} from '../submodules/zeppelin-gimmer/test/helpers/advanceToBlock'
import {increaseTimeTo, duration} from '../submodules/zeppelin-gimmer/test/helpers/increaseTime'
import latestTime from '../submodules/zeppelin-gimmer/test/helpers/latestTime'
//import EVMThrow from '../submodules/zeppelin-gimmer/test/helpers/EVMThrow'
const EVMThrow = 'VM Exception while processing transaction: revert'; // Ganache/TestRPC
const BigNumber = web3.BigNumber

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should()

var GimmerPreSale = artifacts.require("./GimmerPreSale.sol");

var EthToWei = new BigNumber(10).pow(18);
var ToToken = new BigNumber(10).pow(8);
var ToMillion = new BigNumber(10).pow(6);

var PreSalePrice = new BigNumber(13158496);
var PreSaleBonusPrice = new BigNumber(11263626);

var MinTokenTransaction = ToToken;
var _1Eth = EthToWei;

var StartDate = latestTime() + duration.minutes(31);
var EndDate = latestTime() + duration.minutes(1441);

var PreSaleTokenCap = new BigNumber(15).mul(ToMillion).mul(ToToken); // 15 mil tokens presale cap
var MinimumWeiTransaction = EthToWei;

function log(str){
    new Promise(function() { console.log(str); });
}

async function doBuy(crowdSale, acc, weiAmount, expectedPrice) {
    var mainAcc_start_tokenBalance = await crowdSale.balanceOf(acc);
    await crowdSale.send(weiAmount.toString());
    var mainAcc_end_tokenBalance = await crowdSale.balanceOf(acc);

    var dif = mainAcc_end_tokenBalance.sub(mainAcc_start_tokenBalance);
    var tokensBought = weiAmount.div(expectedPrice).truncated(); // solidity truncates
    assert.equal(dif.toString(), tokensBought.toString(), "Main account should buy return a specific amount for each phase");

    return tokensBought;
}

contract ('GimmerPreSale', async function (caccounts) {
    var mainAcc = caccounts[0];
    var secAcc = caccounts[1];
    var thirdAcc = caccounts[2];

    describe('KYC Tests', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime =   this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(this.startTime, this.endTime, PreSalePrice, PreSaleBonusPrice, thirdAcc, secAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should change KYC Manager to third account', async function () {
            var crowdSale = this.crowdsale;

            var startKycManager = await crowdSale.kycManager();
            await crowdSale.setKYCManager(thirdAcc);
            var endKycManager = await crowdSale.kycManager();
            
            assert.equal(startKycManager, secAcc, "KYC Manager should start as second account");
            assert.equal(endKycManager, thirdAcc, "KYC Manager should end as third account");
        });

        it('Should not approve KYC when executing from secondary account', async function () {
            var crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(mainAcc).should.be.rejectedWith(EVMThrow);
        });

        it('Should approve KYC when executing from third account', async function () {
            var crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(mainAcc, {from:thirdAcc});
            var userHasKyc = await crowdSale.userHasKYC(mainAcc);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject buying more than PreSale cap: ' + PreSaleTokenCap.mul(PreSaleBonusPrice).add(PreSaleBonusPrice).div(EthToWei) + ' ETH', async function () {
            var amount = PreSaleTokenCap.mul(PreSaleBonusPrice).add(PreSaleBonusPrice);
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying less than minimum Wei', async function () {
            var amount = MinimumWeiTransaction.sub(1);
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy exactly the minimum (1 ETH)', async function () {
            var crowdSale = this.crowdsale;
            var tokens = await doBuy(crowdSale, mainAcc, new BigNumber(1).mul(EthToWei), PreSalePrice);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 300 ETH worth of tokens at PreSale', async function () {
            var crowdSale = this.crowdsale;
            var tokens = await doBuy(crowdSale, mainAcc, new BigNumber(300).mul(EthToWei), PreSalePrice);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 500 ETH worth of tokens at PreSale', async function () {
            var crowdSale = this.crowdsale;
            var tokens = await doBuy(crowdSale, mainAcc, new BigNumber(500).mul(EthToWei), PreSalePrice);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 3000 ETH worth of tokens at PreSale', async function () {
            var crowdSale = this.crowdsale;
            var tokens = await doBuy(crowdSale, mainAcc, new BigNumber(3000).mul(EthToWei), PreSalePrice);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 3000.000000000000000001 ETH worth of tokens at PreSale (custom price)', async function () {
            var crowdSale = this.crowdsale;
            var tokens = await doBuy(crowdSale, mainAcc, new BigNumber(3000).mul(EthToWei).add(1), PreSaleBonusPrice);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 5000 ETH worth of tokens at PreSale (custom price)', async function () {
            var crowdSale = this.crowdsale;
            var tokens = await doBuy(crowdSale, mainAcc, new BigNumber(5000).mul(EthToWei).add(1), PreSaleBonusPrice);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy the rest of the tokens to reach the PreSale cap (' + PreSaleTokenCap + ' GMR)', async function () {
            var crowdSale = this.crowdsale;
            var rest = PreSaleTokenCap.sub(this.totalBought);
            var val = this.totalBought;
            
            // calculate how much wei to send based on the total left on contract
            var total = new BigNumber(rest).mul(PreSaleBonusPrice);
            var tokens = await doBuy(crowdSale, mainAcc, total, PreSaleBonusPrice);
            
            this.totalBought = this.totalBought.add(tokens);

            var tokensSold = await crowdSale.tokensSold();
            assert(tokensSold, this.totalBought, "Should've bought all the tokens in the PreSale contract");
        });

        it('Should reject buying tokens after sale has reached its cap', async function () {
            var amount = 1;
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            var amount = 1;
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('1 Person Buys All', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime =   this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(this.startTime, this.endTime, PreSalePrice, PreSaleBonusPrice, thirdAcc, secAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should approve KYC of the primary account', async function () {
            var crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(mainAcc, {from:secAcc});
            var userHasKyc = await crowdSale.userHasKYC(mainAcc);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject buying more than PreSale cap: ' + PreSaleTokenCap.mul(PreSaleBonusPrice).add(PreSaleBonusPrice).div(EthToWei) + ' ETH', async function () {
            var amount = PreSaleTokenCap.mul(PreSaleBonusPrice).add(PreSaleBonusPrice);
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy the entire PreSale cap (' + PreSaleTokenCap + ' GMR)', async function () {
            var crowdSale = this.crowdsale;
            var rest = PreSaleTokenCap.sub(this.totalBought);
            var val = PreSaleTokenCap;
            
            // calculate how much wei to send based on the total left on contract
            var total = new BigNumber(rest).mul(PreSaleBonusPrice);
            var tokens = await doBuy(crowdSale, mainAcc, total, PreSaleBonusPrice);
            this.totalBought = this.totalBought.add(tokens);

            var tokensSold = await crowdSale.tokensSold();
            assert(tokensSold, PreSaleTokenCap, "Should've bought all the tokens in the PreSale contract");
        });

        it('Should reject buying tokens after sale has reached its cap', async function () {
            var amount = 1;
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            var amount = 1;
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('3 Investors', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime =   this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(this.startTime, this.endTime, PreSalePrice, PreSaleBonusPrice, thirdAcc, secAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should approve KYC of the primary account', async function () {
            var crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(mainAcc, {from:secAcc});
            var userHasKyc = await crowdSale.userHasKYC(mainAcc);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject buying more than PreSale cap: ' + PreSaleTokenCap.mul(PreSaleBonusPrice).add(PreSaleBonusPrice).div(EthToWei) + ' ETH', async function () {
            var amount = PreSaleTokenCap.mul(PreSaleBonusPrice).add(PreSaleBonusPrice);
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 3500 ETH worth of tokens at PreSale (custom price)', async function () {
            var crowdSale = this.crowdsale;
            var tokens = await doBuy(crowdSale, mainAcc, new BigNumber(3500).mul(EthToWei), PreSaleBonusPrice);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 4500 ETH worth of tokens at PreSale (custom price)', async function () {
            var crowdSale = this.crowdsale;
            var tokens = await doBuy(crowdSale, mainAcc, new BigNumber(4500).mul(EthToWei), PreSaleBonusPrice);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 7000 ETH worth of tokens at PreSale (custom price)', async function () {
            var crowdSale = this.crowdsale;
            var tokens = await doBuy(crowdSale, mainAcc, new BigNumber(7000).mul(EthToWei), PreSaleBonusPrice);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy the rest of the tokens to reach the PreSale cap (' + PreSaleTokenCap + ' GMR)', async function () {
            var crowdSale = this.crowdsale;
            var rest = PreSaleTokenCap.sub(this.totalBought);
            var val = this.totalBought;
            
            // calculate how much wei to send based on the total left on contract
            var total = new BigNumber(rest).mul(PreSalePrice);
            var tokens = await doBuy(crowdSale, mainAcc, total, PreSalePrice);
            this.totalBought = this.totalBought.add(tokens);

            var tokensSold = await crowdSale.tokensSold();
            assert(tokensSold, this.totalBought, "Should've bought all the tokens in the PreSale contract");
        });

        it('Should reject buying tokens after sale has reached its cap', async function () {
            var amount = 1;
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            var amount = 1;
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('3 Investors Pause Test', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime =   this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(this.startTime, this.endTime, PreSalePrice, PreSaleBonusPrice, thirdAcc, secAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should approve KYC of the primary account', async function () {
            var crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(mainAcc, {from:secAcc});
            var userHasKyc = await crowdSale.userHasKYC(mainAcc);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should pause the contract', async function () {
            var crowdSale = this.crowdsale;
            await crowdSale.pause();
            var isPaused = await crowdSale.paused();
            assert.equal(isPaused, true, "Contract should be paused");
        });

        it('Should reject buying the minimum amount (1 ETH) when paused', async function () {
            var crowdSale = this.crowdsale;
            await crowdSale.send(EthToWei.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying 3500 ETH when paused', async function () {
            var crowdSale = this.crowdsale;
            await crowdSale.send(new BigNumber(3500).mul(EthToWei).toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should unpause the contract', async function () {
            var crowdSale = this.crowdsale;
            await crowdSale.unpause();
            var isPaused = await crowdSale.paused();
            assert.equal(isPaused, false, "Contract should be unpaused");
        });

        it('Should buy 3500 ETH worth of tokens at PreSale (custom price)', async function () {
            var crowdSale = this.crowdsale;
            var tokens = await doBuy(crowdSale, mainAcc, new BigNumber(3500).mul(EthToWei), PreSaleBonusPrice);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 4500 ETH worth of tokens at PreSale (custom price)', async function () {
            var crowdSale = this.crowdsale;
            var tokens = await doBuy(crowdSale, mainAcc, new BigNumber(4500).mul(EthToWei).add(1), PreSaleBonusPrice);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 7000 ETH worth of tokens at PreSale (custom price)', async function () {
            var crowdSale = this.crowdsale;
            var tokens = await doBuy(crowdSale, mainAcc, new BigNumber(7000).mul(EthToWei).add(1), PreSaleBonusPrice);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy the rest of the tokens to reach the PreSale cap (' + PreSaleTokenCap + ' GMR)', async function () {
            var crowdSale = this.crowdsale;
            var rest = PreSaleTokenCap.sub(this.totalBought);
            var val = this.totalBought;
            
            // calculate how much wei to send based on the total left on contract
            var total = new BigNumber(rest).mul(PreSalePrice);
            var tokens = await doBuy(crowdSale, mainAcc, total, PreSalePrice);
            log('   Bought ' + tokens);

            this.totalBought = this.totalBought.add(tokens);

            var tokensSold = await crowdSale.tokensSold();
            assert(tokensSold, this.totalBought, "Should've bought all the tokens in the PreSale contract");
        });

        it('Should reject buying tokens after sale has reached its cap', async function () {
            var amount = 1;
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            var amount = 1;
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });
    });
});