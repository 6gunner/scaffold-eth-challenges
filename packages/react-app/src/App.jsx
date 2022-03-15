import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Switch } from "react-router-dom";
import { Modal, Card, List, Alert, Button, Col, Menu, Row, InputNumber, notification } from "antd";
import { LinkOutlined } from "@ant-design/icons";
import { ethers, BigNumber, utils } from "ethers";
import { StaticJsonRpcProvider, JsonRpcProvider, Web3Provider } from "@ethersproject/providers";
import {
  useBalance,
  useUserAddress,
  useContractLoader,
  useContractReader,
  useGasPrice,
  useOnBlock,
  useUserProviderAndSigner,
} from "eth-hooks";
import { useEventListener } from "eth-hooks/events";
import { useExchangeEthPrice } from "eth-hooks/dapps/dex";
import { format } from "date-fns";

import StackGrid from "react-stack-grid";

import { Address, Account, Contract, Faucet, GasGauge, Header, Ramp, ThemeSwitch } from "./components";
import LazyMinter from "./LazyMinter";
import { INFURA_ID, NETWORK, NETWORKS, ALCHEMY_KEY, AddressZero } from "./constants";
import externalContracts from "./contracts/external_contracts";
// contracts
import deployedContracts from "./contracts/hardhat_contracts.json";
import { Transactor } from "./helpers";
import setupWeb3Modal from "./helpers/setupWeb3Modal";
import assets from "./assets.js";

// styles
import "antd/dist/antd.css";
import "./App.css";

/// 📡 What chain are your contracts deployed to?
const targetNetwork = NETWORKS.localhost; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

// 😬 Sorry for all the console logging
const DEBUG = true;
const NETWORKCHECK = true;

// 🛰 providers
if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");
// const mainnetProvider = getDefaultProvider("mainnet", { infura: INFURA_ID, etherscan: ETHERSCAN_KEY, quorum: 1 });
// const mainnetProvider = new InfuraProvider("mainnet",INFURA_ID);
//
// attempt to connect to our own scaffold eth rpc and if that fails fall back to infura...
// Using StaticJsonRpcProvider as the chainId won't change see https://github.com/ethers-io/ethers.js/issues/901
const scaffoldEthProvider = new JsonRpcProvider("https://rpc.scaffoldeth.io:48544");
const mainnetInfura = new JsonRpcProvider("https://mainnet.infura.io/v3/" + INFURA_ID);

// ( ⚠️ Getting "failed to meet quorum" errors? Check your INFURA_ID
// 🏠 Your local provider is usually pointed at your local blockchain
const localProviderUrl = targetNetwork.rpcUrl;
// as you deploy to other networks you can set REACT_APP_PROVIDER=https://dai.poa.network in packages/react-app/.env
const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
if (DEBUG) console.log("🏠 Connecting to provider:", localProviderUrlFromEnv);
const localProvider = new JsonRpcProvider(localProviderUrlFromEnv);

// 🔭 block explorer URL
const blockExplorer = targetNetwork.blockExplorer;

// Portis ID: 6255fb2b-58c8-433b-a2c9-62098c05ddc9
/*
  Web3 modal helps us "connect" external wallets:
*/
const web3Modal = setupWeb3Modal();

const useProviderNetwork = provider => {
  const [network, setNetWork] = useState({});
  const getNetwork = async () => {
    const network = await provider.getNetwork();
    setNetWork(network);
  };
  useEffect(() => {
    if (provider) {
      getNetwork();
    }
  }, [provider]);

  return network;
};

