//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2; // required to accept structs as function parameters
// pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

interface LazyNFTERC721 {
    function mint(string memory auctionId, string memory uri)
        external
        returns (uint256);
}

contract Auction is IERC721Receiver, EIP712, Ownable {
    string private constant SIGNING_DOMAIN = "LazyNFT-Voucher";
    string private constant SIGNATURE_VERSION = "1";

    using ECDSA for bytes32;

    constructor() EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {}

    struct NFTVoucher {
        string auctionId;
        uint256 bidPrice;
        string uri;
        bytes signature;
    }

    struct AuctionDetails {
        address seller;
        uint256 startPrice;
        uint256 duration;
        // 最终竞拍人
        address bidder;
        uint256 bidPrice;
        bool isActive;
        bool isEnd;
        uint256 tokenId;
    }

    mapping(address => bool) public administrators;

    mapping(address => mapping(string => AuctionDetails))
        public auctionIdToAuction;

    mapping(address => mapping(string => NFTVoucher)) public auctionIdToVoucher;

    modifier onlyAdmin() {
        require(
            administrators[msg.sender],
            "Only Administrator can call this."
        );
        _;
    }

    function addAdministrator(address adminAdress) external onlyOwner {
        administrators[adminAdress] = true;
    }

    // 管理员创建auction
    function createTokenAuction(
        address _nftAddress,
        string memory _auctionId,
        uint256 _price,
        uint256 _duration
    ) external onlyAdmin {
        require(_nftAddress != address(0));
        require(_price > 0);
        require(_duration > 0);
        AuctionDetails memory _auction = AuctionDetails({
            seller: msg.sender,
            startPrice: uint128(_price),
            duration: _duration,
            isActive: true,
            bidder: address(0),
            bidPrice: uint128(_price),
            isEnd: false,
            tokenId: 0
        });
        auctionIdToAuction[_nftAddress][_auctionId] = _auction;
    }

    // 管理员取消auction
    function cancelAuction(address _nft, string memory _auctionId)
        external
        onlyAdmin
    {
        AuctionDetails storage _auction = auctionIdToAuction[_nft][_auctionId];
        require(_auction.isActive);
        _auction.isActive = false;
    }

    function getTokenAuctionDetails(address _nft, string memory _auctionId)
        public
        view
        returns (AuctionDetails memory)
    {
        AuctionDetails memory auction = auctionIdToAuction[_nft][_auctionId];
        return auction;
    }

    // todo 第二版本可以做成签名方法来免除gas
    function pickAsWinner(
        address _nftAddress,
        string memory _auctionId,
        address _bidder,
        NFTVoucher calldata voucher
    ) external {
        AuctionDetails storage auction = auctionIdToAuction[_nftAddress][
            _auctionId
        ];
        require(auction.isActive, "auction is not active");
        require(block.timestamp >= auction.duration, "auction not end");
        require(msg.sender == auction.seller, "not the seller");
        auction.bidder = _bidder;
        auction.bidPrice = voucher.bidPrice;
        auction.isActive = true;
        auction.isEnd = true;

        auctionIdToVoucher[_nftAddress][_auctionId] = voucher;
    }

    function _hash(NFTVoucher calldata voucher)
        internal
        view
        returns (bytes32)
    {
        bytes32 NFTVoucher_TYPE_HASH = keccak256(
            "NFTVoucher(string auctionId,uint256 bidPrice,string uri)"
        );
        bytes32 structHash = keccak256(
            abi.encode(
                NFTVoucher_TYPE_HASH,
                keccak256(bytes(voucher.auctionId)),
                voucher.bidPrice,
                keccak256(bytes(voucher.uri))
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function _verify(NFTVoucher calldata voucher)
        internal
        view
        returns (address)
    {
        bytes32 digest = _hash(voucher);
        return ECDSA.recover(digest, voucher.signature); // 失败了
    }

    // function _hash(
    //     string memory auctionId,
    //     uint256 bidPrice,
    //     string memory uri
    // ) internal view returns (bytes32) {
    //     bytes32 NFTVoucher_TYPE_HASH = keccak256(
    //         "NFTVoucher(string auctionId,uint256 bidPrice,string uri)"
    //     );
    //     return
    //         _hashTypedDataV4(
    //             keccak256(
    //                 abi.encode(
    //                     NFTVoucher_TYPE_HASH,
    //                     keccak256(bytes(auctionId)),
    //                     bidPrice,
    //                     keccak256(bytes(uri))
    //                 )
    //             )
    //         );
    // }

    // function _verify(bytes32 digest, bytes memory signature)
    //     internal
    //     view
    //     returns (address)
    // {
    //     return ECDSA.recover(digest, signature);
    // }

    // reedeem 领取token
    function redeem(
        address _nftAddress,
        string memory _auctionId,
        NFTVoucher calldata voucher
    ) public payable returns (uint256) {
        // address signer = _verify(
        //     _hash(voucher.auctionId, voucher.bidPrice, voucher.uri),
        //     voucher.signature
        // );
        address signer = _verify(voucher);
        require(msg.sender == signer, "Invalid signature");

        AuctionDetails storage auction = auctionIdToAuction[_nftAddress][
            _auctionId
        ];
        require(msg.value >= auction.bidPrice, "Insufficient funds to redeem");
        require(msg.sender == auction.bidder, "NOT the winner");
        // 先铸币到当前合约地址上
        uint256 tokenId = LazyNFTERC721(_nftAddress).mint(
            _auctionId,
            voucher.uri
        );
        address owner = msg.sender;
        ERC721(_nftAddress).safeTransferFrom(address(this), owner, tokenId);
        (bool success, ) = auction.seller.call{value: auction.bidPrice}("");
        require(success);
        auction.tokenId = tokenId;
        return tokenId;
    }

    // 可以接收NFT
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return
            bytes4(
                keccak256("onERC721Received(address,address,uint256,bytes)")
            );
    }

    function getChainID() external view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }
}
