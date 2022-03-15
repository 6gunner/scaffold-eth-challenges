// deploy/00_deploy_your_contract.js

const { ethers } = require("hardhat");

const localChainId = "31337";

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("Auction", {
    from: deployer,
    args: [],
    log: true,
  });

  const AuctionContract = await ethers.getContract("Auction", deployer);

  await AuctionContract.addAdministrator(
    "0xD0c535D4B6cFe3d3E11A4F3428Df0697C769920B"
  );

  const result = await AuctionContract.administrators(
    "0xD0c535D4B6cFe3d3E11A4F3428Df0697C769920B"
  );
  console.log("添加管理员:" + result);

  await deploy("LazyNFT", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    from: deployer,
    args: [AuctionContract.address], // 配置成为minter
    log: true,
  });

  // Getting a previously deployed contract
  const LazyNFT = await ethers.getContract("LazyNFT", deployer);
  console.log("LazyNFT部署成功", LazyNFT.address);
};
module.exports.tags = ["LazyNFT"];