function App(props) {
  const mainnetProvider = scaffoldEthProvider && scaffoldEthProvider._network ? scaffoldEthProvider : mainnetInfura;
  const [injectedProvider, setInjectedProvider] = useState();

  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangeEthPrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProviderAndSigner = useUserProviderAndSigner(injectedProvider, localProvider, true);
  // const userSigner = userProviderAndSigner.getSigner();
  const userSigner = userProviderAndSigner.signer;

  const address = useUserAddress(userSigner);
  if (DEBUG) console.log("👩‍💼 selected address:", address);

  // You can warn the user if you would like them to be on a specific network
  const { chainId: localChainId } = useProviderNetwork(localProvider);
  console.log("localChainId:", localChainId);
  const { chainId: selectedChainId } = useProviderNetwork(userSigner && userSigner.provider);
  console.log("selectedChainId:", selectedChainId);

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks
  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userSigner, gasPrice);

  // Faucet Tx can be used to send funds from the faucet
  const faucetTx = Transactor(localProvider, gasPrice);

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);

  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);
  // const contractConfig = useContractConfig();

  const contractConfig = { deployedContracts: deployedContracts || {}, externalContracts: externalContracts || {} };

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(userSigner, contractConfig, localChainId);
  // If you want to make 🔐 write transactions to your contracts, use the userSigner:
  const writeContracts = useContractLoader(userSigner, contractConfig, localChainId);

  // EXTERNAL CONTRACT EXAMPLE:
  //
  // If you want to bring in the mainnet DAI contract it would look like:
  // const mainnetContracts = useContractLoader(mainnetProvider, contractConfig);

  // // If you want to call a function on a new block
  // useOnBlock(mainnetProvider, () => {
  //   console.log(`⛓ A new mainnet block is here: ${mainnetProvider._lastBlockNumber}`);
  // });

  // // Then read your DAI balance like:
  // const myMainnetDAIBalance = useContractReader(mainnetContracts, "DAI", "balanceOf", [
  //   "0x34aA3F359A9D614239015126635CE7732c18fDF3",
  // ]);

  // // keep track of a variable from the contract in the local React state:
  // const purpose = useContractReader(readContracts, "YourContract", "purpose");

  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */

  //
  // 🧫 DEBUG 👨🏻‍🔬
  //
  // useEffect(() => {
  //   if (DEBUG && mainnetProvider && selectedChainId && yourMainnetBalance && readContracts && writeContracts) {
  //     console.log("_____________________________________ 🏗 scaffold-eth _____________________________________");
  //     console.log("🌎 mainnetProvider", mainnetProvider);
  //     console.log("🏠 localChainId", localChainId);
  //     console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId);
  //     console.log("💵 yourMainnetBalance", yourMainnetBalance ? ethers.utils.formatEther(yourMainnetBalance) : "...");
  //     console.log("📝 readContracts", readContracts);
  //     console.log("🔐 writeContracts", writeContracts);
  //     // console.log("🌍 DAI contract on mainnet:", mainnetContracts);
  //     // console.log("💵 yourMainnetDAIBalance", myMainnetDAIBalance);
  //   }
  // }, [mainnetProvider, selectedChainId, yourMainnetBalance, readContracts, writeContracts]);

  let networkDisplay = "";
  if (NETWORKCHECK && localChainId && selectedChainId && localChainId !== selectedChainId) {
    const networkSelected = NETWORK(selectedChainId);
    const networkLocal = NETWORK(localChainId);
    if (selectedChainId === 1337 && localChainId === 31337) {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "absolute", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network ID"
            description={
              <div>
                You have <b>chain id 1337</b> for localhost and you need to change it to <b>31337</b> to work with
                HardHat.
                <div>(MetaMask -&gt; Settings -&gt; Networks -&gt; Chain ID -&gt; 31337)</div>
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    } else {
      networkDisplay = (
        <div style={{ zIndex: 2, position: "absolute", right: 0, top: 60, padding: 16 }}>
          <Alert
            message="⚠️ Wrong Network"
            description={
              <div>
                You have <b>{networkSelected && networkSelected.name}</b> selected and you need to be on{" "}
                <Button
                  onClick={async () => {
                    const ethereum = window.ethereum;
                    const data = [
                      {
                        chainId: "0x" + targetNetwork.chainId.toString(16),
                        chainName: targetNetwork.name,
                        nativeCurrency: targetNetwork.nativeCurrency,
                        rpcUrls: [targetNetwork.rpcUrl],
                        blockExplorerUrls: [targetNetwork.blockExplorer],
                      },
                    ];
                    console.log("data", data);

                    let switchTx;
                    // https://docs.metamask.io/guide/rpc-api.html#other-rpc-methods
                    try {
                      switchTx = await ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: data[0].chainId }],
                      });
                    } catch (switchError) {
                      // not checking specific error code, because maybe we're not using MetaMask
                      try {
                        switchTx = await ethereum.request({
                          method: "wallet_addEthereumChain",
                          params: data,
                        });
                      } catch (addError) {
                        // handle "add" error
                      }
                    }

                    if (switchTx) {
                      console.log(switchTx);
                    }
                  }}
                >
                  <b>{networkLocal && networkLocal.name}</b>
                </Button>
              </div>
            }
            type="error"
            closable={false}
          />
        </div>
      );
    }
  } else {
    networkDisplay = (
      <div style={{ zIndex: -1, position: "absolute", right: 154, top: 28, padding: 16, color: targetNetwork.color }}>
        {targetNetwork.name}
      </div>
    );
  }

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new ethers.providers.Web3Provider(provider));

    provider.on("chainChanged", chainId => {
      console.log(`chain changed to ${chainId}! updating providers`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    provider.on("accountsChanged", () => {
      console.log(`account changed!`);
      setInjectedProvider(new ethers.providers.Web3Provider(provider));
    });

    // Subscribe to session disconnection
    provider.on("disconnect", (code, reason) => {
      console.log(code, reason);
      logoutOfWeb3Modal();
    });
  }, [setInjectedProvider]);

  const logoutOfWeb3Modal = async () => {
    await web3Modal.clearCachedProvider();
    if (injectedProvider && injectedProvider.provider && typeof injectedProvider.provider.disconnect == "function") {
      await injectedProvider.provider.disconnect();
    }
    setTimeout(() => {
      window.location.reload();
    }, 1);
  };

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const [route, setRoute] = useState();
  useEffect(() => {
    setRoute(window.location.pathname);
  }, [setRoute]);

  let faucetHint = "";
  const faucetAvailable = localProvider && localProvider.connection && targetNetwork.name.indexOf("local") !== -1;

  const [faucetClicked, setFaucetClicked] = useState(false);
  if (
    !faucetClicked &&
    localProvider &&
    localProvider._network &&
    localProvider._network.chainId === 31337 &&
    yourLocalBalance &&
    utils.formatEther(yourLocalBalance) <= 0
  ) {
    faucetHint = (
      <div style={{ padding: 16 }}>
        <Button
          type="primary"
          onClick={() => {
            faucetTx({
              to: address,
              value: ethers.utils.parseEther("0.01"),
            });
            setFaucetClicked(true);
          }}
        >
          💰 Grab funds from the faucet ⛽️
        </Button>
      </div>
    );
  }

  const transferEvents = useEventListener(readContracts, "LazyNFT", "Transfer", localProvider, 1);

  const [loadedAssets, setLoadedAssets] = useState([]);

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

  const updateAuctionList = useCallback(async () => {
    let assetUpdate = [];
    for (let assetHash in assets) {
      let forSale = false;
      let owner = "";
      let auctionInfo = {};
      let bidsInfo = {};
      try {
        const auctionId = utils.id(assetHash);
        // const tokenId = await readContracts.LazyNFT.uriToTokenId(auctionId);
        // try {
        //   owner = await readContracts.LazyNFT.ownerOf(tokenId);
        // } catch {
        //   owner = "";
        // }
        const nftAddress = readContracts.LazyNFT.address;
        try {
          auctionInfo = await readContracts.Auction.getTokenAuctionDetails(nftAddress, auctionId);
          forSale = auctionInfo.isActive;
        } catch {
          auctionInfo = {};
        }
        try {
          bidsInfo = await fetch(`http://localhost:8001/${assetHash}`).then(data => data.json());
        } catch {
          bidsInfo = {};
        }
        assetUpdate.push({
          id: assetHash,
          ...assets[assetHash],
          forSale,
          owner,
          auctionInfo,
          bidsInfo,
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

  const [auctionDetails, setAuctionDetails] = useState({ price: "", duration: "" });
  const [auctionToken, setAuctionToken] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [yourBid, setYourBid] = useState({});

  const isBidderIncluded = bidsInfo => {
    const bidders = Object.entries(bidsInfo).map(([_, bidInfo]) => bidInfo.bidder);
    console.log("all bidders", bidders);
    return bidders.includes(address);
  };

  const startAuction = id => {
    return async () => {
      setAuctionToken(id);
      setModalVisible(true);
    };
  };

  const placeBid = async (loadedAsset, ethAmount) => {
    const auctionId = utils.id(loadedAsset.id);
    const nftAddress = readContracts.LazyNFT.address;
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
        hash: voucher.signature,
        nft: nftAddress,
        bidder: address,
        amount: parsedAmount.toString(),
        voucher,
      }),
    });
    updateAuctionList();
  };

  const handleOk = async () => {
    setModalVisible(false);
    const { price, duration } = auctionDetails;
    const auctionId = utils.id(auctionToken);
    // const tokenId = await readContracts.LazyNFT.uriToTokenId(utils.id(auctionToken));
    const nftAddress = readContracts.LazyNFT.address;
    const ethPrice = utils.parseEther(price.toString());
    const blockDuration = Math.floor(new Date().getTime() / 1000) + duration;

    await tx(writeContracts.Auction.createTokenAuction(nftAddress, auctionId, ethPrice, blockDuration, { gasPrice }));

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
    const auctionId = utils.id(bidInfo.id);
    await tx(
      writeContracts.Auction.pickAsWinner(nftAddress, auctionId, BigNumber.from(bidInfo.amount), bidInfo.bidder),
    );
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
    const bidsInfo = loadedAsset.bidsInfo;
    return async () => {
      // const tokenId = await readContracts.Auction.uriToTokenId(utils.id(auctionId));
      const nftAddress = readContracts.LazyNFT.address;
      await tx(writeContracts.Auction.cancelAuction(nftAddress, utils.id(auctionId)));
      clearAuctionId(auctionId);
    };
  };

  const claim = async loadedAsset => {
    const auctionId = loadedAsset.id;
    let voucher = {};
    Object.entries(loadedAsset.bidsInfo).forEach(([_, bidInfo]) => {
      if (bidInfo.bidder == address && bidInfo.amount == loadedAsset.auctionInfo.bidderPrice.toString()) {
        voucher = bidInfo.voucher;
      }
    });
    debugger;
    const nftAddress = readContracts.LazyNFT.address;
    await tx(writeContracts.Auction.redeem(nftAddress, utils.id(auctionId), voucher), {
      value: loadedAsset.auctionInfo.bidderPrice.toString(),
    });
    // clearAuctionId(auctionId);
  };

  let galleryList = [];
  loadedAssets.forEach(item => {
    let cardActions = [];
    let auctionDetails = [];
    const { owner, bidsInfo, auctionInfo } = item;
    const deadline = auctionInfo.duration ? new Date(auctionInfo.duration * 1000) : new Date();
    const isEnded = deadline <= new Date();
    cardActions.push(
      <div className="cardAction">
        {auctionInfo && owner ? (
          <div>
            owned by:{" "}
            <Address address={owner} ensProvider={mainnetProvider} blockExplorer={blockExplorer} minimized={true} />
          </div>
        ) : (
          ""
        )}
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
        {item.auctionInfo.isActive && address === item.auctionInfo.seller && (
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
            {auctionInfo.redeemer === AddressZero ? (
              "Highest bid was not made yet"
            ) : (
              <div>
                Highest bid by:
                <Address
                  address={auctionInfo.redeemer}
                  ensProvider={mainnetProvider}
                  blockExplorer={blockExplorer}
                  minimized={true}
                />
                <p>{utils.formatEther(auctionInfo.bidderPrice)} ETH</p>
              </div>
            )}
          </div>

          {!isEnded && auctionInfo.isActive && auctionInfo.seller !== address ? (
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
                disabled={!yourBid[item.id] || isEnded || isBidderIncluded(bidsInfo)}
              >
                {isBidderIncluded(bidsInfo) ? "You already made a bid" : "Place a bid"}
              </Button>
            </div>
          ) : auctionInfo.redeemer === address ? (
            <Button style={{ marginTop: "7px", marginBottom: "20px" }} onClick={() => claim(item)}>
              Claim
            </Button>
          ) : (
            ""
          )}

          {item.auctionInfo.isActive && (
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
                  <p style={{ margin: 0 }}>{utils.formatEther(bidInfo.amount)} ETH</p>
                  {address === item.auctionInfo.seller && (
                    <Button disabled={!isEnded} onClick={() => pickAsWinner(item, bidInfo)}>
                      Pick as a winner
                    </Button>
                  )}
                </div>
              ))}
            </div>
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
    <div className="App">
      <Modal
        title="Start auction"
        visible={modalVisible}
        onOk={handleOk}
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
      {/* ✏️ Edit the header and change the title to your project name */}
      <Header />
      {networkDisplay}
      <BrowserRouter>
        <Menu style={{ textAlign: "center" }} selectedKeys={[route]} mode="horizontal">
          <Menu.Item key="/">
            <Link
              onClick={() => {
                setRoute("/");
              }}
              to="/"
            >
              Auction
            </Link>
          </Menu.Item>
          <Menu.Item key="/transfers">
            <Link
              onClick={() => {
                setRoute("/transfers");
              }}
              to="/transfers"
            >
              Transfers
            </Link>
          </Menu.Item>
          <Menu.Item key="/debugcontracts">
            <Link
              onClick={() => {
                setRoute("/debugcontracts");
              }}
              to="/debugcontracts"
            >
              Debug Contracts
            </Link>
          </Menu.Item>
        </Menu>

        <Switch>
          <Route exact path="/">
            {/*
                🎛 this scaffolding is full of commonly used components
                this <Contract/> component will automatically parse your ABI
                and give you a form to interact with it locally
            */}
            <StackGrid columnWidth={300} gutterWidth={16} gutterHeight={16}>
              {galleryList}
            </StackGrid>
          </Route>

          <Route path="/transfers">
            <div style={{ width: 600, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
              <List
                bordered
                dataSource={transferEvents}
                renderItem={item => {
                  return (
                    <List.Item key={item[0] + "_" + item[1] + "_" + item.blockNumber + "_" + item[2].toNumber()}>
                      <span style={{ fontSize: 16, marginRight: 8 }}>#{item[2].toNumber()}</span>
                      <Address address={item[0]} ensProvider={mainnetProvider} fontSize={16} />
                      <span>=></span>
                      <Address address={item[1]} ensProvider={mainnetProvider} fontSize={16} />
                    </List.Item>
                  );
                }}
              />
            </div>
          </Route>

          <Route path="/debugcontracts">
            <Contract
              name="Auction"
              signer={userSigner}
              contractConfig={contractConfig}
              provider={localProvider}
              address={address}
              blockExplorer={blockExplorer}
              chainId={localChainId}
            />
            <Contract
              name="LazyNFT"
              contractConfig={contractConfig}
              signer={userSigner}
              provider={localProvider}
              address={address}
              blockExplorer={blockExplorer}
              chainId={localChainId}
            />
          </Route>
        </Switch>
      </BrowserRouter>

      <ThemeSwitch />

      {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
      <div style={{ zIndex: 99, position: "fixed", textAlign: "right", right: 0, top: 0, padding: 10 }}>
        <Account
          address={address}
          localProvider={localProvider}
          userSigner={userSigner}
          mainnetProvider={mainnetProvider}
          price={price}
          web3Modal={web3Modal}
          loadWeb3Modal={loadWeb3Modal}
          logoutOfWeb3Modal={logoutOfWeb3Modal}
          blockExplorer={blockExplorer}
        />
        {faucetHint}
      </div>

      {/* 🗺 Extra UI like gas price, eth price, faucet, and support: */}
      <div style={{ zIndex: 99, position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
        <Row align="middle" gutter={[4, 4]}>
          <Col span={8}>
            <Ramp price={price} address={address} networks={NETWORKS} />
          </Col>

          <Col span={8} style={{ textAlign: "center", opacity: 0.8 }}>
            <GasGauge gasPrice={gasPrice} />
          </Col>
          <Col span={8} style={{ textAlign: "center", opacity: 1 }}>
            <Button
              onClick={() => {
                window.open("https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA");
              }}
              size="large"
              shape="round"
            >
              <span style={{ marginRight: 8 }} role="img" aria-label="support">
                💬
              </span>
              Support
            </Button>
          </Col>
        </Row>

        <Row align="middle" gutter={[4, 4]}>
          <Col span={24}>
            {
              /*  if the local provider has a signer, let's show the faucet:  */
              faucetAvailable ? (
                <Faucet localProvider={localProvider} price={price} ensProvider={mainnetProvider} />
              ) : (
                ""
              )
            }
          </Col>
        </Row>
      </div>
    </div>
  );
}

export default App;
