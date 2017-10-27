import {advanceBlock} from '../../private_modules/zeppelin-gimmer/test/helpers/advanceToBlock'
import {increaseTimeTo, duration} from '../../private_modules/zeppelin-gimmer/test/helpers/increaseTime'
import latestTime from '../../private_modules/zeppelin-gimmer/test/helpers/latestTime'
import EVMThrow from '../../private_modules/zeppelin-gimmer/test/helpers/EVMThrow'

var GimmerToken = artifacts.require("./GimmerToken.sol");
var GimmerCrowdSale = artifacts.require("./GimmerCrowdSale.sol");

contract ('GimmerCrowdSale', function (caccounts) {
    before(async function() {
        //Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
        await advanceBlock();
    });

    // describe ('Receiving payments before deploy', function () {
    //     it ('sending ETH to contract', function ()
    //     {
    //         return GimmerCrowdSale.deployed().then(function (instance) {
    //             crowdSale = instance;
    //             return token.balanceOf.call(mainAcc); // token.balanceOf(mainAcc)
    //         })
    //     });
    // });

    describe('Deploying Token Sale', function() {
        it("should give the contract 75.000.000 GMR", async function () {
            var crowdSale;
            // Get initial balances of first and second account.
            var mainAcc = caccounts[0];
            var mainAcc_start_balance;
            var mainAcc_end_balance;
            var crowd_start_balance;
            var crowd_end_balance;
            var initialStage;
            var endStage;

            var onemil = Math.pow(10, 6);
            var gmrDecimalCases = Math.pow(10, 8);
            var toTransfer = 75;

            var amount = toTransfer * onemil * gmrDecimalCases;
            var amountTotal = 100 * onemil * gmrDecimalCases;
            var left = (100 - toTransfer) * onemil * gmrDecimalCases;

            assert.equal(amountTotal - amount, left, "Math broke somewhere around the way");

            var token = await GimmerToken.deployed();

            return GimmerCrowdSale.deployed().then(function (instance) {
                crowdSale = instance;
                return token.balanceOf.call(mainAcc); // token.balanceOf(mainAcc)
            }).then(function (balance) {
                mainAcc_start_balance = balance.toNumber();
                return token.balanceOf.call(crowdSale.address); // token.balanceOf(crowdSale)
            }).then(function (balance) {
                crowd_start_balance = balance.toNumber();
                return crowdSale.getCurrentStage.call(); // crowdSale.getCurrentStage()
            }).then(function (stage) {
                initialStage = stage;
                return token.transfer(crowdSale.address, amount); // token.transfer(crowdSale, amount)
            }).then(function () {
                return token.balanceOf.call(mainAcc); // token.balanceOf(mainAcc)
            }).then(function (balance) {
                mainAcc_end_balance = balance.toNumber();
                return token.balanceOf.call(crowdSale.address); // token.balanceOf(crowdSale)
            }).then(function (balance) {
                crowd_end_balance = balance;
                return crowdSale.getCurrentStage.call(); // crowdSale.getCurrentStage()
            }).then(function (stage) {
                endStage = stage;

                assert.equal(crowd_start_balance, 0, "Crowdsale contract should start with no GMRs");
                assert.equal(mainAcc_start_balance, amountTotal, "Sender should start with 100 million GMRs");
                
                assert.equal(crowd_end_balance, amount, "Crowdsale contract received incorrect value");
                assert.equal(mainAcc_end_balance, left, "Amount left in the main account is inccorrect");

                assert.equal(initialStage, 0, "Contract should start in stage of Deployment");
                assert.equal(endStage.toNumber(), initialStage.toNumber(), "Contract should end in same stage as it begun");
            });
        });
        it('should deploy the contract to stage 1 - PreSale', function()
        {
            var crowdSale;
            var initialStage;
            var endStage;

            return GimmerCrowdSale.deployed().then(function (instance) {
                crowdSale = instance;
                return crowdSale.getCurrentStage.call(); // crowdSale.getCurrentStage()
            }).then(function (stage) {
                initialStage = stage;
                return crowdSale.deploy(); // crowdSale.deploy()
            }).then(function () {
                return crowdSale.getCurrentStage.call(); // crowdSale.deploy()
            }).then(function (stage) {
                endStage = stage;
                
                assert.equal(initialStage, 0, "Contract should start in stage of Deployment");
                assert.equal(endStage, 1, "Contract should end in stage of PreSale");
            })
        });
    });
});