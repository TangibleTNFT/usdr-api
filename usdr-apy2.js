const { Contract, ethers, utils, constants } = require("ethers");

const cache = require("./cache.js").create();
const provider = require("./provider.js");

const ADDRESS_PROVIDER_ADDRESS = '0xE95BCf65478d6ba44C5F57740CfA50EA443619eA';
const REAL_ESTATE_ADDRESS = '0x29613FbD3e695a669C647597CEFd60bA255cc1F8';
const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

const USDR_CONTRACT = require(`./abi/USDR.json`);

// ABIs for the different smart contracts being used
const ADDRESS_PROVIDER_ABI = [
  "function getAddresses(bytes) view returns (bytes)",
];

const DISTRIBUTOR_ABI = [
    "function rentShareContract() view returns (address)",
    "function paused() view returns (bool)",
    "function dailyAmount() view returns (uint256)",
];

const FRACTION_ABI = [
  "function fractionShares(uint256) view returns (uint256)",
  "function tnft() view returns (address)",
  "function tnftTokenId() view returns (uint256)",
];

const INCENTIVE_VAULT_ABI = [
  "function apr() view returns (uint256)",
];
  
const RENT_SHARE_ABI = [
  "function distributorForToken(address, uint256) view returns (address)",
];

const TREASURY_TRACKER_ABI = [
  "function tnftTokensInTreasurySize(address) view returns (uint256)",
  "function tnftTokensInTreasury(address, uint256) view returns (uint256)",
  "function tnftFractionContractsInTreasurySize(address) view returns (uint256)",
  "function tnftFractionsContracts(address, uint256) view returns (address)",
  "function getFractionTokensInTreasury(address ftnft) view returns (uint256[])",
];

const MULTICALL_ABI = [
  "function aggregate(tuple(address target, bytes callData)[] calldata calls) returns (uint256 blockNumber, bytes[] memory returnData)"
];

