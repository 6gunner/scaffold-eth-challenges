// api参考https://ethereum-waffle.readthedocs.io/en/latest/
const { expect } = require("chai");
// const { ethers } = require("ethers");
const { ethers } = require("hardhat");

const { BigNumber } = require("ethers");
const { LazyMinter } = require("../lib");

async function deploy() {
  // hardhat.ethers.getSigners()会返回给我一些账户信息
  const [owner, redeemer, _] = await ethers.getSigners();

  // hardhat.ethers.getContractFactory 可以获取合约Factory函数
  const auctionFactory = await ethers.getContractFactory("Auction", owner);
  const auctionContract = await auctionFactory.deploy();
  const lazyFactory = await ethers.getContractFactory("LazyNFT", owner);
  const lazyNftContract = await lazyFactory.deploy(auctionContract.address);

  auctionContract.addAdministrator(owner.address);

  // the redeemerContract is an instance of the contract that's wired up to the redeemer's signing key
  const redeemerAuctionFactory = auctionFactory.connect(redeemer);
  const redeemerAuctionContract = redeemerAuctionFactory.attach(
    auctionContract.address
  );

  return {
    owner,
    redeemer,

    auctionContract,
    lazyNftContract,

    redeemerAuctionContract,
  };
}

describe("LazyNFT", function () {
  it("Should redeem an NFT from a signed voucher", async function () {
    const {
      auctionContract,
      lazyNftContract,
      redeemerAuctionContract,
      redeemer,
    } = await deploy();

    const lazyMinter = new LazyMinter({
      contract: auctionContract,
      signer: redeemer,
    });
    console.log("redeemer signer = ", redeemer.address);
    // const auctionId = ethers.utils.id(
    //   "Qme9T6kxqGE13fFLMN7o1gPXnojgktmDPENDphkHf5gMsn"
    // );

    const auctionId = "Qme9T6kxqGE13fFLMN7o1gPXnojgktmDPENDphkHf5gMsn";

    // console.log("auctionId：", auctionId);

    const voucher = await lazyMinter.createVoucher(
      auctionId,
      ethers.utils.parseEther("0.1"),
      "ipfs://Qme9T6kxqGE13fFLMN7o1gPXnojgktmDPENDphkHf5gMsn"
    );
    console.log("voucher：" + JSON.stringify(voucher));

    // create auction
    const duration = Math.floor(new Date().getTime() / 1000) + 1;
    await auctionContract.createTokenAuction(
      lazyNftContract.address,
      auctionId,
      ethers.utils.parseEther("0.1"),
      duration
    );

    const auction = await auctionContract.auctionIdToAuction(
      lazyNftContract.address,
      auctionId
    );
    // console.log("auction:", JSON.stringify(auction));

    // pick as wiiner
    await auctionContract.pickAsWinner(
      lazyNftContract.address,
      auctionId,
      ethers.utils.parseEther("0.1"),
      redeemer.address
    );

    await expect(
      redeemerAuctionContract.redeem(
        lazyNftContract.address,
        auctionId,
        voucher,
        {
          value: ethers.utils.parseEther("0.1"),
        }
      )
    )
      .to.emit(lazyNftContract, "Transfer") // transfer from null address to auctionContract
      .and.to.emit(lazyNftContract, "Transfer"); // transfer from minter to redeemer
  });

  // it("Should fail to redeem an NFT that's already been claimed", async function () {
  //   const { contract, redeemerContract, redeemer, minter } = await deploy();

  //   const lazyMinter = new LazyMinter({ contract, signer: minter });
  //   const voucher = await lazyMinter.createVoucher(
  //     1,
  //     "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
  //   );

  //   await expect(redeemerContract.redeem(redeemer.address, voucher))
  //     .to.emit(contract, "Transfer") // transfer from null address to minter
  //     .withArgs(
  //       "0x0000000000000000000000000000000000000000",
  //       minter.address,
  //       voucher.tokenId
  //     )
  //     .and.to.emit(contract, "Transfer") // transfer from minter to redeemer
  //     .withArgs(minter.address, redeemer.address, voucher.tokenId);

  //   await expect(
  //     redeemerContract.redeem(redeemer.address, voucher)
  //   ).to.be.revertedWith("ERC721: token already minted");
  // });

  // it("Should fail to redeem an NFT voucher that's signed by an unauthorized account", async function () {
  //   const { contract, redeemerContract, redeemer, minter } = await deploy();

  //   const signers = await ethers.getSigners();
  //   const rando = signers[signers.length - 1];

  //   const lazyMinter = new LazyMinter({ contract, signer: rando });
  //   const voucher = await lazyMinter.createVoucher(
  //     1,
  //     "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
  //   );

  //   await expect(
  //     redeemerContract.redeem(redeemer.address, voucher)
  //   ).to.be.revertedWith("Signature invalid or unauthorized");
  // });

  // it("Should fail to redeem an NFT voucher that's been modified", async function () {
  //   const { contract, redeemerContract, redeemer, minter } = await deploy();

  //   const signers = await ethers.getSigners();
  //   const rando = signers[signers.length - 1];

  //   const lazyMinter = new LazyMinter({ contract, signer: rando });
  //   const voucher = await lazyMinter.createVoucher(
  //     1,
  //     "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
  //   );
  //   voucher.tokenId = 2;
  //   await expect(
  //     redeemerContract.redeem(redeemer.address, voucher)
  //   ).to.be.revertedWith("Signature invalid or unauthorized");
  // });

  // it("Should fail to redeem an NFT voucher with an invalid signature", async function () {
  //   const { contract, redeemerContract, redeemer, minter } = await deploy();

  //   const signers = await ethers.getSigners();
  //   const rando = signers[signers.length - 1];

  //   const lazyMinter = new LazyMinter({ contract, signer: rando });
  //   const voucher = await lazyMinter.createVoucher(
  //     1,
  //     "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
  //   );

  //   const dummyData = ethers.utils.randomBytes(128);
  //   voucher.signature = await minter.signMessage(dummyData);

  //   await expect(
  //     redeemerContract.redeem(redeemer.address, voucher)
  //   ).to.be.revertedWith("Signature invalid or unauthorized");
  // });

  // it("Should redeem if payment is >= minPrice", async function () {
  //   const { contract, redeemerContract, redeemer, minter } = await deploy();

  //   const lazyMinter = new LazyMinter({ contract, signer: minter });
  //   const minPrice = ethers.constants.WeiPerEther; // charge 1 Eth
  //   const voucher = await lazyMinter.createVoucher(
  //     1,
  //     "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  //     minPrice
  //   );

  //   await expect(
  //     redeemerContract.redeem(redeemer.address, voucher, { value: minPrice })
  //   )
  //     .to.emit(contract, "Transfer") // transfer from null address to minter
  //     .withArgs(
  //       "0x0000000000000000000000000000000000000000",
  //       minter.address,
  //       voucher.tokenId
  //     )
  //     .and.to.emit(contract, "Transfer") // transfer from minter to redeemer
  //     .withArgs(minter.address, redeemer.address, voucher.tokenId);
  // });

  // it("Should fail to redeem if payment is < minPrice", async function () {
  //   const { contract, redeemerContract, redeemer, minter } = await deploy();

  //   const lazyMinter = new LazyMinter({ contract, signer: minter });
  //   const minPrice = ethers.constants.WeiPerEther; // charge 1 Eth
  //   const voucher = await lazyMinter.createVoucher(
  //     1,
  //     "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  //     minPrice
  //   );

  //   const payment = minPrice.sub(10000);
  //   await expect(
  //     redeemerContract.redeem(redeemer.address, voucher, { value: payment })
  //   ).to.be.revertedWith("Insufficient funds to redeem");
  // });

  // it("Should make payments available to minter for withdrawal", async function () {
  //   const { contract, redeemerContract, redeemer, minter } = await deploy();

  //   const lazyMinter = new LazyMinter({ contract, signer: minter });
  //   const minPrice = ethers.constants.WeiPerEther; // charge 1 Eth
  //   const voucher = await lazyMinter.createVoucher(
  //     1,
  //     // https://ipfs.io/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi
  //     "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  //     minPrice
  //   );
  //   contract.getAddress = () => contract.address;
  //   // console.log(contract.getAddress);

  //   // the payment should be sent from the redeemer's account to the contract address
  //   await expect(
  //     await redeemerContract.redeem(redeemer.address, voucher, {
  //       value: minPrice,
  //     })
  //   ).to.changeEtherBalances(
  //     [redeemer, contract],
  //     [minPrice.mul(-1), minPrice]
  //   );

  //   // minter should have funds available to withdraw
  //   expect(await contract.availableToWithdraw()).to.equal(minPrice);

  //   // withdrawal should increase minter's balance
  //   await expect(await contract.withdraw()).to.changeEtherBalance(
  //     minter,
  //     minPrice
  //   );

  //   // minter should now have zero available
  //   expect(await contract.availableToWithdraw()).to.equal(0);
  // });
});
