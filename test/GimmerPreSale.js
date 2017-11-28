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

async function doBuyRemainingTokens(crowdSale, acc, totalBought){
    const rest = PRE_SALE_TOKEN_CAP.sub(totalBought);
    
    // calculate how much wei to send based on the total left on contract
    const rate = getTokenRate(rest);

    log('Whats your deal: Rate{' + rate.toString(10) + '} Tokens{' + rest.toString(10) + '}');

    const total = new BigNumber(rest).mul(rate);
    const tokens = await doBuy(crowdSale, acc, total, rate);
    
    totalBought = totalBought.add(tokens);
    
    const tokensSold = await crowdSale.tokensSold();
    assert(tokensSold, PRE_SALE_TOKEN_CAP, "Should've bought all the tokens in the PreSale contract");
    return totalBought;
}

contract ('GimmerPreSale', async function (caccounts) {
    const contractOwnerAcc = caccounts[0];
    const kycManagerAcc = caccounts[1];
    const fundWalletAcc = caccounts[2];
    const investor = caccounts[3];
    const purchaser = caccounts[4];
    const testAcc = caccounts[4];
    const buyer2 = caccounts[4];
    
    const value = new BigNumber(500).mul(EthToWei);
    const expectedTokenAmount = TOKEN_RATE_BAND_2.mul(value);
    
    describe('KYC Tests', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            // this.startTime = latestTime() + duration.minutes(30);
            // this.endTime = 1514894400;// this.startTime + duration.weeks(1);
            // this.afterEndTime = this.endTime + duration.weeks(1);
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime =   this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(fundWalletAcc, kycManagerAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
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

        it('Should not approve KYC when executing from kyc manager account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(investor, {from:kycManagerAcc}).should.be.rejectedWith(EVMThrow);
        });

        it('Should approve KYC of the investor account when executing from test account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(investor, {from:testAcc});
            const userHasKyc = await crowdSale.userHasKYC(investor);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject buying more than PreSale cap: ' + PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_BAND_1).add(TOKEN_RATE_BAND_1).div(EthToWei) + ' ETH', async function () {
            const amount = PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_BAND_1).add(TOKEN_RATE_BAND_1).truncated();
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value:amount, from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying less than minimum Wei (' + PRE_SALE_WEI_MIN_TRANSACTION.sub(1) + ')', async function () {
            const amount = PRE_SALE_WEI_MIN_TRANSACTION.sub(1);
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value:amount, from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy exactly the minimum (' + PRE_SALE_WEI_MIN_TRANSACTION + ') (Band 3)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, investor, PRE_SALE_WEI_MIN_TRANSACTION, TOKEN_RATE_BAND_3);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 300 ETH worth of tokens at PreSale (Band 2)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, investor, new BigNumber(300).mul(EthToWei), TOKEN_RATE_BAND_2);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 500 ETH worth of tokens at PreSale (Band 2)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, investor, new BigNumber(500).mul(EthToWei), TOKEN_RATE_BAND_2);
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

        it('Should reject buying tokens after sale has reached its cap', async function () {
            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value: amount, from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value: amount, from: investor}).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('1 Person Buys All', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime =   this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(fundWalletAcc, kycManagerAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should approve KYC of the investor account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(investor, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(investor);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject buying more than PreSale cap: ' + PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_BAND_1).add(TOKEN_RATE_BAND_1).div(EthToWei) + ' ETH', async function () {
            const amount = PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_BAND_1).add(TOKEN_RATE_BAND_1).truncated();
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy the entire PreSale cap (' + PRE_SALE_TOKEN_CAP + ' GMR) (Band 1)', async function () {
            const crowdSale = this.crowdsale;
            const rest = PRE_SALE_TOKEN_CAP.sub(this.totalBought);
            const val = PRE_SALE_TOKEN_CAP;
            
            // calculate how much wei to send based on the total left on contract
            const total = new BigNumber(rest).div(TOKEN_RATE_BAND_1);
            const tokens = await doBuy(crowdSale, investor, total, TOKEN_RATE_BAND_1);
            this.totalBought = this.totalBought.add(tokens);

            const tokensSold = await crowdSale.tokensSold();
            assert(tokensSold, PRE_SALE_TOKEN_CAP, "Should've bought all the tokens in the PreSale contract");
        });

        it('Should reject buying tokens after sale has reached its cap', async function () {
            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('3 Investors', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime =   this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(fundWalletAcc, kycManagerAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should approve KYC of the investor account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(investor, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(investor);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should approve KYC of the purchases account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(purchaser, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(purchaser);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should approve KYC of the test account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(testAcc, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(testAcc);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject buying more than PreSale cap: ' + PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_BAND_1).add(TOKEN_RATE_BAND_1).div(EthToWei) + ' ETH', async function () {
            const amount = PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_BAND_1).add(TOKEN_RATE_BAND_1).truncated();
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 3500 ETH worth of tokens at PreSale (Band 1)) from investor account', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, investor, new BigNumber(3500).mul(EthToWei), TOKEN_RATE_BAND_1);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 3700 ETH worth of tokens at PreSale (Band 1) from the purchaser account', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, purchaser, new BigNumber(3700).mul(EthToWei), TOKEN_RATE_BAND_1);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 2000 ETH worth of tokens at PreSale (Band 2) from the test account', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, testAcc, new BigNumber(2000).mul(EthToWei), TOKEN_RATE_BAND_2);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should reject buying tokens after sale has reached its cap', async function () {
            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('Pause Test', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime =   this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(fundWalletAcc, kycManagerAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should approve KYC of the primary account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(investor, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(investor);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should pause the contract', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.pause();
            const isPaused = await crowdSale.paused();
            assert.equal(isPaused, true, "Contract should be paused");
        });

        it('Should reject buying the minimum amount (1 ETH) when paused', async function () {
            const crowdSale = this.crowdsale;
            const amount = PRE_SALE_WEI_MIN_TRANSACTION;
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying 3500 ETH when paused', async function () {
            const crowdSale = this.crowdsale;
            const amount = new BigNumber(3500).mul(EthToWei);
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should unpause the contract', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.unpause();
            const isPaused = await crowdSale.paused();
            assert.equal(isPaused, false, "Contract should be unpaused");
        });

        it('Should reject buying more than PreSale cap: ' + PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_BAND_1).add(TOKEN_RATE_BAND_1).div(EthToWei) + ' ETH', async function () {
            const amount = PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_BAND_1).add(TOKEN_RATE_BAND_1).truncated();
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 3500 ETH worth of tokens at PreSale (Band 1)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, investor, new BigNumber(3500).mul(EthToWei), TOKEN_RATE_BAND_1);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 3700 ETH worth of tokens at PreSale (Band 1)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, investor, new BigNumber(3700).mul(EthToWei), TOKEN_RATE_BAND_1);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 2000 ETH worth of tokens at PreSale (Band 2)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, investor, new BigNumber(2000).mul(EthToWei), TOKEN_RATE_BAND_2);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should reject buying tokens after sale has reached its cap', async function () {
            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.sendTransaction({value: amount.toString(10), from: investor}).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('Accepting payments', function () {
        it('Should deploy the contract', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime = this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(fundWalletAcc, kycManagerAcc);
            this.totalBought = new BigNumber(0);

            await advanceBlock();
        });

        it('Should approve KYC of the purchaser account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(purchaser, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(purchaser);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should approve KYC of the investors account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(purchaser, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(purchaser);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        // it('Should reject payments before start', async function () {
        //     await this.crowdsale.sendTransaction({value, from: purchaser}).should.be.rejectedWith(EVMThrow);
        //     await this.crowdsale.buyTokens(investor, {from: purchaser, value: value}).should.be.rejectedWith(EVMThrow);
        // });
    
        it('Should accept payments after start', async function () {
            await increaseTimeTo(this.startTime);
            await this.crowdsale.sendTransaction({value: value, from: purchaser}).should.be.fulfilled;
            await this.crowdsale.buyTokens({value: value, from: purchaser}).should.be.fulfilled;
        });
    
        it('Should reject payments after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await this.crowdsale.sendTransaction({value: value, from: purchaser}).should.be.rejectedWith(EVMThrow);
            await this.crowdsale.buyTokens({value: value, from: purchaser}).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('High-Level Purchase', function () {
        it('Should deploy the contract', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime = this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(fundWalletAcc, kycManagerAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should approve KYC of the investor account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(investor, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(investor);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should increase totalSupply', async function () {
            await this.crowdsale.sendTransaction({value, from: investor}).should.be.fulfilled;
            const totalSupply = await this.crowdsale.totalSupply();
            totalSupply.should.be.bignumber.equal(expectedTokenAmount);
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
    });

    describe('Low-Level Purchase', function () {
        it('Should deploy the contract', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime = this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(fundWalletAcc, kycManagerAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should approve KYC of the purchaser account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(purchaser, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(purchaser);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should log purchase', async function () {
            const {logs} = await this.crowdsale.buyTokens(investor, {value: value, from: purchaser});
    
            const event = logs.find(e => e.event === 'TokenPurchase');
    
            should.exist(event);
            event.args.purchaser.should.equal(purchaser);
            event.args.value.should.be.bignumber.equal(value);
            event.args.amount.should.be.bignumber.equal(expectedTokenAmount);
        });
    
        it('Should increase totalSupply', async function () {
            const preTotalSupply = await this.crowdsale.totalSupply();
            await this.crowdsale.buyTokens({value: value, from: purchaser});
            const postTotalSupply = await this.crowdsale.totalSupply();
            postTotalSupply.minus(preTotalSupply).should.be.bignumber.equal(expectedTokenAmount);
        });
    
        it('Should assign tokens to beneficiary', async function () {
            const preBalance = await this.crowdsale.balanceOf(investor);
            await this.crowdsale.buyTokens({value: value, from: purchaser});
            const postBalance = await this.crowdsale.balanceOf(investor);
            postBalance.sub(preBalance).should.be.bignumber.equal(expectedTokenAmount);
        });
    
        it('Should forward funds to wallet', async function () {
            const pre = web3.eth.getBalance(fundWalletAcc);
            await this.crowdsale.buyTokens({value: value, from: purchaser});
            const post = web3.eth.getBalance(fundWalletAcc);
            post.minus(pre).should.be.bignumber.equal(value);
        });
    });
});