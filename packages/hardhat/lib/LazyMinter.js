const { assert } = require("chai");
const ethers = require("ethers");

// These constants must match the ones used in the smart contract.
const SIGNING_DOMAIN_NAME = "LazyNFT-Voucher";
const SIGNING_DOMAIN_VERSION = "1";

/**
 * LazyMinter is a helper class that creates NFTVoucher objects and signs them, to be redeemed later by the LazyNFT contract.
 */
class LazyMinter {
  /**
   * Create a new LazyMinter targeting a deployed instance of the LazyNFT contract.
   *
   * @param {Object} options
   * @param {ethers.Contract} contract an ethers Contract that's wired up to the deployed contract
   * @param {ethers.Signer} signer a Signer whose account is authorized to mint NFTs on the deployed contract
   */
  constructor({ contract, signer }) {
    this.contract = contract;
    this.signer = signer;
  }

  /**
   * Creates a new NFTVoucher object and signs it using this LazyMinter's signing key.

   * @returns {NFTVoucher}
   */
  async createVoucher(auctionId, bidPrice, uri) {
    const voucher = { auctionId, bidPrice, uri };
    const domain = await this._signingDomain();

    const types = {
      NFTVoucher: [
        { name: "auctionId", type: "string" },
        { name: "bidPrice", type: "uint256" },
        { name: "uri", type: "string" },
      ],
    };
    const signature = await this.signer._signTypedData(domain, types, voucher);

    const recoveredAddress = ethers.utils.verifyTypedData(
      domain,
      types,
      voucher,
      signature
    );

    const expectedSignerAddress = this.signer.address;

    assert(recoveredAddress === expectedSignerAddress);

    console.log("recoveredAddress = " + recoveredAddress);

    return {
      ...voucher,
      signature,
    };
  }

  /**
   * @private
   * @returns {object} the EIP-721 signing domain, tied to the chainId of the signer
   */
  async _signingDomain() {
    if (this._domain != null) {
      return this._domain;
    }
    const chainId = await this.contract.getChainID();
    this._domain = {
      name: SIGNING_DOMAIN_NAME,
      version: SIGNING_DOMAIN_VERSION,
      verifyingContract: this.contract.address,
      chainId,
    };
    return this._domain;
  }
}

module.exports = {
  LazyMinter,
};
