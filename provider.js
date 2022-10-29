const { providers } = require("ethers");

require("dotenv").config();

const provider = new providers.StaticJsonRpcProvider(process.env.RPC);

module.exports = provider;
