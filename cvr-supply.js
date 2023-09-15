const ethers = require("ethers");

const provider = require("./provider.js");

const CVR_CONTRACT = require(`./abi/Caviar.json`);

module.exports = async () => {
  const CVR = new ethers.Contract(
    CVR_CONTRACT.address,
    CVR_CONTRACT.abi,
    provider
  );
  return await CVR.totalSupply();
}
