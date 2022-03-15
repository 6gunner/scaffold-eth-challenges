//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";

contract LazyNFT is ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenCounter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    mapping(string => uint256) public auctionIdToTokenId;

    constructor(address payable minter) ERC721("LazyNFT", "LZT") {
        // 设置只有某一个地址有权限mint
        _setupRole(MINTER_ROLE, minter);
    }

    function mint(string memory auctionId, string memory metadataURI)
        public
        returns (uint256)
    {
        require(hasRole(MINTER_ROLE, msg.sender), "unauthorized");
        _tokenCounter.increment();
        uint256 tokenId = _tokenCounter.current();
        if (tokenId == 0) {
            _tokenCounter.increment();
        }
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, metadataURI);
        auctionIdToTokenId[auctionId] = tokenId;
        return tokenId;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControl, ERC721)
        returns (bool)
    {
        return
            ERC721.supportsInterface(interfaceId) ||
            AccessControl.supportsInterface(interfaceId);
    }
}
