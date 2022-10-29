const ethers = require("ethers");

const provider = require("./provider.js");

const USDR_CONTRACT = require(`./abi/USDR.json`);

module.exports = async () => {
  const USDR = new ethers.Contract(
    USDR_CONTRACT.address,
    USDR_CONTRACT.abi,
    provider
  );

  const today = Math.floor(new Date().getTime() / (60 * 60 * 24 * 1000));

  const lastEvent = (events) => {
    const sorted = events
      .map((e) => e.args)
      .sort((a, b) => b.blockNumber.sub(a.blockNumber).toNumber());
    return sorted[0];
  };

  const first = USDR.queryFilter(USDR.filters.Rebase(null, today - 2)).then(
    (events) => {
      if (events.length) {
        return lastEvent(events).index;
      }
      return ethers.utils.parseUnits("1", 27);
    }
  );
  const last = USDR.queryFilter(USDR.filters.Rebase(null, today - 1)).then(
    (events) => {
      if (events.length) {
        return lastEvent(events).index;
      }
      return ethers.utils.parseUnits("1", 27);
    }
  );
  return await Promise.all([first, last])
    .then((results) => {
      const [firstIndex, lastIndex] = results;
      const diff = lastIndex.sub(firstIndex);
      if (diff.gt(ethers.constants.Zero)) {
        return (
          diff.mul(ethers.BigNumber.from(3650000)).div(firstIndex).toNumber() /
          100
        );
      }
      return 8;
    })
    .then((apr) => {
      return ((Math.pow(1 + apr / 36500, 365) - 1) * 100).toFixed(2);
    });
};