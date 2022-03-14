//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract LazyNFT is ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenCounter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    mapping(bytes32 => uint256) public uriToTokenId;

    constructor(address payable minter) ERC721("LazyNFT", "LazyNFT") {
        // 设置只有某一个地址有权限mint
        _setupRole(MINTER_ROLE, minter);
    }

    function mint(string memory metadataURI) public returns (uint256) {
        require(hasRole(MINTER_ROLE, msg.sender), "unauthorized");

        bytes32 uriHash = keccak256(abi.encodePacked(metadataURI));
        _tokenCounter.increment();
        uint256 tokenId = _tokenCounter.current();
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, metadataURI);
        uriToTokenId[uriHash] = tokenId;
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
