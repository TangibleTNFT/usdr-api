const axios = require("axios");
const ethers = require("ethers");

const provider = require("./provider.js");

const {address: USDR_ADDRESS, abi: USDR_ABI} = require("./abi/USDR.json");
const {address: TNGBL_ORACLE_ADDRESS, abi: TNGBL_ORACLE_ABI} = require("./abi/TNGBLPriceOracle.json");

const BALANCE_CHECKER_ADDRESS = "0x71d85151ed25dB543873Ad8bdDa8276b9B5D0455";
const TNGBL_ADDRESS = "0x49e6A20f1BBdfEeC2a8222E052000BbB14EE6007";
const TNGBL_DISTRIBUTOR = "0x738BA7dC9879f9168ebE93B2E6eC0F86BB1a5527";
const BATCH_SENDER = "0x776f814d810dff07a29d225605a1cbf981902d12";

const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function balanceOf(address) view returns (uint256)",
];

const BATCH_SENDER_ABI = [
  "function send(address, uint256, address[], uint256[]) view returns (uint256)",
];

const USDR = new ethers.Contract(USDR_ADDRESS, ERC20_ABI, provider);
const TNGBL = new ethers.Contract(TNGBL_ADDRESS, ERC20_ABI, provider);

const oracle = new ethers.Contract(TNGBL_ORACLE_ADDRESS, TNGBL_ORACLE_ABI, provider);
const batchSender = new ethers.utils.Interface(BATCH_SENDER_ABI);

async function getBlockNumberForTimestamp(timestamp) {
  if (typeof(timestamp) !== "number") return timestamp;
  const { data } = await axios({
    method: "get",
    url: `https://coins.llama.fi/block/polygon/${timestamp}`,
  });
  return data.height;
}

async function computeAPY(from, to) {
  const [fromBlock, toBlock] = await Promise.all([
    getBlockNumberForTimestamp(from),
    getBlockNumberForTimestamp(to),
  ]);
  const transactions = await Promise.all(
    await TNGBL.queryFilter(
      TNGBL.filters.Transfer(TNGBL_DISTRIBUTOR, BATCH_SENDER),
      fromBlock,
      toBlock
    ).then((events) =>
      events.map((e) => provider.getTransaction(e.transactionHash))
    )
  );

  let circulatingUSDR = ethers.constants.Zero;
  let distributedTNGBL = ethers.constants.Zero;
  const tngblPrice = await oracle.quote(ethers.constants.WeiPerEther, {
    blockTag: fromBlock,
  });

  for (const transaction of transactions) {
    const { data } = transaction;
    const [, , receivers, amounts] = batchSender.decodeFunctionData(
      "send",
      data
    );
    distributedTNGBL = amounts
      .reduce((acc, amount) => acc.add(amount), distributedTNGBL);
    const balanceResult = await provider.call({
      to: BALANCE_CHECKER_ADDRESS,
      data: ethers.utils.hexConcat([USDR_ADDRESS, ...receivers])
    }, fromBlock);
    const [usdrBalances] = ethers.utils.defaultAbiCoder.decode(["uint256[]"], balanceResult);
    circulatingUSDR = usdrBalances.reduce(
      (acc, balance) => acc.add(balance),
      circulatingUSDR
    );
  }
  distributedTNGBL = distributedTNGBL.mul(tngblPrice);
  const apyBN = circulatingUSDR.gt(ethers.constants.Zero)
    ? distributedTNGBL.mul(ethers.BigNumber.from(365)).div(circulatingUSDR)
    : ethers.constants.Zero;
  return parseFloat(ethers.utils.formatUnits(apyBN, 25));
};

module.exports = async () => {
  const timestamp = Math.floor(new Date().getTime() / 1000);
  const startOfDay = Math.floor(timestamp / 86400) * 86400;
  const apy = await computeAPY(startOfDay, "latest");
  //return (apy > 0 ? apy : (await computeAPY(startOfDay - 86400, startOfDay - 1))).toFixed(2);
  return "10.0";
}
