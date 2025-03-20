"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { Toaster, toast } from "react-hot-toast";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

const CONTRACT_ADDRESS = "0xa8d617D7bB2972d86d516b405a401c0bCb6D2407"; // Your deployed contract
const OWNER_ADDRESS = "0xfF8b7625894441C26fEd460dD21360500BF4E767";
const CONTRACT_ABI = [
  "function setMintPrice(uint256 _newPrice) external",
  "function setWhitelistStartTime(uint256 _time) external",
  "function setPublicStartTime(uint256 _time) external",
  "function setMintEndTime(uint256 _time) external",
  "function setWhitelistRoot(bytes32 _root) external",
  "function withdraw() external",
  "function mintPrice() public view returns (uint256)",
  "function whitelistStartTime() public view returns (uint256)",
  "function publicStartTime() public view returns (uint256)",
  "function mintEndTime() public view returns (uint256)",
  "function whitelistRoot() public view returns (bytes32)",
];
const MONAD_TESTNET_CHAIN_ID = "0x279f"; // Hex for 10143

export default function AdminPage() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [whitelistStart, setWhitelistStart] = useState("");
  const [publicStart, setPublicStart] = useState("");
  const [mintEnd, setMintEnd] = useState("");
  const [whitelistAddresses, setWhitelistAddresses] = useState("");
  const [generatedRoot, setGeneratedRoot] = useState("");
  const [title, setTitle] = useState("Cosmic NFT Drop");
  const [animation, setAnimation] = useState("spin");
  const [currentTimes, setCurrentTimes] = useState({ whitelist: 0, public: 0, end: 0 });
  const [currentRoot, setCurrentRoot] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setTitle(localStorage.getItem("nftTitle") || "Cosmic NFT Drop");
      setAnimation(localStorage.getItem("nftAnimation") || "spin");
    }
    if (contract) {
      fetchCurrentData();
    }
  }, [contract]);

  const fetchCurrentData = async () => {
    if (!contract) return;
    try {
      const whitelistTime = Number(await contract.whitelistStartTime());
      const publicTime = Number(await contract.publicStartTime());
      const endTime = Number(await contract.mintEndTime());
      const root = await contract.whitelistRoot();
      setCurrentTimes({ whitelist: whitelistTime, public: publicTime, end: endTime });
      setCurrentRoot(root);
    } catch (error) {
      console.error("Failed to fetch current data:", error);
    }
  };

  const connectWallet = async () => {
    if (walletConnected) {
      disconnectWallet();
      return;
    }

    if (typeof window.ethereum === "undefined") {
      toast.error("Please install MetaMask!");
      return;
    }

    try {
      const ethProvider = new ethers.BrowserProvider(window.ethereum);
      await ethProvider.send("eth_requestAccounts", []);

      const chainIdHex = await ethProvider.send("eth_chainId", []);
      console.log(`Chain ID from wallet: ${chainIdHex} (hex), ${parseInt(chainIdHex, 16)} (decimal)`);
      if (chainIdHex !== MONAD_TESTNET_CHAIN_ID) {
        toast.error(`Wrong network! Please switch to Monad Testnet (Chain ID ${parseInt(MONAD_TESTNET_CHAIN_ID, 16)}). Current Chain ID: ${parseInt(chainIdHex, 16)}`);
        return;
      }

      const signer = await ethProvider.getSigner();
      const address = await signer.getAddress();

      if (address.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) {
        toast.error("Only the owner can access this page!");
        return;
      }

      const nftContract = CONTRACT_ADDRESS ? new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer) : null;

      setWalletConnected(true);
      setConnectedWallet(address);
      setProvider(ethProvider);
      setContract(nftContract);
      toast.success(`Connected: ${truncateAddress(address)}`);
    } catch (error: any) {
      if (error.code === 4001) {
        toast.error("Connection rejected in MetaMask.");
      } else {
        toast.error("Failed to connect wallet. Ensure you're on Monad Testnet (Chain ID 10143).");
        console.error(error);
      }
    }
  };

  const disconnectWallet = () => {
    setWalletConnected(false);
    setConnectedWallet(null);
    setProvider(null);
    setContract(null);
    toast.success("Wallet disconnected.");
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 5)}...${address.slice(-3)}`;
  };

  const setPrice = async () => {
    if (!contract || !newPrice || isNaN(Number(newPrice)) || Number(newPrice) < 0) {
      toast.error("Please enter a valid price or connect to a deployed contract.");
      return;
    }
    try {
      const priceInWei = ethers.parseEther(newPrice);
      const tx = await contract.setMintPrice(priceInWei);
      await tx.wait();
      toast.success("Mint price updated!");
      setNewPrice("");
    } catch (error: any) {
      toast.error("Failed to update price: " + (error.reason || "Unknown error"));
      console.error(error);
    }
  };

  const setTimes = async () => {
    if (!contract) {
      toast.error("Please connect to a deployed contract first.");
      return;
    }
    if (!whitelistStart || !publicStart || !mintEnd) {
      toast.error("Please fill in all time fields (UTC).");
      return;
    }

    // Parse UTC times directly from input
    const whitelistTimestamp = Math.floor(Date.parse(whitelistStart + ":00Z") / 1000);
    const publicTimestamp = Math.floor(Date.parse(publicStart + ":00Z") / 1000);
    const endTimestamp = Math.floor(Date.parse(mintEnd + ":00Z") / 1000);

    console.log("Whitelist Timestamp (UTC):", whitelistTimestamp, new Date(whitelistTimestamp * 1000).toUTCString());
    console.log("Public Timestamp (UTC):", publicTimestamp, new Date(publicTimestamp * 1000).toUTCString());
    console.log("End Timestamp (UTC):", endTimestamp, new Date(endTimestamp * 1000).toUTCString());
    console.log("Deployed whitelistStartTime:", Number(await contract.whitelistStartTime()));

    if (isNaN(whitelistTimestamp) || isNaN(publicTimestamp) || isNaN(endTimestamp)) {
      toast.error("Invalid UTC date format. Use YYYY-MM-DDThh:mm (UTC).");
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    if (whitelistTimestamp <= now || publicTimestamp <= now || endTimestamp <= now) {
      toast.error("All times must be in the future (UTC).");
      return;
    }

    if (whitelistTimestamp >= publicTimestamp || publicTimestamp >= endTimestamp) {
      toast.error("Times must be in order: Whitelist < Public < End (UTC).");
      return;
    }

    try {
      const endTx = await contract.setMintEndTime(endTimestamp);
      await endTx.wait();
      const publicTx = await contract.setPublicStartTime(publicTimestamp);
      await publicTx.wait();
      const whitelistTx = await contract.setWhitelistStartTime(whitelistTimestamp);
      await whitelistTx.wait();

      toast.success("Times updated successfully (UTC)!");
      setWhitelistStart("");
      setPublicStart("");
      setMintEnd("");
      fetchCurrentData();
    } catch (error: any) {
      toast.error(`Failed to update times: ${error.reason || "Unknown error"}`);
      console.error(error);
    }
  };

  const isValidAddress = (addr: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  const generateMerkleRoot = () => {
    if (!whitelistAddresses) {
      toast.error("Please enter wallet addresses.");
      return;
    }

    try {
      const addresses = whitelistAddresses
        .split(/[\n,]+/)
        .map(addr => addr.trim())
        .filter(addr => isValidAddress(addr));

      if (addresses.length === 0) {
        toast.error("No valid Ethereum addresses provided.");
        return;
      }

      const leaves = addresses.map(addr => keccak256(addr));
      const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const root = merkleTree.getHexRoot();

      setGeneratedRoot(root);
      toast.success("Merkle root generated successfully!");
    } catch (error) {
      toast.error("Failed to generate Merkle root.");
      console.error(error);
    }
  };

  const setWhitelistRootHandler = async () => {
    if (!contract) {
      toast.error("Please connect to a deployed contract first.");
      return;
    }
    if (!generatedRoot || !ethers.isHexString(generatedRoot, 32)) {
      toast.error("Please generate a valid Merkle root first.");
      return;
    }
    try {
      const tx = await contract.setWhitelistRoot(generatedRoot);
      await tx.wait();
      toast.success("Whitelist root updated on-chain!");
      setWhitelistAddresses("");
      setGeneratedRoot("");
      fetchCurrentData();
    } catch (error: any) {
      toast.error("Failed to update whitelist root: " + (error.reason || "Unknown error"));
      console.error(error);
    }
  };

  const withdrawFunds = async () => {
    if (!contract) {
      toast.error("Please connect to a deployed contract first.");
      return;
    }
    try {
      const tx = await contract.withdraw();
      await tx.wait();
      toast.success("Funds withdrawn successfully!");
    } catch (error: any) {
      toast.error("Withdrawal failed: " + (error.reason || "Unknown error"));
      console.error(error);
    }
  };

  const updateTitle = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nftTitle", title);
      window.dispatchEvent(new Event("storage"));
      toast.success("Title updated!");
    }
  };

  const updateAnimation = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nftAnimation", animation);
      window.dispatchEvent(new Event("storage"));
      toast.success("Animation updated!");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8 flex items-center justify-center">
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
      <div className="w-full max-w-2xl bg-gray-800/80 backdrop-blur-md p-6 rounded-xl shadow-2xl border border-purple-500/30">
        <h1 className="text-4xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 mb-6">
          Admin Control Panel
        </h1>

        {!walletConnected ? (
          <button
            onClick={connectWallet}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg font-semibold text-white transition-all duration-300 transform hover:scale-105"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-cyan-300 font-semibold">Connected: {truncateAddress(connectedWallet!)}</span>
              <button
                onClick={disconnectWallet}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 rounded-lg font-semibold text-white transition-all duration-300"
              >
                Disconnect
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-gray-700 p-4 rounded-lg">
                <h2 className="text-xl font-semibold text-cyan-300 mb-2">Current Settings (UTC)</h2>
                <p>Whitelist Start: {currentTimes.whitelist ? new Date(currentTimes.whitelist * 1000).toUTCString() : "Not set"}</p>
                <p>Public Start: {currentTimes.public ? new Date(currentTimes.public * 1000).toUTCString() : "Not set"}</p>
                <p>Mint End: {currentTimes.end ? new Date(currentTimes.end * 1000).toUTCString() : "Not set"}</p>
                <p>Whitelist Root: {currentRoot || "Not set"}</p>
              </div>

              <div className="bg-gray-700 p-4 rounded-lg">
                <h2 className="text-xl font-semibold text-cyan-300 mb-2">Set Mint Price</h2>
                <input
                  type="number"
                  step="0.0001"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="Enter price in MON"
                  className="w-full p-2 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-600 hover:border-cyan-500 transition-all duration-200"
                />
                <button onClick={setPrice} className="mt-2 w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all duration-300">Update Price</button>
              </div>

              <div className="bg-gray-700 p-4 rounded-lg">
                <h2 className="text-xl font-semibold text-cyan-300 mb-4">Set Sale Times (UTC)</h2>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-gray-200 font-semibold mb-1">Whitelist Start (UTC)</label>
                    <input
                      type="datetime-local"
                      value={whitelistStart}
                      onChange={(e) => setWhitelistStart(e.target.value)}
                      placeholder="YYYY-MM-DDThh:mm (UTC)"
                      className="w-full p-2 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-600 hover:border-cyan-500 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-200 font-semibold mb-1">Public Start (UTC)</label>
                    <input
                      type="datetime-local"
                      value={publicStart}
                      onChange={(e) => setPublicStart(e.target.value)}
                      placeholder="YYYY-MM-DDThh:mm (UTC)"
                      className="w-full p-2 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-600 hover:border-cyan-500 transition-all duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-200 font-semibold mb-1">Mint End (UTC)</label>
                    <input
                      type="datetime-local"
                      value={mintEnd}
                      onChange={(e) => setMintEnd(e.target.value)}
                      placeholder="YYYY-MM-DDThh:mm (UTC)"
                      className="w-full p-2 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-600 hover:border-cyan-500 transition-all duration-200"
                    />
                  </div>
                </div>
                <button onClick={setTimes} className="mt-4 w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all duration-300">Update Times (UTC)</button>
              </div>

              <div className="bg-gray-700 p-4 rounded-lg">
                <h2 className="text-xl font-semibold text-cyan-300 mb-2">Generate Whitelist Merkle Root</h2>
                <textarea
                  value={whitelistAddresses}
                  onChange={(e) => setWhitelistAddresses(e.target.value)}
                  placeholder="Paste addresses (comma or newline separated, e.g., 0x123..., 0x456...)"
                  className="w-full p-2 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-600 hover:border-cyan-500 transition-all duration-200 h-24 resize-none"
                />
                <button onClick={generateMerkleRoot} className="mt-2 w-full py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg font-semibold transition-all duration-300">Generate Merkle Root</button>
                {generatedRoot && (
                  <div className="mt-2">
                    <p className="text-gray-200">Generated Merkle Root: <span className="text-cyan-300">{generatedRoot}</span></p>
                    <button onClick={setWhitelistRootHandler} className="mt-2 w-full py-2 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 rounded-lg font-semibold transition-all duration-300">Set On-Chain</button>
                  </div>
                )}
              </div>

              <div className="bg-gray-700 p-4 rounded-lg">
                <h2 className="text-xl font-semibold text-cyan-300 mb-2">Withdraw Funds</h2>
                <button onClick={withdrawFunds} className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all duration-300">Withdraw</button>
              </div>

              <div className="bg-gray-700 p-4 rounded-lg">
                <h2 className="text-xl font-semibold text-cyan-300 mb-2">Frontend Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-200 font-semibold mb-1">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter new title"
                      className="w-full p-2 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-600 hover:border-cyan-500 transition-all duration-200"
                    />
                    <button onClick={updateTitle} className="mt-2 w-full py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg font-semibold transition-all duration-300">Update Title</button>
                  </div>
                  <div>
                    <label className="block text-gray-200 font-semibold mb-1">Image Animation</label>
                    <select
                      value={animation}
                      onChange={(e) => setAnimation(e.target.value)}
                      className="w-full p-2 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-gray-600 hover:border-cyan-500 transition-all duration-200"
                    >
                      <option value="spin">Spin</option>
                      <option value="bounce">Bounce</option>
                      <option value="pulse">Pulse</option>
                      <option value="none">None</option>
                    </select>
                    <button onClick={updateAnimation} className="mt-2 w-full py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg font-semibold transition-all duration-300">Update Animation</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}