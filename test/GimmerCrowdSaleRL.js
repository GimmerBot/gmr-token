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

var Phase1Price = new BigNumber(13158496);
var Phase2Price = new BigNumber(13980902);
var Phase3Price = new BigNumber(14803308);
var Phase4Price = new BigNumber(15625714);
var Phase5Price = new BigNumber(16448122);
var AfterSalePrice = new BigNumber(32896244);

var Phase1Date;
var Phase2Date;
var Phase3Date;
var Phase4Date;
var Phase5Date;

var TotalTokens = new BigNumber(0);

contract ('GimmerCrowdSale', function (caccounts) {
    var mainAcc = caccounts[0];
    var secAcc = caccounts[1];

    // List of Tests
    // State Changers
    // - withdrawTokens
    //      should: balance of sender greater than 0 and balance of sender frozen assets equals 0
    //      should.not: execute under any other stage other than AfterSale
    // - deploy
    //      should: execute at stage Deployment
    //      should.not: execute at any stage different than Deployment
    //      should.not: be executed by common users
    // - ()/buy
    //      should: total amount bought greater than KYC min triggers KYCEvent and freezes Wei
    //      should[Phase1]: buys with correct price for Phase 1
    //      should[Phase2]: buys with correct price for Phase 2
    //      should[Phase1]: buys with correct price for Phase 3
    //      should[Phase4]: buys with correct price for Phase 4
    //      should[Phase5]: buys with correct price for Phase 5
    //      should.not: execute at deployment stage
    //      should.not: receive value smaller than min transaction
    //      should.not: receive Wei after the PreSale limit
    // - setAfterSaleTokenPrice
    //      should.not: be executed by common users
    // - returnTokens
    //      should.not: execute at any stage other than AfterSale
    //      should.not: be executed by common users
    // - withdrawFunds
    //      should.not: execute at any stage other than AfterSale
    //      should.not: be executed by common users
    // - approveUserKYC
    //      should.not: be executed by common users
    // - updateSaleLimitWithoutKYC
    //      should.not: be executed by common users

    // Constant Dynamic
    // - getTokenPrice
    // - getTokenPhase
    // - forceUpdateStage

    // Constant    
    // - getAmountLeftToWidthdraw
    // - userHasKYC
    // - userTotalBought
    // - tokenBalanceOf
    // - getDirectTokenPrice
    // - getCurrentStage
    
    before(async function() {
        //Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
        await advanceBlock();

        Phase1Date = latestTime() + duration.minutes(51);
        Phase2Date = latestTime() + duration.minutes(76);
        Phase3Date = latestTime() + duration.minutes(106);
        Phase4Date = latestTime() + duration.minutes(131);
        Phase5Date = latestTime() + duration.minutes(156);
    });

    describe('Deploying Token Sale', function() {
        it('Should reject sending Wei to contract', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(18));

            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow)
        });

        it("Should give the contract 75.000.000 GMR", async function () {
            var crowdSale;
            // Get initial balances of first and second account.

            var onemil = Math.pow(10, 6);
            var gmrDecimalCases = Math.pow(10, 8);
            var toTransfer = 75;

            var amount = toTransfer * onemil * gmrDecimalCases;
            var amountTotal = 100 * onemil * gmrDecimalCases;
            var left = (100 - toTransfer) * onemil * gmrDecimalCases;

            assert.equal(amountTotal - amount, left, "Math broke somewhere around the way");

            var token = await GimmerToken.deployed();
            var crowdSale = await GimmerCrowdSale.deployed();

            var mainAcc_start_balance = await token.balanceOf.call(mainAcc);
            var crowd_start_balance = await token.balanceOf.call(crowdSale.address);
            var initialStage = await crowdSale.getCurrentStage.call();

            await token.transfer(crowdSale.address, amount); // Transfer GMRs

            var mainAcc_end_balance = await token.balanceOf.call(mainAcc);
            var crowd_end_balance = await token.balanceOf.call(crowdSale.address);
            var endStage = await crowdSale.getCurrentStage.call();

            assert.equal(crowd_start_balance, 0, "Crowdsale contract should start with no GMRs");
            assert.equal(mainAcc_start_balance.toString(), amountTotal.toString(), "Sender should start with 100 million GMRs");
            
            assert.equal(crowd_end_balance.toString(), amount.toString(), "Crowdsale contract received incorrect value");
            assert.equal(mainAcc_end_balance.toString(), left.toString(), "Amount left in the main account is inccorrect");

            assert.equal(initialStage, 0, "Contract should start in stage of Deployment");
            assert.equal(endStage.toString(), initialStage.toString(), "Contract should end in same stage as it begun");
        });

        it('Should deploy the contract to stage 1 - PreSale', async function()
        {
            var crowdSale = await GimmerCrowdSale.deployed();
            var initialStage = await crowdSale.getCurrentStage.call();
            await crowdSale.deploy();
            var endStage = await crowdSale.getCurrentStage.call();

            assert.equal(initialStage, 0, "Contract should start in stage of Deployment");
            assert.equal(endStage, 1, "Contract should end in stage of PreSale");
        });
        
        it('Should reject withdrawal of tokens', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawTokens().should.be.rejectedWith(EVMThrow)
        });

        it('Should reject withdrawal of funds', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawFunds().should.be.rejectedWith(EVMThrow)
        });

        it('Should reject calling deploy', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.deploy().should.be.rejectedWith(EVMThrow)
        });

        it('GetTokenPrice should return correct price', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var value = await crowdSale.getTokenPrice.call();
            assert.equal(value.toNumber(), Phase1Price.toNumber(), "getTokenPrice returned incorrect pricing for current phase");
        });
    });
    
    describe('Stage: PreSale (Phase 1)', function(){
        it ('Should be at PreSale/Phase 1', async function() {
            var crowdSale = await GimmerCrowdSale.deployed();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractPhase = await crowdSale.getTokenPhase.call();
            
            assert.equal(contractStage, 1, "Contract is in incorrect stage");
            assert.equal(contractPhase, 0, "Contract is in incorrect phase");
        });

        it('Should reject buying less than minimal limit', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(7));
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 1 ETH worth of tokens at PreSale', async function () {
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(18));

            var crowdSale = await GimmerCrowdSale.deployed();
            var token = await GimmerToken.deployed();

            var contractStage = await crowdSale.getCurrentStage.call();
            var mainAcc_start_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);
            var currentTokenPrice = await crowdSale.getTokenPrice.call();
            await crowdSale.send(amount.toString());
            var mainAcc_end_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);

            assert.equal(contractStage, 1, "Contract should be in Stage 1");
            assert.equal(currentTokenPrice.toString(), Phase1Price.toString(), "Contract is showing wrong price for the current phase");
            
            var tokensBought = amount.div(Phase1Price).truncated(); // solidity truncates
            assert.equal(mainAcc_end_tokenBalance.toString(), tokensBought.toString(), "Main account should buy return a specific amount for each phase");

            TotalTokens = TotalTokens.add(tokensBought);
        });

        // buy the remaining presale limit
        it('Should buy 49 ETH (17106.044 ETH RL) worth of tokens at PreSale', async function () {
            var amount = new BigNumber(49).mul(new BigNumber(10).pow(18));
            var phasePrice = Phase1Price;
            
            var crowdSale = await GimmerCrowdSale.deployed();
            var token = await GimmerToken.deployed();

            var contractStage = await crowdSale.getCurrentStage.call();
            var mainAcc_start_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);
            var currentTokenPrice = await crowdSale.getTokenPrice.call();
            await crowdSale.send(amount.toString());
            var mainAcc_end_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);

            assert.equal(contractStage, 1, "Contract is in incorrect stage");
            assert.equal(currentTokenPrice.toString(), phasePrice.toString(), "Contract is showing wrong price for the current phase");
            
            var tokensBought = amount.div(phasePrice).truncated(); // solidity truncates
            assert.equal(mainAcc_end_tokenBalance.sub(mainAcc_start_tokenBalance).toString(), tokensBought.toString(), "Main account should return a specific amount for each phase");

            TotalTokens = TotalTokens.add(tokensBought);
        });

        it('Should reject payments after presale cap', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(18));
            
            await crowdSale.buy.call({from: mainAcc, value:amount}).should.be.rejectedWith(EVMThrow)
        });

        it('Should reject withdrawal of tokens', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawTokens().should.be.rejectedWith(EVMThrow)
        });

        it('Should reject withdrawal of funds', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawFunds().should.be.rejectedWith(EVMThrow)
        });

        it('Should reject calling deploy', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.deploy().should.be.rejectedWith(EVMThrow)
        });

        it('GetTokenPrice should return correct price', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var value = await crowdSale.getTokenPrice.call();
            assert.equal(value.toString(), Phase1Price.toString(), "getTokenPrice returned incorrect pricing for current phase");
        });
    });

    describe('Stage: Sale (Phase 2)', function(){
        it ('Should jump to phase 2 start time', async function() {
            await increaseTimeTo(Phase1Date);
            await advanceBlock();
            
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.forceUpdateStage();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractPhase = await crowdSale.getTokenPhase.call();
            
            assert.equal(contractStage.toNumber(), 2, "Contract is in incorrect stage");
            assert.equal(contractPhase.toNumber(), 1, "Contract is in incorrect phase");
        });

        it('Should reject buying less than minimal limit', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(7));
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 1 ETH worth of tokens at Sale', async function () {
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(18));
            var phasePrice = Phase2Price;
            
            var crowdSale = await GimmerCrowdSale.deployed();
            var token = await GimmerToken.deployed();

            var contractStage = await crowdSale.getCurrentStage.call();
            assert.equal(contractStage, 2, "Contract is in incorrect stage");
            
            var mainAcc_start_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);
            var currentTokenPrice = await crowdSale.getTokenPrice.call();
            await crowdSale.send(amount.toString());
            var mainAcc_end_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);

            assert.equal(currentTokenPrice.toString(), phasePrice.toString(), "Contract is showing wrong price for the current phase");
            
            var tokensBought = amount.div(phasePrice).truncated(); // solidity truncates
            assert.equal(mainAcc_end_tokenBalance.sub(mainAcc_start_tokenBalance).toString(), tokensBought.toString(), "Main account should buy return a specific amount for each phase");
            TotalTokens = TotalTokens.add(tokensBought);
        });

        it('Should reject withdrawal of tokens', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawTokens().should.be.rejectedWith(EVMThrow)
        });

        it('Should reject withdrawal of funds', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawFunds().should.be.rejectedWith(EVMThrow)
        });

        it('Should reject calling deploy', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.deploy().should.be.rejectedWith(EVMThrow)
        });

        it('GetTokenPrice should return correct price', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var value = await crowdSale.getTokenPrice.call();
            assert.equal(value.toString(), Phase2Price.toString(), "getTokenPrice returned incorrect pricing for current phase");
        });
    });

    describe('Stage: Sale (Phase 3)', function(){
        it ('Should jump to phase 3 start time', async function() {
            await increaseTimeTo(Phase2Date);
            await advanceBlock();
            
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.forceUpdateStage();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractPhase = await crowdSale.getTokenPhase.call();
            
            assert.equal(contractStage.toNumber(), 2, "Contract is in incorrect stage");
            assert.equal(contractPhase.toNumber(), 2, "Contract is in incorrect phase");
        });

        it('Should reject buying less than minimal limit', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(7));
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 1 ETH worth of tokens at Sale', async function () {
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(18));
            var phasePrice = Phase3Price;
            
            var crowdSale = await GimmerCrowdSale.deployed();
            var token = await GimmerToken.deployed();

            var contractStage = await crowdSale.getCurrentStage.call();
            assert.equal(contractStage, 2, "Contract is in incorrect stage");
            
            var mainAcc_start_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);
            var currentTokenPrice = await crowdSale.getTokenPrice.call();
            await crowdSale.send(amount.toString());
            var mainAcc_end_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);

            assert.equal(currentTokenPrice.toString(), phasePrice.toString(), "Contract is showing wrong price for the current phase");
            
            var tokensBought = amount.div(phasePrice).truncated(); // solidity truncates
            assert.equal(mainAcc_end_tokenBalance.sub(mainAcc_start_tokenBalance).toString(), tokensBought.toString(), "Main account should buy return a specific amount for each phase");
            TotalTokens = TotalTokens.add(tokensBought);
        });

        it('Should reject withdrawal of tokens', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawTokens().should.be.rejectedWith(EVMThrow)
        });
        it('Should reject withdrawal of funds', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawFunds().should.be.rejectedWith(EVMThrow)
        });
        it('Should reject calling deploy', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.deploy().should.be.rejectedWith(EVMThrow)
        });

        it('GetTokenPrice should return correct price', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var value = await crowdSale.getTokenPrice.call();
            assert.equal(value.toString(), Phase3Price.toString(), "getTokenPrice returned incorrect pricing for current phase");
        });
    });

    describe('Stage: Sale (Phase 4)', function(){
        it ('Should jump to phase 4 start time', async function() {
            await increaseTimeTo(Phase3Date);
            await advanceBlock();
            
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.forceUpdateStage();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractPhase = await crowdSale.getTokenPhase.call();

            assert.equal(contractStage.toNumber(), 2, "Contract is in incorrect stage");
            assert.equal(contractPhase.toNumber(), 3, "Contract is in incorrect phase");
        });

        it('Should reject buying less than minimal limit', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(7));
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 1 ETH worth of tokens at Sale', async function () {
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(18));
            var phasePrice = Phase4Price;
            
            var crowdSale = await GimmerCrowdSale.deployed();
            var token = await GimmerToken.deployed();

            var contractStage = await crowdSale.getCurrentStage.call();
            assert.equal(contractStage, 2, "Contract is in incorrect stage");
            
            var mainAcc_start_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);
            var currentTokenPrice = await crowdSale.getTokenPrice.call();
            await crowdSale.send(amount.toString());
            var mainAcc_end_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);

            assert.equal(currentTokenPrice.toString(), phasePrice.toString(), "Contract is showing wrong price for the current phase");
            
            var tokensBought = amount.div(phasePrice).truncated(); // solidity truncates
            assert.equal(mainAcc_end_tokenBalance.sub(mainAcc_start_tokenBalance).toString(), tokensBought.toString(), "Main account should buy return a specific amount for each phase");
            TotalTokens = TotalTokens.add(tokensBought);
        });

        it('Should reject withdrawal of tokens', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawTokens().should.be.rejectedWith(EVMThrow)
        });
        it('Should reject withdrawal of funds', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawFunds().should.be.rejectedWith(EVMThrow)
        });
        it('Should reject calling deploy', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.deploy().should.be.rejectedWith(EVMThrow)
        });

        it('GetTokenPrice should return correct price', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var value = await crowdSale.getTokenPrice.call();
            assert.equal(value.toString(), Phase4Price.toString(), "getTokenPrice returned incorrect pricing for current phase");
        });
    });

    describe('Stage: Sale (Phase 5)', function(){
        it ('Should jump to phase 5 start time', async function() {
            await increaseTimeTo(Phase4Date);
            await advanceBlock();
            
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.forceUpdateStage();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractPhase = await crowdSale.getTokenPhase.call();

            assert.equal(contractStage.toNumber(), 2, "Contract is in incorrect stage");
            assert.equal(contractPhase.toNumber(), 4, "Contract is in incorrect phase");
        });

        it('Should reject buying less than minimal limit', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(7));
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 1 ETH worth of tokens at Sale', async function () {
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(18));
            var phasePrice = Phase5Price;
            
            var crowdSale = await GimmerCrowdSale.deployed();
            var token = await GimmerToken.deployed();

            var contractStage = await crowdSale.getCurrentStage.call();
            assert.equal(contractStage, 2, "Contract is in incorrect stage");
            
            var mainAcc_start_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);
            var currentTokenPrice = await crowdSale.getTokenPrice.call();
            await crowdSale.send(amount.toString());
            var mainAcc_end_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);

            assert.equal(currentTokenPrice.toString(), phasePrice.toString(), "Contract is showing wrong price for the current phase");
            
            var tokensBought = amount.div(phasePrice).truncated(); // solidity truncates
            assert.equal(mainAcc_end_tokenBalance.sub(mainAcc_start_tokenBalance).toString(), tokensBought.toString(), "Main account should buy return a specific amount for each phase");
            TotalTokens = TotalTokens.add(tokensBought);
        });

        it('Should reject withdrawal of tokens', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawTokens().should.be.rejectedWith(EVMThrow)
        });
        it('Should reject withdrawal of funds', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawFunds().should.be.rejectedWith(EVMThrow)
        });
        it('Should reject calling deploy', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.deploy().should.be.rejectedWith(EVMThrow)
        });

        it('GetTokenPrice should return correct price', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var value = await crowdSale.getTokenPrice.call();
            assert.equal(value.toString(), Phase5Price.toString(), "getTokenPrice returned incorrect pricing for current phase");
        });
    });

    describe('Stage: AfterSale (Phase 5)', function(){
        it ('Should jump to after sale start time', async function() {
            await increaseTimeTo(Phase5Date);
            await advanceBlock();
            
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.forceUpdateStage();
            var contractStage = await crowdSale.getCurrentStage.call();
            var contractPhase = await crowdSale.getTokenPhase.call();

            assert.equal(contractStage.toNumber(), 3, "Contract is in incorrect stage");
            assert.equal(contractPhase.toNumber(), 4, "Contract is in incorrect phase");
        });

        it('Should approve KYC for main account', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.approveUserKYC(mainAcc);
            var userHasKyc = await crowdSale.userHasKYC(mainAcc);
            assert.equal(userHasKyc, true, "KYC has not been flagged");
        });

        it('Should reject returning tokens to owner', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var token = await GimmerToken.deployed();

            var balance = await token.balanceOf.call(crowdSale.address);
            await crowdSale.returnTokens(balance).should.be.rejectedWith(EVMThrow);
        });

        it('Should accept withdrawal of tokens', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();

            var mainAcc_start_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);
            await crowdSale.withdrawTokens();
            var mainAcc_end_tokenBalance = await crowdSale.tokenBalanceOf.call(mainAcc);

            assert.equal(mainAcc_start_tokenBalance.toString(), TotalTokens.toString(), "Contract had incorrect amount of tokens to withdraw");
            assert.equal(mainAcc_end_tokenBalance.toNumber(), 0, "Contract did not withdraw all tokens to user");
        });

        it('Should accept withdrawal of funds', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.withdrawFunds().should.be.ok;
        });

        it('Should reject buying less than minimal limit', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(7));
            await crowdSale.send(amount.toString()).should.be.rejectedWith(EVMThrow);
        });

        it('Should buy 1 ETH worth of tokens at AfterSale', async function () {
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(18));
            var phasePrice = Phase5Price;
            
            var crowdSale = await GimmerCrowdSale.deployed();
            var token = await GimmerToken.deployed();

            var contractStage = await crowdSale.getCurrentStage.call();
            assert.equal(contractStage, 3, "Contract is in incorrect stage");
            
            var mainAcc_start_tokenBalance = await token.balanceOf.call(mainAcc);
            var currentTokenPrice = await crowdSale.getTokenPrice.call();
            await crowdSale.send(amount.toString());
            var mainAcc_end_tokenBalance = await token.balanceOf.call(mainAcc);

            assert.equal(currentTokenPrice.toString(), phasePrice.toString(), "Contract is showing wrong price for the current phase");
            
            var tokensBought = amount.div(phasePrice).truncated(); // solidity truncates
            assert.equal(mainAcc_end_tokenBalance.sub(mainAcc_start_tokenBalance).toString(), tokensBought.toString(), "Main account should buy return a specific amount for each phase");
        });

        it('Should reject calling deploy', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.deploy().should.be.rejectedWith(EVMThrow)
        });

        it('Should reject setting the after sale token price to 0', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            await crowdSale.setAfterSaleTokenPrice(0).should.be.rejectedWith(EVMThrow)
        });
        

        it('GetTokenPrice should return correct price', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var value = await crowdSale.getTokenPrice.call();
            assert.equal(value.toNumber(), Phase5Price.toNumber(), "getTokenPrice returned incorrect pricing for current phase");
        });

        it('Should change price of after sale', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            
            var startTokenPrice = await crowdSale.getTokenPrice.call();
            var startDirTokenPrice = await crowdSale.getDirectTokenPrice.call();
            await crowdSale.setAfterSaleTokenPrice(AfterSalePrice);
            var endTokenPrice = await crowdSale.getTokenPrice.call();
            var endDirTokenPrice = await crowdSale.getDirectTokenPrice.call();
            
            assert.equal(endTokenPrice.toString(), AfterSalePrice.toString(), "Token price is incorrect");
            assert.equal(endTokenPrice.toString(), endDirTokenPrice.toString(), "Token price is incorrect");
        });

        it('Should buy 1 ETH worth of tokens at AfterSale with custom price', async function () {
            var amount = new BigNumber(1).mul(new BigNumber(10).pow(18));
            var phasePrice = AfterSalePrice;
            
            var crowdSale = await GimmerCrowdSale.deployed();
            var token = await GimmerToken.deployed();

            var contractStage = await crowdSale.getCurrentStage.call();
            assert.equal(contractStage, 3, "Contract is in incorrect stage");
            
            var mainAcc_start_tokenBalance = await token.balanceOf.call(mainAcc);
            var currentTokenPrice = await crowdSale.getTokenPrice.call();
            await crowdSale.send(amount.toString());
            var mainAcc_end_tokenBalance = await token.balanceOf.call(mainAcc);

            assert.equal(currentTokenPrice.toString(), phasePrice.toString(), "Contract is showing wrong price for the current phase");
            
            var tokensBought = amount.div(phasePrice).truncated(); // solidity truncates
            assert.equal(mainAcc_end_tokenBalance.sub(mainAcc_start_tokenBalance).toString(), tokensBought.toString(), "Main account should buy return a specific amount for each phase");
        });

        it('GetTokenPrice should return correct price after change of price', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var value = await crowdSale.getTokenPrice.call();
            assert.equal(value.toString(), AfterSalePrice.toString(), "getTokenPrice returned incorrect pricing for current phase");
        });

        it('Should return all remaining tokens to owner', async function () {
            var crowdSale = await GimmerCrowdSale.deployed();
            var token = await GimmerToken.deployed();

            var leftToWithdraw = await crowdSale.getAmountLeftToWidthdraw.call();
            assert.equal(leftToWithdraw.toNumber(), 0, "Still has money left to withdraw");
            
            var balance = await token.balanceOf.call(crowdSale.address);
            var startMainAccBalance = await token.balanceOf.call(mainAcc);
            await crowdSale.returnTokens(balance);
            var endMainAccBalance = await token.balanceOf.call(mainAcc);
            
            assert.equal(endMainAccBalance.sub(startMainAccBalance).toString(), balance.toString(), "Did not return correct value of tokens to main wallet");
        });
    });
});