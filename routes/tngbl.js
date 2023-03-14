var ethers = require('ethers');
var express = require('express');
var router = express.Router();

var tngblSupply = require("../tngbl-supply.js");

router.get('/supply', function(req, res, next) {
  tngblSupply().then(supply => {
    const formattedSupply = ethers.utils.formatUnits(supply, 18);
    res.type('text/plain');
    res.send(formattedSupply);
  });
});


module.exports = router;
