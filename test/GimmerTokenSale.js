import {advanceBlock} from '../zeppelin/test/helpers/advanceToBlock'
import increaseTime, { increaseTimeTo, duration } from '../zeppelin/test/helpers/increaseTime'
import latestTime from '../zeppelin/test/helpers/latestTime'
//import EVMThrow from '../zeppelin/test/helpers/EVMThrow'
//const EVMThrow = 'VM Exception while processing transaction: revert'; // Ganache/TestRPC
const EVMThrow = 'VM Exception while processing transaction: invalid opcode'; // Coverage
const BigNumber = web3.BigNumber;

const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const GimmerToken = artifacts.require("./GimmerToken.sol");
const GimmerTokenSale = artifacts.require("./GimmerTokenSale.sol");

const GIGA = new BigNumber(10).pow(9);
const MILLION = new BigNumber(10).pow(6);
const TO_WEI = new BigNumber(10).pow(18);
const ONE_ETH = new BigNumber(10).pow(18);
const ONE_WEI = new BigNumber(1);

// constants
const PRE_SALE_BONUS_3_WEI_MIN = new BigNumber(30).mul(TO_WEI);
const PRE_SALE_BONUS_2_WEI_MIN = new BigNumber(300).mul(TO_WEI);
const PRE_SALE_BONUS_1_WEI_MIN = new BigNumber(3000).mul(TO_WEI);

const TOKEN_RATE_BASE_RATE = new BigNumber(2500);
const TOKEN_RATE_05_PERCENT_BONUS = new BigNumber(2625);
const TOKEN_RATE_10_PERCENT_BONUS = new BigNumber(2750);
const TOKEN_RATE_15_PERCENT_BONUS = new BigNumber(2875);
const TOKEN_RATE_20_PERCENT_BONUS = new BigNumber(3000);
const TOKEN_RATE_25_PERCENT_BONUS = new BigNumber(3125);
const TOKEN_RATE_30_PERCENT_BONUS = new BigNumber(3250);
const TOKEN_RATE_40_PERCENT_BONUS = new BigNumber(3500);

const SALE_WEI_LIMIT_WITHOUT_KYC = new BigNumber(15).mul(TO_WEI);
const NEW_SALE_WEI_LIMIT_WITHOUT_KYC = new BigNumber(30).mul(TO_WEI);
const MAX_TX_GAS_PRICE = new BigNumber(50).mul(GIGA);
const NEW_MAX_TX_GAS_PRICE = new BigNumber(100).mul(GIGA);

const ONE_WEEK = new BigNumber(7 * 24 * 60 * 60);
const ONE_HOUR = new BigNumber(60 * 60);
const PRE_SALE_START_TIME = new BigNumber(1516190400);
const PRE_SALE_END_TIME = new BigNumber(1517400000);
const START_WEEK_1 = new BigNumber(1517486400);
const START_WEEK_2 = START_WEEK_1.add(ONE_WEEK);
const START_WEEK_3 = START_WEEK_2.add(ONE_WEEK);
const START_WEEK_4 = START_WEEK_3.add(ONE_WEEK);
const SALE_END_TIME = START_WEEK_4.add(ONE_WEEK);
const PRE_SALE_WEI_MIN_TX = new BigNumber(30).mul(TO_WEI);
const SALE_WEI_MIN_TX = TO_WEI.div(10);

const PRE_SALE_TOKEN_CAP = new BigNumber(15).mul(MILLION).mul(TO_WEI); // 15 mil tokens presale cap
const TOKEN_SALE_SALE_TOKEN_CAP = new BigNumber(100).mul(MILLION).mul(TO_WEI); // 15 mil tokens presale cap

function log(str){
    new Promise(function() { console.log(str); });
}

async function doBuy(tokensale, acc, weiAmount, expectedRate) {
    const actualValue = weiAmount.truncated();

    const gmrToken = GimmerToken.at(await tokensale.token());
    const contractOwnerAcc_start_tokenBalance = await gmrToken.balanceOf(acc);

    const value = actualValue;
    await tokensale.sendTransaction({value: actualValue, from: acc});

    const contractOwnerAcc_end_tokenBalance = await gmrToken.balanceOf(acc);

    const dif = contractOwnerAcc_end_tokenBalance.sub(contractOwnerAcc_start_tokenBalance);
    const tokensBought = actualValue.mul(expectedRate);
    assert.equal(dif.truncated().toString(10), tokensBought.truncated().toString(10), "Main account should return a specific amount");

    return tokensBought;
}

function getPreSaleTokenRate(weiAmount) {
    if (weiAmount >= PRE_SALE_BONUS_1_WEI_MIN) {
        return TOKEN_RATE_40_PERCENT_BONUS;
    } else if (weiAmount >= PRE_SALE_BONUS_2_WEI_MIN) {
        return TOKEN_RATE_30_PERCENT_BONUS;
    } else if (weiAmount >= PRE_SALE_BONUS_3_WEI_MIN) {
        return TOKEN_RATE_25_PERCENT_BONUS;
    } else {
        return 0;
    }
}

