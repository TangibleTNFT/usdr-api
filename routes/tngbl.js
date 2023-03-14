var ethers = require('ethers');
var express = require('express');
var router = express.Router();

var tngblBalance = require("../tngbl-balance.js");
var tngblSupply = require("../tngbl-supply.js");

const PI_NFT_ADDRESS = '0xDc7ee66c43f35aC8C1d12Df90e61f05fbc2cD2c1';
const LABS_MULTISIG_ADDRESS = '0xAF8A1548Fd69a59Ce6A2a5f308bCC4698E1Db2E5';

router.get('/total-supply', function(req, res, next) {
  tngblSupply().then(supply => {
    const formattedSupply = ethers.utils.formatUnits(supply, 18);
    res.type('text/plain');
    res.send(formattedSupply);
  });
});

router.get('/circulating-supply', function(req, res, next) {
  Promise.all([
    tngblSupply(),
    tngblBalance(PI_NFT_ADDRESS),
    tngblBalance(LABS_MULTISIG_ADDRESS),
  ]).then(result => {
    const [totalSupply, lockedInPi, labsBalance] = result;
    const supply = totalSupply.sub(lockedInPi).sub(labsBalance);
    const formattedSupply = ethers.utils.formatUnits(supply, 18);
    res.type('text/plain');
    res.send(formattedSupply);
  });
});


module.exports = router;
