var ethers = require('ethers');
var express = require('express');
var router = express.Router();

var cache = require("../cache.js").create();
var usdrAPY = require("../usdr-apy.js");
var tngblAPY = require("../tngbl-apy.js");
var usdrSupply = require("../usdr-supply.js");

router.get('/apy', function(req, res, next) {
  Promise.all([
    cache.get("usdr-apy", () => usdrAPY(), 300),
    cache.get("tngbl-apy", () => tngblAPY(), 3600)
  ]).then(results => {
    const [usdr, tngbl] = results;
    res.send({ usdr, tngbl });
  });
});

router.get('/supply', function(req, res, next) {
  usdrSupply().then(supply => {
    const formattedSupply = ethers.utils.formatUnits(supply, 9);
    res.type('text/plain');
    res.send(formattedSupply);
  });
});


module.exports = router;