contract ('GimmerTokenSale', async function (accounts) {
    const WALLET_OWNER = accounts[0];
    const WALLET_KYCMANAGER = accounts[1];
    const WALLET_FUND = accounts[2];
    const WALLET_TEST = accounts[3];
    const WALLET_INVESTOR = accounts[4];
    const WALLET_INVESTOR2 = accounts[5];
    const WALLET_INVESTOR3 = accounts[6];
    const WALLET_INVESTOR4 = accounts[7];
    
    const value = PRE_SALE_WEI_MIN_TX;
    const expectedTokenAmount = TOKEN_RATE_25_PERCENT_BONUS.mul(value);
    
    describe('Contract tests', function(){
        it('Should reject deploying the Token Sale contract with an empty fund wallet', async function () {
            this.tokensale = await GimmerTokenSale.new(new BigNumber(0), WALLET_TEST,
                SALE_WEI_LIMIT_WITHOUT_KYC, MAX_TX_GAS_PRICE).should.be.rejectedWith(EVMThrow);
        });
        it('Should reject deploying the Token Sale contract with an empty KYC wallet', async function () {
            this.tokensale = await GimmerTokenSale.new(WALLET_FUND, new BigNumber(0),
                SALE_WEI_LIMIT_WITHOUT_KYC, MAX_TX_GAS_PRICE).should.be.rejectedWith(EVMThrow);
        });
        it('Should reject deploying the Token Sale contract with no Wei Limit', async function () {
            this.tokensale = await GimmerTokenSale.new(WALLET_FUND, WALLET_TEST,
                new BigNumber(0), MAX_TX_GAS_PRICE).should.be.rejectedWith(EVMThrow);
        });
        it('Should reject deploying the Token Sale contract with no Max Tx Gas Price', async function () {
            this.tokensale = await GimmerTokenSale.new(WALLET_FUND, WALLET_TEST,
                SALE_WEI_LIMIT_WITHOUT_KYC, new BigNumber(0)).should.be.rejectedWith(EVMThrow);
        });

        it('Should deploy the Token Sale contract', async function () {
            // deploy the wallet with test account as the KYC Manager, 
            // as we're going to change it to the correct account later
            this.tokensale = await GimmerTokenSale.new(WALLET_FUND, WALLET_TEST,
                SALE_WEI_LIMIT_WITHOUT_KYC, MAX_TX_GAS_PRICE);
        });

        it('Should reject calling finishContract() during period before sale', async function () {
            const tokensale = this.tokensale;
            await this.tokensale.finishContract({from: WALLET_OWNER}).should.be.rejectedWith(EVMThrow);
        });

        it('Contract should not be on finished state', async function () {
            const tokensale = this.tokensale;
            const hasEnded = await tokensale.hasEnded();
            
            assert.equal(hasEnded, false, "Has Ended should be false");
        });

        it('Contract should not have finished presale', async function () {
            const tokensale = this.tokensale;
            const hasPreSaleEnded = await tokensale.hasPreSaleEnded();
            
            assert.equal(hasPreSaleEnded, false, "Has Pre Sale Ended should be false");
        });

        it('Should be the owner of the contract', async function () {
            const owner = await this.tokensale.owner();
            owner.should.equal(WALLET_OWNER);
        });

        it('Should await untill the start of the PreSale period', async function () {
            // add one hour to make sure were inside the next block
            await increaseTimeTo(PRE_SALE_START_TIME.add(ONE_HOUR));
            await advanceBlock();

            const isPreSaleRunning = await this.tokensale.isPreSaleRunning();
            const isTokenSaleRunning = await this.tokensale.isTokenSaleRunning();
            const isCrowdSaleRunning = await this.tokensale.isCrowdSaleRunning();
            assert.equal(isPreSaleRunning, true, "Contract is not on PreSale state");
            assert.equal(isTokenSaleRunning, true, "Contract is not on TokenSaleRunning state");
            assert.equal(isCrowdSaleRunning, false, "Contract is on CrowdSaleRunning state");
        });

        it('Should reject calling finishContract() during presale period', async function () {
            const tokensale = this.tokensale;
            await this.tokensale.finishContract({from: WALLET_OWNER}).should.be.rejectedWith(EVMThrow);
        });

        it('Gimmer Token should be owned by Gimmer Token Sale', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());
            
            const tokensaleAddress = tokensale.address;
            const owner = await gmrToken.owner();
            
            assert.equal(owner, tokensaleAddress, "Owner of GimmerToken should be GimmerTokenSale");
        });

        it('Gimmer Token should have mintingFinished be false', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());
            
            const mintingFinished = await gmrToken.mintingFinished();
            
            assert.equal(mintingFinished, false, "GimmerToken should not have finished minting");
        });

        it('Should reject minting 1 GMR from the fund wallet (or any other wallet)', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());
            await gmrToken.mint(WALLET_INVESTOR, 1, {from: WALLET_FUND}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject invoking finish minting from the fund wallet (or any other wallet)', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());
            await gmrToken.finishMinting({from: WALLET_FUND}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject changing the KYC Manager to an empty wallet', async function () {
            const tokensale = this.tokensale;
            await tokensale.setKYCManager(new BigNumber(0), {from:WALLET_OWNER}).should.be.rejectedWith(EVMThrow);
        });

        it('Should change KYC Manager to correct wallet', async function () {
            const tokensale = this.tokensale;

            const startKycManager = await tokensale.kycManagerWallet();
            await tokensale.setKYCManager(WALLET_KYCMANAGER, {from:WALLET_OWNER});
            const endKycManager = await tokensale.kycManagerWallet();
            
            assert.equal(startKycManager, WALLET_TEST, "KYC Manager should start as test wallet");
            assert.equal(endKycManager, WALLET_KYCMANAGER, "KYC Manager should end as the KYC Manager wallet");
        });

        it('Should not approve KYC when executing from old KYC Manager (test wallet that was input on constructor)', async function () {
            const tokensale = this.tokensale;
            await tokensale.approveUserKYC(WALLET_INVESTOR, {from:WALLET_TEST}).should.be.rejectedWith(EVMThrow);
        });

        it('Should revert when invoking approveUserKYC with an empty wallet', async function () {
            const tokensale = this.tokensale;
            await tokensale.approveUserKYC(new BigNumber(0), {from:WALLET_KYCMANAGER}).should.be.rejectedWith(EVMThrow);;
        });

        it('Should revert when invoking disapproveUserKYC with an empty wallet', async function () {
            const tokensale = this.tokensale;
            await tokensale.disapproveUserKYC(new BigNumber(0), {from:WALLET_KYCMANAGER}).should.be.rejectedWith(EVMThrow);;
        });

        it('Should approve KYC of the investor wallet when executing from KYC Manager wallet', async function () {
            const tokensale = this.tokensale;
            await tokensale.approveUserKYC(WALLET_INVESTOR, {from:WALLET_KYCMANAGER});
            const userHasKyc = await tokensale.userHasKYC(WALLET_INVESTOR);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should approve KYC of the 2nd investor wallet and read the KYC logs', async function () {
            const tokensale = this.tokensale;
            const {logs} = await tokensale.approveUserKYC(WALLET_INVESTOR2, {from:WALLET_KYCMANAGER});
            const userHasKyc = await tokensale.userHasKYC(WALLET_INVESTOR2);
            assert.equal(userHasKyc, true, "KYC has not been flagged");

            const event = logs.find(e => e.event === 'KYC');
            
            should.exist(event);
            event.args.user.should.equal(WALLET_INVESTOR2);
            event.args.isApproved.should.equal(true);
        });

        it('Should disapprove KYC of the 2nd investor wallet and read the KYC logs', async function () {
            const tokensale = this.tokensale;
            const {logs} = await tokensale.disapproveUserKYC(WALLET_INVESTOR2, {from:WALLET_KYCMANAGER});
            const userHasKyc = await tokensale.userHasKYC(WALLET_INVESTOR2);
            assert.equal(userHasKyc, false, "KYC has not been disaproved");

            const event = logs.find(e => e.event === 'KYC');
            
            should.exist(event);
            event.args.user.should.equal(WALLET_INVESTOR2);
            event.args.isApproved.should.equal(false);
        });
        
        it('Should reject buying 1 token more than PreSale cap: (' + PRE_SALE_TOKEN_CAP.add(1).div(TO_WEI).toString(10) + ' GMR/'
                + PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_40_PERCENT_BONUS).truncated().add(TOKEN_RATE_40_PERCENT_BONUS).div(TO_WEI).toString(10) + ' ETH)', async function () {
            const tokensale = this.tokensale;
            const amount = PRE_SALE_TOKEN_CAP.div(TOKEN_RATE_40_PERCENT_BONUS).truncated().add(TOKEN_RATE_40_PERCENT_BONUS);
            await tokensale.sendTransaction({value:amount, from: WALLET_INVESTOR}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying less than minimum during presale (' + PRE_SALE_WEI_MIN_TX.sub(1).div(TO_WEI).toString(10) 
                + '/' + PRE_SALE_WEI_MIN_TX.div(TO_WEI).toString(10) + ' ETH)', async function () {
            const amount = PRE_SALE_WEI_MIN_TX.sub(1);
            const tokensale = this.tokensale;
            await tokensale.sendTransaction({value:amount, from: WALLET_INVESTOR}).should.be.rejectedWith(EVMThrow);
        });

        it('Should increase tokensSold', async function () {
            const preTokensSold = await this.tokensale.tokensSold();
            await this.tokensale.sendTransaction({value:value, from: WALLET_INVESTOR}).should.be.fulfilled;
            const postTokensSold = await this.tokensale.tokensSold();
            postTokensSold.sub(preTokensSold).should.be.bignumber.equal(expectedTokenAmount);
        });

        it('Should log purchase', async function () {
            const {logs} = await this.tokensale.sendTransaction({value, from: WALLET_INVESTOR});
    
            const event = logs.find(e => e.event === 'TokenPurchase');
    
            should.exist(event);
            event.args.purchaser.should.equal(WALLET_INVESTOR);
            event.args.value.should.be.bignumber.equal(value);
            event.args.amount.should.be.bignumber.equal(expectedTokenAmount);
        });

        it('Should assign tokens to sender', async function () {
            var gmrToken = GimmerToken.at(await this.tokensale.token());

            var preBalance = await gmrToken.balanceOf(WALLET_INVESTOR);
            await this.tokensale.sendTransaction({value: value, from: WALLET_INVESTOR});
            var postBalance = await gmrToken.balanceOf(WALLET_INVESTOR);
            postBalance.sub(preBalance).should.be.bignumber.equal(expectedTokenAmount);
        })
    
        it('Should forward funds to wallet', async function () {
            const pre = web3.eth.getBalance(WALLET_FUND);
            await this.tokensale.sendTransaction({value:value, from: WALLET_INVESTOR});
            const post = web3.eth.getBalance(WALLET_FUND);
            post.minus(pre).should.be.bignumber.equal(value);
        });

        it('Should buy exactly the minimum (' + PRE_SALE_WEI_MIN_TX.div(TO_WEI).toString(10) + ' ETH) from kyced wallet', async function () {
            const tokensale = this.tokensale;
            const userHasKyc = await tokensale.userHasKYC(WALLET_INVESTOR);
            assert.equal(userHasKyc, true, "Investor should have KYC");

            const tokens = await doBuy(tokensale, WALLET_INVESTOR, PRE_SALE_WEI_MIN_TX, TOKEN_RATE_25_PERCENT_BONUS);
        });

        it('Should reject buying 500 ETH from un-kyced wallet', async function () {
            const tokensale = this.tokensale;
            const userHasKyc = await tokensale.userHasKYC(WALLET_INVESTOR3);
            assert.equal(userHasKyc, false, "Investor 3 should not have KYC");

            await tokensale.sendTransaction({value:new BigNumber(500).mul(TO_WEI), from: WALLET_INVESTOR3}).should.be.rejectedWith(EVMThrow);
        });

        it('Should increase userWeiSpent() during presale', async function () {
            const amount = new BigNumber(30).mul(TO_WEI);
            const preUserWeiSpent = await this.tokensale.userWeiSpent(WALLET_INVESTOR);
            await this.tokensale.sendTransaction({value: amount, from: WALLET_INVESTOR}).should.be.fulfilled;
            const postUserWeiSpent = await this.tokensale.userWeiSpent(WALLET_INVESTOR);
            postUserWeiSpent.sub(preUserWeiSpent).should.be.bignumber.equal(amount);
        });

        it('Should buy 30 ETH worth of tokens at (PreSale 25% Bonus)', async function () {
            const tokensale = this.tokensale;
            const tokens = await doBuy(tokensale, WALLET_INVESTOR, new BigNumber(30).mul(TO_WEI), TOKEN_RATE_25_PERCENT_BONUS);
        });

        it('Should buy 300 ETH worth of tokens at (PreSale 30% Bonus)', async function () {
            const tokensale = this.tokensale;
            const tokens = await doBuy(tokensale, WALLET_INVESTOR, new BigNumber(300).mul(TO_WEI), TOKEN_RATE_30_PERCENT_BONUS);
        });

        it('Should buy 3000 ETH worth of tokens at PreSale (PreSale 40% Bonus)', async function () {
            const tokensale = this.tokensale;
            const tokens = await doBuy(tokensale, WALLET_INVESTOR, new BigNumber(3000).mul(TO_WEI), TOKEN_RATE_40_PERCENT_BONUS);
        });

        //
        // Nothing Day
        //
        it('Should await until the end of the PreSale', async function () {
            await increaseTimeTo(PRE_SALE_END_TIME.add(ONE_HOUR));
            await advanceBlock();

            const isTokenSaleRunning = await this.tokensale.isTokenSaleRunning();
            const isPreSaleRunning = await this.tokensale.isPreSaleRunning();
            const isCrowdSaleRunning = await this.tokensale.isCrowdSaleRunning();
            assert.equal(isTokenSaleRunning, false, "Contract should not be running any sales");
            assert.equal(isPreSaleRunning, false, "Contract should not be running PreSale");
            assert.equal(isPreSaleRunning, false, "Contract should not be running CrowsSale");
        });

        it('Contract should not be on finished state', async function () {
            const tokensale = this.tokensale;
            const hasEnded = await tokensale.hasEnded();
            
            assert.equal(hasEnded, false, "Has Ended should be false");
        });

        it('Contract should have finished presale', async function () {
            const tokensale = this.tokensale;
            const hasPreSaleEnded = await tokensale.hasPreSaleEnded();
            
            assert.equal(hasPreSaleEnded, true, "Has Pre Sale Ended should be true");
        });

        it('Should reject calling finishContract() during nothing-day period', async function () {
            const tokensale = this.tokensale;
            await this.tokensale.finishContract({from: WALLET_OWNER}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying 50 ETH during nothing day', async function () {
            const tokensale = this.tokensale;
            await tokensale.sendTransaction({value: new BigNumber(50).mul(TO_WEI), from: WALLET_INVESTOR}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject transfering 100 GMR from Investor 1 to 2', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());

            await gmrToken.transfer(WALLET_INVESTOR2, new BigNumber(10).mul(TO_WEI), {from: WALLET_INVESTOR}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject approving Investor 3 to manage 100 GMR from Investor 1', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());

            await gmrToken.approve(WALLET_INVESTOR3, new BigNumber(100).mul(TO_WEI), {from: WALLET_INVESTOR}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject increaseApproval Investor 3 to manage 100 GMR from Investor 1', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());

            await gmrToken.increaseApproval(WALLET_INVESTOR3, new BigNumber(100).mul(TO_WEI), {from: WALLET_INVESTOR}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject decreaseApproval Investor 3 to manage 100 GMR from Investor 1', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());

            await gmrToken.decreaseApproval(WALLET_INVESTOR3, new BigNumber(100).mul(TO_WEI), {from: WALLET_INVESTOR}).should.be.rejectedWith(EVMThrow);
        });

        //
        // WEEK 1
        //
        it('Should await until the 1st week of public sale', async function () {
            await increaseTimeTo(START_WEEK_1.add(ONE_HOUR));
            await advanceBlock();

            const isPreSaleRunning = await this.tokensale.isPreSaleRunning();
            assert.equal(isPreSaleRunning, false, "Contract should not be on PreSale state");

            const isCrowdSaleRunning = await this.tokensale.isCrowdSaleRunning();
            assert.equal(isCrowdSaleRunning, true, "Contract should be on CrowdSale state");
        });

        it('Should reject buying 1 token more than Token Sale cap: (' + TOKEN_SALE_SALE_TOKEN_CAP.add(1).div(TO_WEI).toString(10) + ' GMR)', async function () {
            const tokensale = this.tokensale;
            const amount = TOKEN_SALE_SALE_TOKEN_CAP.div(TOKEN_RATE_20_PERCENT_BONUS).truncated().add(TOKEN_RATE_40_PERCENT_BONUS);
            await tokensale.sendTransaction({value:amount, from: WALLET_INVESTOR}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject calling finishContract() during Week 1 of crowd sale period', async function () {
            const tokensale = this.tokensale;
            await this.tokensale.finishContract({from: WALLET_OWNER}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying less than the minimum during the crowd sale', async function () {
            const tokensale = this.tokensale;
            await tokensale.sendTransaction({value:SALE_WEI_MIN_TX.sub(1), from: WALLET_INVESTOR}).should.be.rejectedWith(EVMThrow);
        });

        it('Should accept buying exactly the minimum', async function () {
            const tokensale = this.tokensale;
            await tokensale.sendTransaction({value:SALE_WEI_MIN_TX, from: WALLET_INVESTOR}).should.be.fulfilled;
        });

        it('Should accept transaction with max gas price (50 GWei)', async function () {
            const tokensale = this.tokensale;
            await tokensale.sendTransaction({value:SALE_WEI_MIN_TX, from: WALLET_INVESTOR, gasPrice: MAX_TX_GAS_PRICE}).should.be.fulfilled;
        });

        it('Should reject transaction with gas price above the maximum (' + MAX_TX_GAS_PRICE.add(1).div(GIGA).toString(10) + ' GWei)', async function () {
            const tokensale = this.tokensale;
            await tokensale.sendTransaction({value:SALE_WEI_MIN_TX, from: WALLET_INVESTOR, gasPrice: MAX_TX_GAS_PRICE.add(1)}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject changing the max tx gas price to 0 GWei', async function () {
            const tokensale = this.tokensale;
            await tokensale.updateMaxTxGas(0, {from:WALLET_KYCMANAGER}).should.be.rejectedWith(EVMThrow);
        });

        it('Should change the max tx gas price to 100 GWei', async function () {
            const tokensale = this.tokensale;

            var startMaxTxGas = await tokensale.maxTxGas();
            await tokensale.updateMaxTxGas(NEW_MAX_TX_GAS_PRICE, {from:WALLET_KYCMANAGER});
            var endMaxTxGas = await tokensale.maxTxGas();
            
            assert.equal(startMaxTxGas.toString(10), MAX_TX_GAS_PRICE.toString(10), "Start Gas should be 50 GWei");
            assert.equal(endMaxTxGas.toString(10), NEW_MAX_TX_GAS_PRICE.toString(10), "End Gas should be 100 GWei");
        });

        it('Should accept transaction with max gas price (100 GWei)', async function () {
            const tokensale = this.tokensale;
            await tokensale.sendTransaction({value:SALE_WEI_MIN_TX, from: WALLET_INVESTOR, gasPrice: NEW_MAX_TX_GAS_PRICE}).should.be.fulfilled;
        });

        it('Should reject transaction with gas price above the maximum (' + NEW_MAX_TX_GAS_PRICE.add(1).div(GIGA).toString(10) + ' GWei)', async function () {
            const tokensale = this.tokensale;
            await tokensale.sendTransaction({value:SALE_WEI_MIN_TX, from: WALLET_INVESTOR, gasPrice: NEW_MAX_TX_GAS_PRICE.add(1)}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying more than allowed without KYC', async function () {
            const tokensale = this.tokensale;
            const amount = SALE_WEI_LIMIT_WITHOUT_KYC.add(1);

            const isKyc = await this.tokensale.userHasKYC(WALLET_INVESTOR3);
            assert.equal(isKyc, false, "Investor 3 should not have KYC approved");

            await tokensale.sendTransaction({value:amount, from: WALLET_INVESTOR3}).should.be.rejectedWith(EVMThrow);
        });
        it('Should buy 1 ETH worth of tokens at Week 1 (20% Bonus)', async function () {
            const tokensale = this.tokensale;

            const isKyc = await this.tokensale.userHasKYC(WALLET_INVESTOR3);
            assert.equal(isKyc, false, "Investor 3 should not have KYC approved");
            
            const tokens = await doBuy(tokensale, WALLET_INVESTOR3, ONE_ETH, TOKEN_RATE_20_PERCENT_BONUS);
        });

        it('Should call buyTokens', async function () {
            const tokensale = this.tokensale;
            await tokensale.buyTokens({value: ONE_ETH, from:WALLET_INVESTOR3}).should.be.fulfilled;
        });

        it('Should increase userWeiSpent() during crowd sale', async function () {
            const amount = new BigNumber(2).mul(TO_WEI);
            const preUserWeiSpent = await this.tokensale.userWeiSpent(WALLET_INVESTOR3);
            await this.tokensale.sendTransaction({value: amount, from: WALLET_INVESTOR3}).should.be.fulfilled;
            const postUserWeiSpent = await this.tokensale.userWeiSpent(WALLET_INVESTOR3);
            postUserWeiSpent.sub(preUserWeiSpent).should.be.bignumber.equal(amount);
        });

        //
        // WEEK 2
        //
        it('Should await until the 2nd week of public sale', async function () {
            await increaseTimeTo(START_WEEK_2.add(ONE_HOUR));
            await advanceBlock();

            const isPreSaleRunning = await this.tokensale.isPreSaleRunning();
            assert.equal(isPreSaleRunning, false, "Contract should not be on PreSale state");

            const isCrowdSaleRunning = await this.tokensale.isCrowdSaleRunning();
            assert.equal(isCrowdSaleRunning, true, "Contract should be on CrowdSale state");
        });
        it('Should reject buying more than allowed without KYC', async function () {
            const tokensale = this.tokensale;
            const amount = SALE_WEI_LIMIT_WITHOUT_KYC.add(1);

            const isKyc = await this.tokensale.userHasKYC(WALLET_INVESTOR3);
            assert.equal(isKyc, false, "Investor 3 should not have KYC approved");

            await tokensale.sendTransaction({value:amount, from: WALLET_INVESTOR3}).should.be.rejectedWith(EVMThrow);
        });
        it('Should buy 1 ETH worth of tokens at Week 2 (15% Bonus)', async function () {
            const tokensale = this.tokensale;

            const isKyc = await this.tokensale.userHasKYC(WALLET_INVESTOR3);
            assert.equal(isKyc, false, "Investor 3 should not have KYC approved");
            
            const tokens = await doBuy(tokensale, WALLET_INVESTOR3, ONE_ETH, TOKEN_RATE_15_PERCENT_BONUS);
        });

        //
        // WEEK 3
        //
        it('Should await until the 3rd week of public sale', async function () {
            await increaseTimeTo(START_WEEK_3.add(ONE_HOUR));
            await advanceBlock();

            const isPreSaleRunning = await this.tokensale.isPreSaleRunning();
            assert.equal(isPreSaleRunning, false, "Contract should not be on PreSale state");

            const isCrowdSaleRunning = await this.tokensale.isCrowdSaleRunning();
            assert.equal(isCrowdSaleRunning, true, "Contract should be on CrowdSale state");
        });
        it('Should reject buying more than allowed without KYC', async function () {
            const tokensale = this.tokensale;
            const amount = SALE_WEI_LIMIT_WITHOUT_KYC.add(1);

            const isKyc = await this.tokensale.userHasKYC(WALLET_INVESTOR3);
            assert.equal(isKyc, false, "Investor 3 should not have KYC approved");

            await tokensale.sendTransaction({value:amount, from: WALLET_INVESTOR3}).should.be.rejectedWith(EVMThrow);
        });
        it('Should buy 1 ETH worth of tokens at Week 3 (10% Bonus)', async function () {
            const tokensale = this.tokensale;

            const isKyc = await this.tokensale.userHasKYC(WALLET_INVESTOR3);
            assert.equal(isKyc, false, "Investor 3 should not have KYC approved");
            
            const tokens = await doBuy(tokensale, WALLET_INVESTOR3, ONE_ETH, TOKEN_RATE_10_PERCENT_BONUS);
        });

        it('Should reject setting the saleWeiLimitWithoutKYC to 0 ETH', async function () {
            const tokensale = this.tokensale;
            await this.tokensale.setSaleWeiLimitWithoutKYC(0, {from: WALLET_KYCMANAGER}).should.be.rejectedWith(EVMThrow);
        });

        it('Should change saleWeiLimitWithoutKYC to 30 ETH', async function () {
            const tokensale = this.tokensale;

            const startSaleWeiLimitWithoutKyc = await tokensale.saleWeiLimitWithoutKYC();
            await this.tokensale.setSaleWeiLimitWithoutKYC(NEW_SALE_WEI_LIMIT_WITHOUT_KYC, {from: WALLET_KYCMANAGER});
            const endSaleWeiLimitWithoutKyc = await tokensale.saleWeiLimitWithoutKYC();

            assert.equal(startSaleWeiLimitWithoutKyc.toString(10), SALE_WEI_LIMIT_WITHOUT_KYC.toString(10), "Starting sale limit without KYC should be same as start");
            assert.equal(endSaleWeiLimitWithoutKyc.toString(10), NEW_SALE_WEI_LIMIT_WITHOUT_KYC.toString(10), "Sale limit should end with value of 30 ETH");
        });

        it('Should reject buying ' + NEW_SALE_WEI_LIMIT_WITHOUT_KYC.add(1).div(TO_WEI).toString(10) + ' ETH worth of tokens without KYC', async function () {
            const tokensale = this.tokensale;
            await tokensale.sendTransaction({value:NEW_SALE_WEI_LIMIT_WITHOUT_KYC.add(1), from: WALLET_INVESTOR4}).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 30 ETH worth of tokens without KYC', async function () {
            const tokensale = this.tokensale;

            const isKyc = await this.tokensale.userHasKYC(WALLET_INVESTOR4);
            assert.equal(isKyc, false, "Investor 4 should not have KYC approved");

            const gmrToken = GimmerToken.at(await tokensale.token());
            const balance = await gmrToken.balanceOf(WALLET_INVESTOR4);
            assert.equal(balance.toString(10), new BigNumber(0).toString(10), "Investor 4 should not have any balance");
            
            const tokens = await doBuy(tokensale, WALLET_INVESTOR4, NEW_SALE_WEI_LIMIT_WITHOUT_KYC, TOKEN_RATE_10_PERCENT_BONUS);
        });

        //
        // WEEK 4
        //
        it('Should await until the 4th week of public sale', async function () {
            await increaseTimeTo(START_WEEK_4.add(ONE_HOUR));
            await advanceBlock();

            const isPreSaleRunning = await this.tokensale.isPreSaleRunning();
            assert.equal(isPreSaleRunning, false, "Contract should not be on PreSale state");

            const isCrowdSaleRunning = await this.tokensale.isCrowdSaleRunning();
            assert.equal(isCrowdSaleRunning, true, "Contract should be on CrowdSale state");
        });

        it('Should reject calling finishContract() during Week 4 of crowd sale', async function () {
            const tokensale = this.tokensale;
            await this.tokensale.finishContract({from: WALLET_OWNER}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject buying more than allowed without KYC', async function () {
            const tokensale = this.tokensale;
            const amount = NEW_SALE_WEI_LIMIT_WITHOUT_KYC.add(1);

            const isKyc = await this.tokensale.userHasKYC(WALLET_INVESTOR3);
            assert.equal(isKyc, false, "Investor 3 should not have KYC approved");

            await tokensale.sendTransaction({value:amount, from: WALLET_INVESTOR3}).should.be.rejectedWith(EVMThrow);
        });
        it('Should buy 1 ETH worth of tokens at Week 4 (5% Bonus)', async function () {
            const tokensale = this.tokensale;

            const isKyc = await this.tokensale.userHasKYC(WALLET_INVESTOR3);
            assert.equal(isKyc, false, "Investor 3 should not have KYC approved");
            
            const tokens = await doBuy(tokensale, WALLET_INVESTOR3, ONE_ETH, TOKEN_RATE_05_PERCENT_BONUS);
        });

        it('Contract should not be on finished state', async function () {
            const tokensale = this.tokensale;
            const hasEnded = await tokensale.hasEnded();
            
            assert.equal(hasEnded, false, "Has Ended should be false");
        });

        it('GimmerTokenSale presale should have ended', async function () {
            const tokensale = this.tokensale;
            const hasPreSaleEnded = await tokensale.hasPreSaleEnded();
            
            assert.equal(hasPreSaleEnded, true, "Has Pre Sale Ended should be true");
        });

        //
        // WEEK 5 (Ending)
        //
        it('Should await until the end of the public sale', async function () {
            await increaseTimeTo(SALE_END_TIME.add(ONE_HOUR));
            await advanceBlock();

            const isPreSaleRunning = await this.tokensale.isPreSaleRunning();
            assert.equal(isPreSaleRunning, false, "Contract should not be on PreSale state");

            const isCrowdSaleRunning = await this.tokensale.isCrowdSaleRunning();
            assert.equal(isCrowdSaleRunning, false, "Contract should not be on Sale state");
        });

        it('Contract should have finished presale', async function () {
            const tokensale = this.tokensale;
            const hasPreSaleEnded = await tokensale.hasPreSaleEnded();
            
            assert.equal(hasPreSaleEnded, true, "Has Pre Sale Ended should be true");
        });

        it('Contract should be on finished state', async function () {
            const tokensale = this.tokensale;
            const hasEnded = await tokensale.hasEnded();
            
            assert.equal(hasEnded, true, "Has Ended should be true");
        });

        it('Should reject buying 1 Wei after sale ends', async function () {
            const tokensale = this.tokensale;

            const isKyc = await this.tokensale.userHasKYC(WALLET_INVESTOR3);
            assert.equal(isKyc, false, "Investor 3 should not have KYC approved");

            await tokensale.sendTransaction({value:new BigNumber(1), from: WALLET_INVESTOR3}).should.be.rejectedWith(EVMThrow);
        });

        it('Should call finishContract', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());

            const tokensSold = await tokensale.tokensSold();
            const tenPc = tokensSold.div(10).truncated();

            const startOwner = await gmrToken.owner();
            const startBalance = await gmrToken.balanceOf(WALLET_FUND);
            
            await this.tokensale.finishContract({from: WALLET_OWNER});

            // check balance of tokens on fund wallet, should have 10% of the cap
            const endOwner = await gmrToken.owner();
            const endBalance = await gmrToken.balanceOf(WALLET_FUND);
            
            assert.equal(endBalance.toString(10), tenPc.toString(10), "Fund wallet final balance is wrong");
            assert.equal(endOwner, WALLET_FUND, "Gimmer Token should be owned by fund wallet after contract finish");
        });

        it('Should reject calling finishContract() after already calling it', async function () {
            const tokensale = this.tokensale;
            await this.tokensale.finishContract({from: WALLET_OWNER}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject calling transfer with empty wallet', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());

            await gmrToken.transfer(new BigNumber(0), new BigNumber(100).mul(TO_WEI), {from: WALLET_INVESTOR}).should.be.rejectedWith(EVMThrow);
        });

        it('Should reject calling transfer to GMR contract', async function () {
            const tokensale = this.tokensale;
            const tokenSaleAddress = await tokensale.token();
            const gmrToken = GimmerToken.at(tokenSaleAddress);

            await gmrToken.transfer(tokenSaleAddress, new BigNumber(100).mul(TO_WEI), {from: WALLET_INVESTOR}).should.be.rejectedWith(EVMThrow);
        });

        it('Should transfer 100 GMR from Investor 1 to 2', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());

            await gmrToken.transfer(WALLET_INVESTOR2, new BigNumber(100).mul(TO_WEI), {from: WALLET_INVESTOR}).should.be.fulfilled;
        });

        it('Should allow Investor 3 to transfer 100 GMR from Investor 1', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());

            await gmrToken.approve(WALLET_INVESTOR3, new BigNumber(100).mul(TO_WEI), {from: WALLET_INVESTOR}).should.be.fulfilled;
            //await gmrToken.transferFrom(WALLET_INVESTOR, WALLET_INVESTOR2, new BigNumber(100).mul(TO_WEI), {from: WALLET_INVESTOR}).should.be.fulfilled;
        });

        it('Should increase the allowed amount to be managed by Investor 3 by 70 GMR', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());

            await gmrToken.increaseApproval(WALLET_INVESTOR3, new BigNumber(70).mul(TO_WEI), {from: WALLET_INVESTOR}).should.be.fulfilled;
        });

        it('Should decreaseApproval the transfer to be managed by Investor 3 by 20 GMR', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());

            await gmrToken.decreaseApproval(WALLET_INVESTOR3, new BigNumber(20).mul(TO_WEI), {from: WALLET_INVESTOR}).should.be.fulfilled;
        });

        it('Should transferFrom the total approved value of 150 GMR', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());

            const startBalance = await gmrToken.balanceOf(WALLET_INVESTOR2);
            await gmrToken.transferFrom(WALLET_INVESTOR, WALLET_INVESTOR2, new BigNumber(150).mul(TO_WEI), {from: WALLET_INVESTOR3}).should.be.fulfilled;
            const endBalance = await gmrToken.balanceOf(WALLET_INVESTOR2);
            endBalance.sub(startBalance).toString(10).should.equal(new BigNumber(150).mul(TO_WEI).toString(10));
        });

        it('Should reject minting 1 GMR from the fund wallet (even though it owns the GimmerToken contract now)', async function () {
            const tokensale = this.tokensale;
            const gmrToken = GimmerToken.at(await tokensale.token());
            await gmrToken.mint(WALLET_INVESTOR, 1, {from: WALLET_FUND}).should.be.rejectedWith(EVMThrow);
        });
    });
});