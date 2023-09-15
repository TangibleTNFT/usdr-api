var ethers = require('ethers');
var express = require('express');
var router = express.Router();

var cvrSupply = require("../cvr-supply.js");

router.get('/total-supply', function(req, res, next) {
  cvrSupply().then(supply => {
    const formattedSupply = ethers.utils.formatUnits(supply, 18);
    res.type('text/plain');
    res.send(formattedSupply);
  });
});

router.get('/circulating-supply', function(req, res, next) {
  cvrSupply().then(supply => {
    const formattedSupply = ethers.utils.formatUnits(supply, 18);
    res.type('text/plain');
    res.send(formattedSupply);
  });
});


module.exports = router;
