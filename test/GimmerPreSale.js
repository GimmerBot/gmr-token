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

async function doBuy(crowdSale, acc, amount, expectedPrice) {
    var mainAcc_start_tokenBalance = await crowdSale.balanceOf(acc);
    await crowdSale.send(amount.toString());
    var mainAcc_end_tokenBalance = await crowdSale.balanceOf(acc);

    var dif = mainAcc_end_tokenBalance.sub(mainAcc_start_tokenBalance);
    var tokensBought = amount.div(expectedPrice).truncated(); // solidity truncates
    assert.equal(dif.toString(), tokensBought.toString(), "Main account should buy return a specific amount for each phase");

    return tokensBought;
}

contract ('GimmerPreSale', async function (caccounts) {
    var mainAcc = caccounts[0];
    var secAcc = caccounts[1];
    var thirdAcc = caccounts[2];

    // List of Functions
    
    before(async function() {
        this.startTime = latestTime() + duration.weeks(1);
        this.endTime =   this.startTime + duration.weeks(1);
        this.afterEndTime = this.endTime + duration.seconds(1);
    
        this.crowdsale = await GimmerPreSale.new(this.startTime, this.endTime, PreSalePrice, PreSaleBonusPrice, secAcc);
        this.totalBought = new BigNumber(0);
    });

    describe('KYC Tests', function(){
        it('Should wait till campaign starts', async function () {
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

        it('Should not approve KYC executing from secondary account', async function () {
            var crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(mainAcc).should.be.rejectedWith(EVMThrow);
        });

        it('Should approve KYC when executing from third account', async function () {
            var crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(mainAcc, {from:thirdAcc});
            var userHasKyc = await crowdSale.userHasKYC(mainAcc);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject buying more than pre sale cap - ' + PreSaleTokenCap.mul(PreSaleBonusPrice).add(PreSaleBonusPrice).div(EthToWei) + ' ETH', async function () {
            var amount = PreSaleTokenCap.mul(PreSaleBonusPrice).add(PreSaleBonusPrice);
            var crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
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

        it('Should buy the rest of the tokens to reach the pre sale cap: ' + PreSaleTokenCap + ' ETH', async function () {
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

    // describe('KYC Tests', function(){
    //     it('Should wait till campaign starts', async function () {
    //         await increaseTimeTo(this.startTime);
    //         await advanceBlock();
    //     });

    //     it('Should change KYC Manager to third account', async function () {
    //         var crowdSale = this.crowdsale;

    //         var startKycManager = await crowdSale.kycManager();
    //         await crowdSale.setKYCManager(thirdAcc);
    //         var endKycManager = await crowdSale.kycManager();
            
    //         assert.equal(startKycManager, secAcc, "KYC Manager should start as second account");
    //         assert.equal(endKycManager, thirdAcc, "KYC Manager should end as third account");
    //     });

    //     it('Should not approve KYC executing from secondary account', async function () {
    //         var crowdSale = this.crowdsale;
    //         await crowdSale.approveUserKYC(mainAcc).should.be.rejectedWith(EVMThrow);
    //     });

    //     it('Should approve KYC when executing from third account', async function () {
    //         var crowdSale = this.crowdsale;
    //         await crowdSale.approveUserKYC(mainAcc, {from:thirdAcc});
    //         var userHasKyc = await crowdSale.userHasKYC(mainAcc);
    //         assert.equal(userHasKyc, true, "KYC has not been flagged");
    //     });

    //     it('Should buy 1 ETH worth of tokens at PreSale', async function () {
    //         var crowdSale = this.crowdsale;
    //         await doBuy(crowdSale, mainAcc, EthToWei, 1, PreSalePrice);
    //     });

    //     it('Should reject buying tokens after end', async function () {
    //         await increaseTimeTo(this.afterEndTime);
    //         await advanceBlock();

    //         var amount = 1;
    //         var crowdSale = this.crowdsale;
    //         await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
    //     });
    // });
});