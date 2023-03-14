const ethers = require("ethers");

const provider = require("./provider.js");

const USDR_CONTRACT = require(`./abi/USDR.json`);

module.exports = async () => {
  const USDR = new ethers.Contract(
    USDR_CONTRACT.address,
    USDR_CONTRACT.abi,
    provider
  );
  return await USDR.totalSupply();
}
