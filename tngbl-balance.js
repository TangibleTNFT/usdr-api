const ethers = require("ethers");

const provider = require("./provider.js");

const TNGBL_CONTRACT = require(`./abi/TNGBL.json`);

module.exports = async (account) => {
  const TNGBL = new ethers.Contract(
    TNGBL_CONTRACT.address,
    TNGBL_CONTRACT.abi,
    provider
  );
  return await TNGBL.balanceOf(account);
}
