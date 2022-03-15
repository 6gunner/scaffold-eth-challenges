import React, { useState, useEffect, useCallback } from "react";
import StackGrid from "react-stack-grid";
import { Modal, Card, Button, InputNumber, notification } from "antd";
import { ethers, BigNumber, utils } from "ethers";
import { format } from "date-fns";
import { LinkOutlined } from "@ant-design/icons";

import { Address } from "../components";
import { AddressZero } from "../constants";
import assets from "../assets";
import LazyMinter from "../LazyMinter";

function GalleryList({
  mainnetProvider,
  userSigner,
  blockExplorer,
  tx,
  address,
  readContracts,
  writeContracts,
  transferEvents,
}) {
  const [isAdmin, setAdmin] = useState(false);
  useEffect(() => {
    const read = async () => {
      const result = await readContracts.Auction.administrators(address);
      setAdmin(result);
    };
    if (address) {
      read();
    }
  }, [address]);

  const [loadedAssets, setLoadedAssets] = useState([]);
  const updateAuctionList = useCallback(async () => {
    let assetUpdate = [];
    const nftAddress = readContracts.LazyNFT.address;

    for (let id in assets) {
      let owner = "";
      let tokenId = "";
      let auctionInfo = {};
      let bidsInfo = {};
      try {
        const auctionId = id;
        tokenId = await readContracts.LazyNFT.auctionIdToTokenId(auctionId);
        if (tokenId && tokenId.toNumber() != 0) {
          try {
            owner = await readContracts.LazyNFT.ownerOf(tokenId);
          } catch {
            owner = "";
          }
        }
        try {
          auctionInfo = await readContracts.Auction.getTokenAuctionDetails(nftAddress, auctionId);
        } catch {
          auctionInfo = {};
        }
        try {
          bidsInfo = await fetch(`http://localhost:8001/${id}`).then(data => data.json());
        } catch {
          bidsInfo = {};
        }
        assetUpdate.push({
          id,
          ...assets[id],
          auctionInfo,
          bidsInfo,
          owner,
          tokenId,
        });
      } catch (e) {
        console.error(e);
      }
    }
    setLoadedAssets(assetUpdate);
  }, [assets, readContracts]);

  useEffect(() => {
    if (assets && readContracts && readContracts.LazyNFT) {
      updateAuctionList();
    }
  }, [assets, readContracts, transferEvents]);

  // 竞拍Modal里用到
  const [auctionDetails, setAuctionDetails] = useState({ price: "", duration: "" });
  const [auctionId, setAuctionId] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [yourBid, setYourBid] = useState({});

  const startAuction = id => {
    return async () => {
      setAuctionId(id);
      setModalVisible(true);
    };
  };

  const placeBid = async (loadedAsset, ethAmount) => {
    // const auctionId = utils.id(loadedAsset.id);
    const auctionId = loadedAsset.id;
    const parsedAmount = utils.parseEther(ethAmount.toString());
    const minPrice = loadedAsset.auctionInfo.startPrice;

    if (parsedAmount.lt(minPrice)) {
      return notification.error({
        message: "Invalid amount for bid",
        description:
          "This bid is not allowed. It is either less than minimum price or you do not have enough staked ETH.",
      });
    }
    const lazyMinter = new LazyMinter({ contract: readContracts.Auction, signer: userSigner });
    const voucher = await lazyMinter.createVoucher(auctionId, parsedAmount, `ipfs://${loadedAsset.id}`);

    await fetch("http://localhost:8001/", {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: loadedAsset.id,
        bidder: address,
        hash: voucher.signature,
        voucher,
      }),
    });
    updateAuctionList();
  };

  const handleOk = async auctionId => {
    setModalVisible(false);
    const { price, duration } = auctionDetails;
    const nftAddress = readContracts.LazyNFT.address;
    const ethPrice = utils.parseEther(price.toString());
    const blockDuration = Math.floor(new Date().getTime() / 1000) + duration;

    await tx(writeContracts.Auction.createTokenAuction(nftAddress, auctionId, ethPrice, blockDuration));

    const auctionInfo = await readContracts.Auction.getTokenAuctionDetails(nftAddress, auctionId);
    console.log("auctionInfo", { auctionInfo });
    updateAuctionList();
  };

  const handleCancel = () => {
    setModalVisible(false);
  };

  const pickAsWinner = async (loadedAsset, bidInfo) => {
    console.log("WINNER:", loadedAsset, bidInfo);
    const nftAddress = readContracts.LazyNFT.address;
    // const auctionId = utils.id(bidInfo.id);
    const auctionId = loadedAsset.id;
    await tx(writeContracts.Auction.pickAsWinner(nftAddress, auctionId, bidInfo.bidder, bidInfo.voucher));
    updateAuctionList();
    // clearAuctionId(loadedAsset.id);
  };

  const clearAuctionId = async auctionId => {
    await fetch("http://localhost:8001/clearAddress", {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: auctionId,
      }),
    });
    updateAuctionList();
  };

  const cancelAuction = loadedAsset => {
    const auctionId = loadedAsset.id;
    return async () => {
      // const tokenId = await readContracts.Auction.uriToTokenId(utils.id(auctionId));
      const nftAddress = readContracts.LazyNFT.address;
      await tx(writeContracts.Auction.cancelAuction(nftAddress, auctionId));
      clearAuctionId(auctionId);
    };
  };

  const claim = async ({ id, auctionInfo, bidsInfo }) => {
    const auctionId = id;
    const nftAddress = readContracts.LazyNFT.address;
    const { voucher } = bidsInfo[address];
    // const voucher = await readContracts.Auction.auctionIdToVoucher(nftAddress, auctionId);
    await tx(
      writeContracts.Auction.redeem(nftAddress, auctionId, voucher, {
        value: auctionInfo.bidPrice.toString(),
      }),
      () => {
        // clearAuctionId(auctionId);
      },
    );
  };

  let galleryList = [];
  loadedAssets.forEach(item => {
    let cardActions = [];
    let auctionDetails = [];
    const { tokenId, owner, bidsInfo, auctionInfo } = item;
    const deadline = auctionInfo.duration ? new Date(auctionInfo.duration * 1000) : new Date();
    const isEnded = deadline <= new Date();
    const hasBeenBid = Object.keys(bidsInfo).length > 0;
    cardActions.push(
      <div className="cardAction">
        {tokenId && auctionInfo.isEnd && owner && (
          <>
            tokenId: {tokenId.toString()} <br />
            owned by:{" "}
            <Address address={owner} ensProvider={mainnetProvider} blockExplorer={blockExplorer} minimized={true} />
          </>
        )}
        {auctionInfo.isEnd && !owner && auctionInfo.bidder && <div>not claimed</div>}
        {!item.auctionInfo.isActive ? (
          <>
            <Button style={{ marginBottom: "10px" }} onClick={startAuction(item.id)} disabled={!isAdmin}>
              Start auction
            </Button>
            <br />
          </>
        ) : (
          ""
        )}
        {item.auctionInfo.isActive && !isEnded && !hasBeenBid && address === item.auctionInfo.seller && (
          <>
            <Button style={{ marginBottom: "10px" }} onClick={cancelAuction(item)}>
              Cancel auction
            </Button>
            <br />
          </>
        )}
      </div>,
    );

    auctionDetails.push(
      auctionInfo.isActive ? (
        <div style={{ marginTop: "20px" }}>
          <p style={{ margin: 0, marginBottom: "2px" }}>
            Minimal price is {utils.formatEther(auctionInfo.startPrice)} ETH
          </p>
          <p style={{ marginTop: 0 }}>
            {!isEnded ? `Auction ends at ${format(deadline, "MMMM dd, HH:mm:ss")}` : "Auction has already ended"}
          </p>
          <div>
            {auctionInfo.bidder === AddressZero ? (
              "Winner bid was not made yet"
            ) : (
              <div>
                Winner is:
                <Address
                  address={auctionInfo.bidder}
                  ensProvider={mainnetProvider}
                  blockExplorer={blockExplorer}
                  minimized={true}
                />
                <p>{utils.formatEther(auctionInfo.bidPrice)} ETH</p>
              </div>
            )}
          </div>

          {!isEnded && auctionInfo.seller !== address && (
            <div>
              <div style={{ display: "flex", alignItems: "center", marginTop: "20px" }}>
                <p style={{ margin: 0, marginRight: "15px" }}>Your bid in ETH: </p>
                <InputNumber
                  placeholder="0.1"
                  value={yourBid[item.id]}
                  onChange={newBid => setYourBid({ ...yourBid, [item.id]: newBid })}
                  style={{ flexGrow: 1 }}
                />
              </div>
              <Button
                style={{ marginTop: "7px", marginBottom: "20px" }}
                onClick={() => placeBid(item, yourBid[item.id])}
                disabled={!yourBid[item.id] || isEnded}
              >
                Place a bid
              </Button>
            </div>
          )}
          {auctionInfo.isEnd &&
            auctionInfo.bidder === address &&
            (!auctionInfo.tokenId || auctionInfo.tokenId.toNumber() == 0) && (
              <Button style={{ marginTop: "7px", marginBottom: "20px" }} onClick={() => claim(item)}>
                Claim
              </Button>
            )}

          {item.auctionInfo.isActive && !item.auctionInfo.isEnd ? (
            <div>
              {Object.entries(bidsInfo).map(([_, bidInfo]) => (
                <div style={{ marginBottom: "20px" }}>
                  Bid by:{" "}
                  <Address
                    address={bidInfo.bidder}
                    ensProvider={mainnetProvider}
                    blockExplorer={blockExplorer}
                    minimized={true}
                  />
                  <p style={{ margin: 0 }}>{utils.formatEther(bidInfo.voucher.bidPrice)} ETH</p>
                  {address === item.auctionInfo.seller && (
                    <Button disabled={!isEnded} onClick={() => pickAsWinner(item, bidInfo)}>
                      Pick as a winner
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            ""
          )}
        </div>
      ) : null,
    );

    galleryList.push(
      <>
        <Card
          style={{ width: 300 }}
          key={item.id}
          actions={cardActions}
          title={
            <div>
              {item.name}{" "}
              <a style={{ cursor: "pointer", opacity: 0.33 }} href={item.external_url} target="_blank">
                <LinkOutlined />
              </a>
            </div>
          }
        >
          <img style={{ maxWidth: 130 }} src={item.image} />
          <div style={{ opacity: 0.77 }}>{item.description}</div>
          {auctionDetails}
        </Card>
      </>,
    );
  });

  return (
    <>
      <StackGrid columnWidth={300} gutterWidth={16} gutterHeight={16}>
        {galleryList}
      </StackGrid>
      <Modal
        title="Start auction"
        visible={modalVisible}
        onOk={() => handleOk(auctionId)}
        onCancel={handleCancel}
        okButtonProps={{ disabled: !auctionDetails.price || !auctionDetails.duration }}
        okText="Start"
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <p style={{ margin: 0, marginRight: "15px" }}>ETH price (minimal bid): </p>
          <InputNumber
            placeholder="0.1"
            value={auctionDetails.price}
            onChange={newPrice => setAuctionDetails({ ...auctionDetails, price: newPrice })}
            style={{ flexGrow: 1 }}
          />
        </div>
        <br />
        <div style={{ display: "flex", alignItems: "center" }}>
          <p style={{ margin: 0, marginRight: "15px" }}>Duration in seconds: </p>
          <InputNumber
            placeholder="3600"
            value={auctionDetails.duration}
            onChange={newDuration => setAuctionDetails({ ...auctionDetails, duration: newDuration })}
            style={{ flexGrow: 1 }}
          />
        </div>
      </Modal>
    </>
  );
}

export default GalleryList;
