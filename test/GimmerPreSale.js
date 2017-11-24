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

const PRE_SALE_BONUS_WEI_MIN = new BigNumber(3000).mul(new BigNumber(10).pow(18));

const BaseRate = new BigNumber(1000);
const PreSaleRate = new BigNumber(1300);
const PreSaleBonusRate = new BigNumber(1400);

const MinTokenTransaction = ToToken;
const _1Eth = EthToWei;

const StartDate = latestTime() + duration.minutes(31);
const EndDate = latestTime() + duration.minutes(1441);

const PreSaleTokenCap = new BigNumber(15).mul(ToMillion).mul(ToToken); // 15 mil tokens presale cap
const MinimumWeiTransaction = EthToWei;

function log(str){
    new Promise(function() { console.log(str); });
}

function getWeiCost(tokenAmount) {
    var totalWei = tokenAmount.div(PreSaleBonusRate);
    var actualBonus = PreSaleBonusRate.sub(BaseRate);
    var bonusTokensPrice = tokenAmount.div(actualBonus);
    return totalWei;
}

async function doBuy(crowdSale, acc, weiAmount, expectedRate) {
    const actualValue = weiAmount.truncated();
    const contractOwnerAcc_start_tokenBalance = await crowdSale.balanceOf(acc);
    await crowdSale.send(actualValue.toString(10));
    //await this.crowdsale.buyTokens(investor, {value: value, from: purchaser}).should.be.fulfilled;
    const contractOwnerAcc_end_tokenBalance = await crowdSale.balanceOf(acc);

    const dif = contractOwnerAcc_end_tokenBalance.sub(contractOwnerAcc_start_tokenBalance);
    const tokensBought = actualValue.mul(expectedRate);
    assert.equal(dif.truncated().toString(10), tokensBought.truncated().toString(10), "Main account should return a specific amount");

    return tokensBought;
}

