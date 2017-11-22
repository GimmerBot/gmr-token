import {advanceBlock} from '../submodules/zeppelin-gimmer/test/helpers/advanceToBlock'
import {increaseTimeTo, duration} from '../submodules/zeppelin-gimmer/test/helpers/increaseTime'
import latestTime from '../submodules/zeppelin-gimmer/test/helpers/latestTime'
import EVMThrow from '../submodules/zeppelin-gimmer/test/helpers/EVMThrow'
const BigNumber = web3.BigNumber

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should()

var GimmerPreSale = artifacts.require("./GimmerPreSale.sol");

var EthToWei = new BigNumber(10).pow(18);
var ToToken = new BigNumber(10).pow(8);

var PreSalePrice = new BigNumber(13158496);
var PreSaleBonusPrice = new BigNumber(11263626);

var MinTokenTransaction = ToToken;
var _1Eth = EthToWei;

var StartDate = latestTime() + duration.minutes(31);
var EndDate = latestTime() + duration.minutes(1441);

var PreSaleWeiCap = new BigNumber(10000).mul(ToToken) // 5000 tokens presale cap
                        .mul(PreSalePrice).add(PreSalePrice);
var Phase1_1EthWorth = EthToWei.div(PreSalePrice).truncated();

async function doBuy(acc, amount, expectedStage, expectedPrice) {
    var crowdSale = await GimmerPreSale.deployed();

    var mainAcc_start_tokenBalance = await crowdSale.balanceOf(acc);
    await crowdSale.send(amount.toString());
    var mainAcc_end_tokenBalance = await crowdSale.balanceOf(acc);

    var dif = mainAcc_end_tokenBalance.sub(mainAcc_start_tokenBalance);
    var tokensBought = amount.div(expectedPrice).truncated(); // solidity truncates
    assert.equal(dif.toString(), tokensBought.toString(), "Main account should buy return a specific amount for each phase");
}

contract ('GimmerPreSale', function (caccounts) {
    var mainAcc = caccounts[0];
    var secAcc = caccounts[1];

    // List of Functions
    
    before(async function() {
        //Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
        await increaseTimeTo(StartDate);
        await advanceBlock();
    });

    describe('Stage: PreSale (Phase 1)', function(){
        it('Should change KYC Manager to secondary account', async function () {
            var crowdSale = await GimmerPreSale.deployed();

            var startKycManager = await crowdSale.getKYCManager();
            await crowdSale.setKYCManager(secAcc);
            var endKycManager = await crowdSale.getKYCManager();
            
            assert.equal(startKycManager, mainAcc, "KYC Manager should start as main account");
            assert.equal(endKycManager, secAcc, "KYC Manager should end as secondary account");
        });

        it('Should not approve KYC executing from main account', async function () {
            var crowdSale = await GimmerPreSale.deployed();
            await crowdSale.approveUserKYC(mainAcc).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying more than KYC limit without approval ' + EthToWei.div(EthToWei) + ' ETH', async function () {
            var amount = PreSaleWeiCap.minus(EthToWei).add(PreSalePrice);
            var crowdSale = await GimmerPreSale.deployed();
            
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should approve KYC when executing from secondary account', async function () {
            var crowdSale = await GimmerPreSale.deployed();
            await crowdSale.approveUserKYC(mainAcc, {from:secAcc});
            var userHasKyc = await crowdSale.userHasKYC(mainAcc);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should buy 1 ETH worth of tokens at PreSale', async function () {
            await doBuy(mainAcc, EthToWei, 1, PreSalePrice);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(EndDate);
            await advanceBlock();

            var amount = 1;
            var crowdSale = await GimmerPreSale.deployed();
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });
    });
});