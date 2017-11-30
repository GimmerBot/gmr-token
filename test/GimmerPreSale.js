import {advanceBlock} from '../submodules/zeppelin-gimmer/test/helpers/advanceToBlock'
import {increaseTimeTo, duration} from '../submodules/zeppelin-gimmer/test/helpers/increaseTime'
import latestTime from '../submodules/zeppelin-gimmer/test/helpers/latestTime'
//import EVMThrow from '../submodules/zeppelin-gimmer/test/helpers/EVMThrow'
const EVMThrow = 'VM Exception while processing transaction: revert'; // Ganache/TestRPC
const BigNumber = web3.BigNumber;

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const GimmerPreSale = artifacts.require("./GimmerPreSale.sol");

const EthToWei = new BigNumber(10).pow(18);
const ToToken = new BigNumber(10).pow(18);
const ToMillion = new BigNumber(10).pow(6);

// constants from contract

const PRE_SALE_BONUS_1_WEI_MIN = new BigNumber(3000).mul(EthToWei);
const PRE_SALE_BONUS_2_WEI_MIN = new BigNumber(300).mul(EthToWei);

const TOKEN_RATE_BAND_1 = new BigNumber(1400);
const TOKEN_RATE_BAND_2 = new BigNumber(1300);
const TOKEN_RATE_BAND_3 = new BigNumber(1250);

const START_TIME = new BigNumber(1511524800);
const END_TIME = new BigNumber(1514894400);
const PRE_SALE_WEI_MIN_TRANSACTION = new BigNumber(30).mul(EthToWei);

const PRE_SALE_TOKEN_CAP = new BigNumber(15).mul(ToMillion).mul(ToToken); // 15 mil tokens presale cap

function log(str){
    new Promise(function() { console.log(str); });
}

async function doBuy(crowdSale, acc, weiAmount, expectedRate) {
    const actualValue = weiAmount.truncated();
    const contractOwnerAcc_start_tokenBalance = await crowdSale.balanceOf(acc);

    const value = actualValue;//.toString(10);
    await crowdSale.sendTransaction({value: actualValue, from: acc});

    const contractOwnerAcc_end_tokenBalance = await crowdSale.balanceOf(acc);

    const dif = contractOwnerAcc_end_tokenBalance.sub(contractOwnerAcc_start_tokenBalance);
    const tokensBought = actualValue.mul(expectedRate);
    assert.equal(dif.truncated().toString(10), tokensBought.truncated().toString(10), "Main account should return a specific amount");

    return tokensBought;
}

function getRate(weiAmount) {
    if (weiAmount >= PRE_SALE_BONUS_1_WEI_MIN)
    {
        return TOKEN_RATE_BAND_1;
    }
    return weiAmount >= PRE_SALE_BONUS_2_WEI_MIN ? TOKEN_RATE_BAND_2 : TOKEN_RATE_BAND_3;
}

function getTokenRate(tokenAmount){
    var rate = TOKEN_RATE_BAND_1;
    var weiAmount = tokenAmount.mul(rate);

    if (weiAmount <= PRE_SALE_BONUS_1_WEI_MIN) {
        rate = TOKEN_RATE_BAND_2;
        weiAmount = tokenAmount.mul(rate);

        if (weiAmount <= PRE_SALE_BONUS_2_WEI_MIN) {
            rate = TOKEN_RATE_BAND_3;
        }
    }

    return rate;
}

