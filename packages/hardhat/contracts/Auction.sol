//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

interface LazyNFTERC721 {
    function mint(string memory uri) external returns (uint256);
}

contract Auction is IERC721Receiver, EIP712, Ownable {
    string private constant SIGNING_DOMAIN = "LazyNFT-Voucher";
    string private constant SIGNATURE_VERSION = "1";

    constructor() EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {}

    struct AuctionDetails {
        address seller;
        uint256 startPrice;
        uint256 startTime;
        uint256 endTime;
        uint256 duration;
        // 最终竞拍人
        address redeemer;
        uint256 bidderPrice;
        bool isActive;
    }

    struct NFTVoucher {
        bytes32 auctionId;
        string redeemer;
        uint256 minPrice;
        string uri;
        bytes signature;
    }

    mapping(address => bool) public administrators;

    mapping(address => mapping(bytes32 => AuctionDetails))
        public tokenToAuction;

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
        bytes32 _tokenUri,
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
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            redeemer: address(0),
            bidderPrice: uint128(_price),
            isActive: true
        });
        tokenToAuction[_nftAddress][_tokenUri] = _auction;
    }

    // 管理员取消auction
    function cancelAuction(address _nft, bytes32 _tokenUri) external onlyAdmin {
        AuctionDetails storage _auction = tokenToAuction[_nft][_tokenUri];
        require(_auction.isActive);
        _auction.isActive = false;
    }

    function getTokenAuctionDetails(address _nft, bytes32 _tokenUri)
        public
        view
        returns (AuctionDetails memory)
    {
        AuctionDetails memory auction = tokenToAuction[_nft][_tokenUri];
        return auction;
    }

    // todo 第二版本可以做成签名方法来免除gas
    function pickAsWinner(
        address _nftAddress,
        bytes32 _tokenUri,
        uint256 price,
        address bidder
    ) external {
        AuctionDetails storage auction = tokenToAuction[_nftAddress][_tokenUri];
        require(msg.sender == auction.seller);
        auction.redeemer = bidder;
        auction.bidderPrice = price;
    }

    // reedeem 领取token
    function redeem(
        address _nftAddress,
        bytes32 _tokenUri,
        NFTVoucher calldata voucher
    ) public payable returns (uint256) {
        require(_tokenUri == voucher.auctionId);
        address signer = _verify(voucher);
        require(msg.sender == signer);
        AuctionDetails storage auction = tokenToAuction[_nftAddress][_tokenUri];
        require(
            msg.value >= auction.bidderPrice,
            "Insufficient funds to redeem"
        );
        require(msg.sender == auction.redeemer, "NOT the winner");

        // 先铸币到当前合约地址上
        uint256 tokenId = LazyNFTERC721(_nftAddress).mint(voucher.uri);
        address owner = msg.sender;
        ERC721(_nftAddress).safeTransferFrom(address(this), owner, tokenId);
        (bool success, ) = auction.seller.call{value: auction.bidderPrice}("");
        require(success);
        return tokenId;
    }

    function _hash(NFTVoucher calldata voucher)
        internal
        view
        returns (bytes32)
    {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "NFTVouncher(bytes32 auctionId, uint256 minPrice, string uri)"
                        ),
                        voucher.auctionId,
                        voucher.minPrice,
                        keccak256(bytes(voucher.uri))
                    )
                )
            );
    }

    function _verify(NFTVoucher calldata voucher)
        internal
        view
        returns (address)
    {
        return ECDSA.recover(_hash(voucher), voucher.signature);
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
}