const calculateAPY = async () => {

  const multicall = new ethers.Contract(
    MULTICALL_ADDRESS,
    MULTICALL_ABI,
    provider
  );

  const USDR = new ethers.Contract(
      USDR_CONTRACT.address,
      USDR_CONTRACT.abi,
      provider
  );
    
  // Instantiate a new contract instance for the address provider
  const ap = new Contract(
    ADDRESS_PROVIDER_ADDRESS,
    ADDRESS_PROVIDER_ABI,
    provider
  );

  // Encode the required addresses and get them using the address provider
  const addresses = utils.defaultAbiCoder.encode(
    ["bytes32", "bytes32", "bytes32"],
    ["IncentiveVault", "TangibleRentShare", "TreasuryTracker"].map((name) => utils.id(name))
  );
  const [incentiveVaultAddress, rentShareContractAddress, treasuryTrackerAddress] =
    utils.defaultAbiCoder.decode(
      ["address", "address", "address"],
      await ap.getAddresses(addresses)
    );

  // Instantiate new contract instances for the rent share and treasury tracker
  const treasuryTracker = new Contract(
    treasuryTrackerAddress,
    TREASURY_TRACKER_ABI,
    provider
  );
  const rentShare = new Contract(
    rentShareContractAddress,
    RENT_SHARE_ABI,
    provider
  );

  async function fetchDailyPayouts() {
    // Get the number of tokens in the treasury for the given real estate contract
    const numTokens = await treasuryTracker
      .tnftTokensInTreasurySize(REAL_ESTATE_ADDRESS)
      .then(result => result.toNumber());

    // Loop through all the tokens in the treasury and check for any claimable rent

    // get token ids
    let calls = [];
    for (let i = 0; i < numTokens; i++) {
      calls.push({
        target: treasuryTracker.address,
        callData: treasuryTracker.interface.encodeFunctionData('tnftTokensInTreasury', [REAL_ESTATE_ADDRESS, i])
      });
    }
    const tokenIds = await multicall.callStatic.aggregate(calls).then(({returnData}) => {
      return returnData.map((data) => {
        const [tokenId] = treasuryTracker.interface.decodeFunctionResult('tnftTokensInTreasury', data);
        return tokenId;
      });
    });

    // get distributors
    calls = [];
    for (let i = 0; i < numTokens; i++) {
      calls.push({
        target: rentShare.address,
        callData: rentShare.interface.encodeFunctionData('distributorForToken', [REAL_ESTATE_ADDRESS, tokenIds[i]])
      });
    }
    const distributors = await multicall.callStatic.aggregate(calls).then(({returnData}) => {
      return returnData.map((data) => {
        const [distributorAddress] = rentShare.interface.decodeFunctionResult('distributorForToken', data);
        return distributorAddress;
      });
    });

    // get daily amounts
    const distributor = new ethers.utils.Interface(DISTRIBUTOR_ABI);
    calls = [];
    for (let i = 0; i < numTokens; i++) {
      calls.push({
        target: distributors[i],
        callData: distributor.encodeFunctionData('paused')
      });
      calls.push({
        target: distributors[i],
        callData: distributor.encodeFunctionData('dailyAmount')
      });
    }
    const dailyAmounts = await multicall.callStatic.aggregate(calls).then(({returnData}) => {
      const amounts = [];
      for (let i = 0; i < numTokens; i += 2) {
        const [isPaused] = distributor.decodeFunctionResult('paused', returnData[i]);
        const [dailyAmount] = distributor.decodeFunctionResult('dailyAmount', returnData[i + 1]);
        amounts.push(isPaused ? constants.Zero : dailyAmount);
      }
      return amounts;
    });

    return dailyAmounts.reduce((a, b) => a.add(b), constants.Zero);
  }

  let dailyPayout = await cache.get(
    `tnft-daily-payout`,
    fetchDailyPayouts,
    3600
  );

  // Get the number of TNFT fractions in treasury for the real estate contract
  const numFractions = await treasuryTracker
    .tnftFractionContractsInTreasurySize(REAL_ESTATE_ADDRESS)
    .then(result => result.toNumber());

  // Loop through all TNFT fractions in treasury
  for (let j = 0; j < numFractions; j++) {
    // Get the address of the j-th TNFT fraction contract in treasury for the real estate contract
    const fractionContractAddress =
      await treasuryTracker.tnftFractionsContracts(
        REAL_ESTATE_ADDRESS,
        j
      );
    // Get all fraction tokens in treasury for the fraction contract
    const fractionTokenIds = await treasuryTracker.getFractionTokensInTreasury(
      fractionContractAddress
    );
    // Create a Contract instance for the fraction contract
    const fraction = new Contract(
      fractionContractAddress,
      FRACTION_ABI,
      provider
    );

    // Get the TNFT contract address and token ID for the fraction
    const contractAddress = await fraction.tnft();
    const tokenId = await fraction.tnftTokenId();

    // Get the distributor address for the TNFT token
    const distributorAddress = await rentShare.distributorForToken(
      contractAddress,
      tokenId
    );
    // Create a Contract instance for the distributor contract
    const distributor = new Contract(
      distributorAddress,
      DISTRIBUTOR_ABI,
      provider
    );

    const fullPayout = await cache.get(
      `payout-${distributorAddress}`,
      () => distributor.paused().then(isPaused => isPaused ? constants.Zero : distributor.dailyAmount()),
      10800
    );

    // Loop through all fraction tokens in treasury for the fraction contract
    const numFractionTokenIds = fractionTokenIds.length;
    for (let k = 0; k < numFractionTokenIds; k++) {
      const tokenShare = await fraction.fractionShares(fractionTokenIds[k]);
      dailyPayout = dailyPayout.add(fullPayout.mul(tokenShare).div(utils.parseUnits("100", 5)));
    }
  }

  const incentiveVault = new Contract(
    incentiveVaultAddress,
    INCENTIVE_VAULT_ABI,
    provider
  );

  const totalSupply = await USDR.totalSupply();
  const incentive = await incentiveVault.apr();
  const apr = await dailyPayout.mul(utils.parseUnits('365', 7)).div(totalSupply).add(incentive).toNumber() / 100;
  const apy = ((Math.pow(1 + apr / 36500, 365) - 1) * 100).toFixed(2);

  console.log('APR:', apr);
  console.log('APY:', apy);

  return apy;
}

// calculateAPY();

module.exports = calculateAPY;