contract ('GimmerPreSale', async function (caccounts) {
    const contractOwnerAcc = caccounts[0];
    const kycManagerAcc = caccounts[1];
    const fundWalletAcc = caccounts[2];
    const investor = caccounts[3];
    const purchaser = caccounts[4];
    const testAcc = caccounts[4];
    const buyer2 = caccounts[4];
    
    const value = PRE_SALE_WEI_MIN_TRANSACTION;
    const expectedTokenAmount = TOKEN_RATE_BAND_3.mul(value);
    
    describe('Contract tests', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            // this.startTime = latestTime() + duration.minutes(30);
            // this.endTime = 1514894400;// this.startTime + duration.weeks(1);
            // this.afterEndTime = this.endTime + duration.weeks(1);
            //this.startTime = latestTime() + duration.weeks(1);
            //this.endTime = this.startTime + duration.weeks(1);
            this.startTime = 1511524800;
            this.endTime = 1514894400;
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(fundWalletAcc, kycManagerAcc);
            this.totalBought = new BigNumber(0);

            //await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should be the owner of the contract', async function () {
            const owner = await this.crowdsale.owner();
            owner.should.equal(contractOwnerAcc);
        });

        it('Should change KYC Manager to test account', async function () {
            const crowdSale = this.crowdsale;

            const startKycManager = await crowdSale.kycManager();
            await crowdSale.setKYCManager(testAcc);
            const endKycManager = await crowdSale.kycManager();
            
            assert.equal(startKycManager, kycManagerAcc, "KYC Manager should start as second account");
            assert.equal(endKycManager, testAcc, "KYC Manager should end as the fifth (test) account");
        });

        it('Should not approve KYC when executing from KYC Manager account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(investor, {from:kycManagerAcc}).should.be.rejectedWith(EVMThrow);
        });

        it('Should approve KYC of the investor account when executing from test account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(investor, {from:testAcc});
            const userHasKyc = await crowdSale.userHasKYC(investor);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should approve KYC of the test account and read the KYC logs', async function () {
            const crowdSale = this.crowdsale;
            const {logs} = await crowdSale.approveUserKYC(purchaser, {from:testAcc});
            const userHasKyc = await crowdSale.userHasKYC(purchaser);
            assert.equal(userHasKyc, true, "KYC has not been flagged");

            const event = logs.find(e => e.event === 'KYC');
            
            should.exist(event);
            event.args.user.should.equal(purchaser);
            event.args.isApproved.should.equal(true);
        });

        it('Should disapprove KYC of the test account and read the KYC logs', async function () {
            const crowdSale = this.crowdsale;
            const {logs} = await crowdSale.disapproveUserKYC(purchaser, {from:testAcc});
            const userHasKyc = await crowdSale.userHasKYC(purchaser);
            assert.equal(userHasKyc, false, "KYC has not been disaproved");

            const event = logs.find(e => e.event === 'KYC');
            
            should.exist(event);
            event.args.user.should.equal(purchaser);
            event.args.isApproved.should.equal(false);
        });

        it('Should reject buying 1 token more than PreSale cap: ('  + PRE_SALE_TOKEN_CAP.add(1).div(EthToWei).toString(10) + ' GMR or ' + PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_BAND_1).add(TOKEN_RATE_BAND_1).div(EthToWei) + ' ETH)', async function () {
            const amount = PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_BAND_1).add(TOKEN_RATE_BAND_1).truncated();
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value:amount, from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying less than minimum Wei (' + PRE_SALE_WEI_MIN_TRANSACTION.sub(1).div(EthToWei).toString(10) + '/' + PRE_SALE_WEI_MIN_TRANSACTION.div(EthToWei).toString(10) + ' ETH)', async function () {
            const amount = PRE_SALE_WEI_MIN_TRANSACTION.sub(1);
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value:amount, from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should increase totalSupply', async function () {
            const preTotalSupply = await this.crowdsale.totalSupply();
            await this.crowdsale.sendTransaction({value, from: investor}).should.be.fulfilled;
            const postTotalSupply = await this.crowdsale.totalSupply();
            postTotalSupply.sub(preTotalSupply).should.be.bignumber.equal(expectedTokenAmount);
        });

        it('Should log purchase', async function () {
            const {logs} = await this.crowdsale.sendTransaction({value, from: investor});
    
            const event = logs.find(e => e.event === 'TokenPurchase');
    
            should.exist(event);
            event.args.purchaser.should.equal(investor);
            event.args.value.should.be.bignumber.equal(value);
            event.args.amount.should.be.bignumber.equal(expectedTokenAmount);
        });

        it('Should assign tokens to sender', async function () {
            let preBalance = await this.crowdsale.balanceOf(investor);
            await this.crowdsale.sendTransaction({value: value, from: investor});
            let postBalance = await this.crowdsale.balanceOf(investor);
            postBalance.sub(preBalance).should.be.bignumber.equal(expectedTokenAmount);
        })
    
        it('Should forward funds to wallet', async function () {
            const pre = web3.eth.getBalance(fundWalletAcc);
            await this.crowdsale.sendTransaction({value, from: investor});
            const post = web3.eth.getBalance(fundWalletAcc);
            post.minus(pre).should.be.bignumber.equal(value);
        });

        it('Should buy exactly the minimum (' + PRE_SALE_WEI_MIN_TRANSACTION + ') (Band 3)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, investor, PRE_SALE_WEI_MIN_TRANSACTION, TOKEN_RATE_BAND_3);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should pause the contract', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.pause();
            const isPaused = await crowdSale.paused();
            assert.equal(isPaused, true, "Contract should be paused");
        });

        it('Should reject buying the minimum amount when paused', async function () {
            const crowdSale = this.crowdsale;
            const amount = PRE_SALE_WEI_MIN_TRANSACTION;
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying 300 ETH when paused', async function () {
            const crowdSale = this.crowdsale;
            const amount = new BigNumber(300).mul(EthToWei);
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should unpause the contract', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.unpause();
            const isPaused = await crowdSale.paused();
            assert.equal(isPaused, false, "Contract should be unpaused");
        });

        it('Should buy 300 ETH worth of tokens at PreSale (Band 2)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, investor, new BigNumber(300).mul(EthToWei), TOKEN_RATE_BAND_2);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy ' + new BigNumber(3000).mul(EthToWei).sub(1).toString(10) + ' ETH worth of tokens at PreSale (Band 2)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, investor, new BigNumber(3000).mul(EthToWei).sub(1), TOKEN_RATE_BAND_2);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 3000 ETH worth of tokens at PreSale (Band 1)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, investor, new BigNumber(3000).mul(EthToWei), TOKEN_RATE_BAND_1);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value: amount, from: investor}).should.be.rejectedWith(EVMThrow);
        });
    });
});