async function doBuyRemainingTokens(crowdSale, acc, totalBought){
    const rest = PreSaleTokenCap.sub(totalBought);
    
    // calculate how much wei to send based on the total left on contract
    var rate = PreSaleBonusRate;
    if (new BigNumber(rest).div(rate) < PRE_SALE_BONUS_WEI_MIN) {
        rate = PreSaleRate;
    }

    const total = new BigNumber(rest).div(rate);
    const tokens = await doBuy(crowdSale, acc, total, rate);
    
    totalBought = totalBought.add(tokens);
    
    const tokensSold = await crowdSale.tokensSold();
    assert(tokensSold, PreSaleTokenCap, "Should've bought all the tokens in the PreSale contract");
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
    const expectedTokenAmount = PreSaleRate.mul(value);
    
    describe('KYC Tests', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime =   this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(this.startTime, this.endTime, PreSaleRate.toString(10), PreSaleBonusRate.toString(10), fundWalletAcc, kycManagerAcc);
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
            await crowdSale.approveUserKYC(contractOwnerAcc, {from:kycManagerAcc}).should.be.rejectedWith(EVMThrow);
        });

        it('Should approve KYC when executing from test account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(contractOwnerAcc, {from:testAcc});
            const userHasKyc = await crowdSale.userHasKYC(contractOwnerAcc);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject buying more than PreSale cap: ' + PreSaleTokenCap.div(PreSaleBonusRate).add(PreSaleBonusRate).div(EthToWei) + ' ETH', async function () {
            const amount = PreSaleTokenCap.div(PreSaleBonusRate).add(PreSaleBonusRate).truncated();
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying less than minimum Wei', async function () {
            const amount = MinimumWeiTransaction.sub(1);
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy exactly the minimum (1 ETH)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, contractOwnerAcc, new BigNumber(1).mul(EthToWei), PreSaleRate);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 300 ETH worth of tokens at PreSale', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, contractOwnerAcc, new BigNumber(300).mul(EthToWei), PreSaleRate);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 500 ETH worth of tokens at PreSale', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, contractOwnerAcc, new BigNumber(500).mul(EthToWei), PreSaleRate);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 3000 ETH worth of tokens at PreSale', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, contractOwnerAcc, new BigNumber(3000).mul(EthToWei), PreSaleRate);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 3000.000000000000000001 ETH worth of tokens at PreSale (custom Rate)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, contractOwnerAcc, new BigNumber(3000).mul(EthToWei).add(1), PreSaleBonusRate);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy the rest of the tokens to reach the PreSale cap (' + PreSaleTokenCap.div(ToToken).toString(10) + ' GMR)', async function () {
            this.totalBought = await doBuyRemainingTokens(this.crowdsale, contractOwnerAcc, this.totalBought);
        });

        it('Should reject buying tokens after sale has reached its cap', async function () {
            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('1 Person Buys All', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime =   this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(this.startTime, this.endTime, PreSaleRate.toString(10), PreSaleBonusRate.toString(10), fundWalletAcc, kycManagerAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should approve KYC of the primary account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(contractOwnerAcc, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(contractOwnerAcc);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject buying more than PreSale cap: ' + PreSaleTokenCap.div(PreSaleBonusRate).add(PreSaleBonusRate).div(EthToWei) + ' ETH', async function () {
            const amount = PreSaleTokenCap.div(PreSaleBonusRate).add(PreSaleBonusRate).truncated();
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy the entire PreSale cap (' + PreSaleTokenCap + ' GMR)', async function () {
            const crowdSale = this.crowdsale;
            const rest = PreSaleTokenCap.sub(this.totalBought);
            const val = PreSaleTokenCap;
            
            // calculate how much wei to send based on the total left on contract
            const total = new BigNumber(rest).div(PreSaleBonusRate);
            const tokens = await doBuy(crowdSale, contractOwnerAcc, total, PreSaleBonusRate);
            this.totalBought = this.totalBought.add(tokens);

            const tokensSold = await crowdSale.tokensSold();
            assert(tokensSold, PreSaleTokenCap, "Should've bought all the tokens in the PreSale contract");
        });

        it('Should reject buying tokens after sale has reached its cap', async function () {
            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('3 Investors', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime =   this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(this.startTime, this.endTime, PreSaleRate.toString(10), PreSaleBonusRate.toString(10), fundWalletAcc, kycManagerAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should approve KYC of the primary account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(contractOwnerAcc, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(contractOwnerAcc);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject buying more than PreSale cap: ' + PreSaleTokenCap.div(PreSaleBonusRate).add(PreSaleBonusRate).div(EthToWei) + ' ETH', async function () {
            const amount = PreSaleTokenCap.div(PreSaleBonusRate).add(PreSaleBonusRate).truncated();
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 3500 ETH worth of tokens at PreSale (custom Rate)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, contractOwnerAcc, new BigNumber(3500).mul(EthToWei), PreSaleBonusRate);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 3700 ETH worth of tokens at PreSale (custom Rate)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, contractOwnerAcc, new BigNumber(3700).mul(EthToWei), PreSaleBonusRate);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 2000 ETH worth of tokens at PreSale (normal Rate)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, contractOwnerAcc, new BigNumber(2000).mul(EthToWei), PreSaleRate);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy the rest of the tokens to reach the PreSale cap (' + PreSaleTokenCap.div(ToToken).toString(10) + ' GMR)', async function () {
            this.totalBought = await doBuyRemainingTokens(this.crowdsale, contractOwnerAcc, this.totalBought);
        });

        it('Should reject buying tokens after sale has reached its cap', async function () {
            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('3 Investors Pause Test', function(){
        it('Should deploy the contract and wait till the campaign starts', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime =   this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(this.startTime, this.endTime, PreSaleRate.toString(10), PreSaleBonusRate.toString(10), fundWalletAcc, kycManagerAcc);
            this.totalBought = new BigNumber(0);

            await increaseTimeTo(this.startTime);
            await advanceBlock();
        });

        it('Should approve KYC of the primary account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(contractOwnerAcc, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(contractOwnerAcc);
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
            await crowdSale.send(EthToWei.toString(10)).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying 3500 ETH when paused', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.send(new BigNumber(3500).mul(EthToWei).toString(10)).should.be.rejectedWith(EVMThrow);
        });

        it('Should unpause the contract', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.unpause();
            const isPaused = await crowdSale.paused();
            assert.equal(isPaused, false, "Contract should be unpaused");
        });

        it('Should reject buying more than PreSale cap: ' + PreSaleTokenCap.div(PreSaleBonusRate).add(PreSaleBonusRate).div(EthToWei) + ' ETH', async function () {
            const amount = PreSaleTokenCap.div(PreSaleBonusRate).add(PreSaleBonusRate).truncated();
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 3500 ETH worth of tokens at PreSale (custom Rate)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, contractOwnerAcc, new BigNumber(3500).mul(EthToWei), PreSaleBonusRate);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 3700 ETH worth of tokens at PreSale (custom Rate)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, contractOwnerAcc, new BigNumber(3700).mul(EthToWei), PreSaleBonusRate);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy 2000 ETH worth of tokens at PreSale (normal Rate)', async function () {
            const crowdSale = this.crowdsale;
            const tokens = await doBuy(crowdSale, contractOwnerAcc, new BigNumber(2000).mul(EthToWei), PreSaleRate);
            this.totalBought = this.totalBought.add(tokens);
        });

        it('Should buy the rest of the tokens to reach the PreSale cap (' + PreSaleTokenCap.div(ToToken).toString(10) + ' GMR)', async function () {
            this.totalBought = await doBuyRemainingTokens(this.crowdsale, contractOwnerAcc, this.totalBought);
        });

        it('Should reject buying tokens after sale has reached its cap', async function () {
            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying tokens after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await advanceBlock();

            const amount = 1;
            const crowdSale = this.crowdsale;
            await crowdSale.send(amount.toString(10)).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('Accepting payments', function () {
        it('Should deploy the contract', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime = this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(this.startTime, this.endTime, PreSaleRate.toString(10), PreSaleBonusRate.toString(10), fundWalletAcc, kycManagerAcc);
            this.totalBought = new BigNumber(0);

            await advanceBlock();
        });

        it('Should approve KYC of the purchaser account', async function () {
            const crowdSale = this.crowdsale;
            await crowdSale.approveUserKYC(purchaser, {from:kycManagerAcc});
            const userHasKyc = await crowdSale.userHasKYC(purchaser);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject payments before start', async function () {
            await this.crowdsale.sendTransaction({value, from: purchaser}).should.be.rejectedWith(EVMThrow);
            await this.crowdsale.buyTokens(investor, {from: purchaser, value: value}).should.be.rejectedWith(EVMThrow);
        })
    
        it('Should accept payments after start', async function () {
            await increaseTimeTo(this.startTime);
            await this.crowdsale.sendTransaction({value, from: purchaser}).should.be.fulfilled;
            await this.crowdsale.buyTokens(investor, {value: value, from: purchaser}).should.be.fulfilled;
        })
    
        it('Should reject payments after end', async function () {
            await increaseTimeTo(this.afterEndTime);
            await this.crowdsale.sendTransaction({value, from: purchaser}).should.be.rejectedWith(EVMThrow);
            await this.crowdsale.buyTokens(investor, {value: value, from: purchaser}).should.be.rejectedWith(EVMThrow);
        });
    });

    describe('High-Level Purchase', function () {
        it('Should deploy the contract', async function () {
            this.startTime = latestTime() + duration.weeks(1);
            this.endTime = this.startTime + duration.weeks(1);
            this.afterEndTime = this.endTime + duration.seconds(1);
        
            this.crowdsale = await GimmerPreSale.new(this.startTime, this.endTime, PreSaleRate.toString(10), PreSaleBonusRate.toString(10), fundWalletAcc, kycManagerAcc);
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
            event.args.beneficiary.should.equal(investor);
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
        
            this.crowdsale = await GimmerPreSale.new(this.startTime, this.endTime, PreSaleRate.toString(10), PreSaleBonusRate.toString(10), fundWalletAcc, kycManagerAcc);
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
            event.args.beneficiary.should.equal(investor);
            event.args.value.should.be.bignumber.equal(value);
            event.args.amount.should.be.bignumber.equal(expectedTokenAmount);
        });
    
        it('Should increase totalSupply', async function () {
            const preTotalSupply = await this.crowdsale.totalSupply();
            await this.crowdsale.buyTokens(investor, {value, from: purchaser});
            const postTotalSupply = await this.crowdsale.totalSupply();
            postTotalSupply.minus(preTotalSupply).should.be.bignumber.equal(expectedTokenAmount);
        });
    
        it('Should assign tokens to beneficiary', async function () {
            const preBalance = await this.crowdsale.balanceOf(investor);
            await this.crowdsale.buyTokens(investor, {value, from: purchaser});
            const postBalance = await this.crowdsale.balanceOf(investor);
            postBalance.sub(preBalance).should.be.bignumber.equal(expectedTokenAmount);
        });
    
        it('Should forward funds to wallet', async function () {
            const pre = web3.eth.getBalance(fundWalletAcc);
            await this.crowdsale.buyTokens(investor, {value, from: purchaser});
            const post = web3.eth.getBalance(fundWalletAcc);
            post.minus(pre).should.be.bignumber.equal(value);
        });
    });
});