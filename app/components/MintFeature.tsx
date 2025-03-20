"use client";

// Declare window.ethereum type inline at the top level
declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider & {
      request?: (...args: any[]) => Promise<any>;
      on?: (eventName: string, callback: (...args: any[]) => void) => void;
      removeListener?: (eventName: string, callback: (...args: any[]) => void) => void;
    };
  }
}

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { FaTwitter, FaGlobe } from "react-icons/fa";
import { Toaster, toast } from "react-hot-toast";
import confetti from "canvas-confetti";
import { whitelistWallets } from "../data/wallets";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xa8d617D7bB2972d86d516b405a401c0bCb6D2407";
const CONTRACT_ABI = [
  "function mintNFT(uint256 amount, bytes32[] calldata proof) external payable",
  "function totalSupply() public view returns (uint256)",
  "function MAX_SUPPLY() public view returns (uint256)",
  "function mintPrice() public view returns (uint256)",
  "function balanceOf(address owner) public view returns (uint256)",
  "function whitelistStartTime() public view returns (uint256)",
  "function publicStartTime() public view returns (uint256)",
  "function mintEndTime() public view returns (uint256)",
  "function isWhitelisted(address account, bytes32[] calldata proof) external view returns (bool)",
  "function whitelistRoot() public view returns (bytes32)",
];
const MONAD_TESTNET_CHAIN_ID = "0x279f"; // Hex for 10143

export default function MintFeature() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [mintAmount, setMintAmount] = useState(1);
  const [inputValue, setInputValue] = useState("1");
  const [isValid, setIsValid] = useState(true);
  const [mintedCount, setMintedCount] = useState(0);
  const [maxSupply, setMaxSupply] = useState(10000);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [showUSD, setShowUSD] = useState(false);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [userMintedCount, setUserMintedCount] = useState(0);
  const [mintPrice, setMintPrice] = useState("0");
  const [whitelistStartTime, setWhitelistStartTime] = useState<number>(0);
  const [publicStartTime, setPublicStartTime] = useState<number>(0);
  const [mintEndTime, setMintEndTime] = useState<number>(0);
  const [title, setTitle] = useState("Cosmic NFT Drop");
  const [animation, setAnimation] = useState("spin");
  const [showPopup, setShowPopup] = useState(false);
  const [mintRole, setMintRole] = useState("None yet");
  const [isMinting, setIsMinting] = useState(false);

  useEffect(() => {
    const fetchContractData = async () => {
      if (contract) {
        try {
          const price = await contract.mintPrice();
          const whitelistStart = Number(await contract.whitelistStartTime()) * 1000;
          const publicStart = Number(await contract.publicStartTime()) * 1000;
          const mintEnd = Number(await contract.mintEndTime()) * 1000;
          const totalSupply = Number(await contract.totalSupply());
          const maxSupply = Number(await contract.MAX_SUPPLY());

          setMintPrice(ethers.formatEther(price));
          setWhitelistStartTime(whitelistStart);
          setPublicStartTime(publicStart);
          setMintEndTime(mintEnd);
          setMintedCount(totalSupply);
          setMaxSupply(maxSupply);
        } catch (error) {
          toast.error("Failed to fetch contract data.");
          console.error(error);
        }
      }
    };
    fetchContractData();

    const handleStorageChange = () => {
      if (typeof window !== "undefined") {
        setTitle(localStorage.getItem("nftTitle") || "Cosmic NFT Drop");
        setAnimation(localStorage.getItem("nftAnimation") || "spin");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [contract]);

  const generateProof = async (address: string) => {
    if (typeof window === "undefined") return [];
    const keccak256 = (await import("keccak256")).default;
    const { MerkleTree } = await import("merkletreejs");
    const leaves = whitelistWallets.map((addr) => keccak256(addr));
    const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = merkleTree.getHexRoot();
    console.log("Generated Merkle Root:", root);
    const leaf = keccak256(address);
    return merkleTree.getHexProof(leaf);
  };

  const connectWallet = async () => {
    if (walletConnected) {
      setWalletConnected(false);
      setConnectedWallet(null);
      setIsWhitelisted(false);
      setProvider(null);
      setContract(null);
      setUserMintedCount(0);
      setLastTxHash(null);
      setMintRole("None yet");
      toast.success("Wallet disconnected.");
      return;
    }

    if (typeof window === "undefined" || !window.ethereum) {
      toast.error("Please install a wallet like MetaMask!");
      return;
    }

    try {
      const ethProvider = new ethers.BrowserProvider(window.ethereum);
      await ethProvider.send("eth_requestAccounts", []);

      const chainIdHex = await ethProvider.send("eth_chainId", []);
      if (chainIdHex !== MONAD_TESTNET_CHAIN_ID) {
        toast.error(`Wrong network! Please switch to Monad Testnet (Chain ID ${parseInt(MONAD_TESTNET_CHAIN_ID, 16)})`);
        return;
      }

      const signer = await ethProvider.getSigner();
      const address = await signer.getAddress();
      const nftContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const storedRoot = await nftContract.whitelistRoot();
      console.log("Stored Whitelist Root:", storedRoot);

      let isWhitelistedOnChain = false;
      try {
        const proof = await generateProof(address);
        isWhitelistedOnChain = await nftContract.isWhitelisted(address, proof);
      } catch (error) {
        console.error("isWhitelisted call failed:", error);
        // Use generic toast instead of toast.warn
        toast("Unable to verify whitelist status. Proceeding as non-whitelisted.", { icon: "⚠️" });
      }

      setWalletConnected(true);
      setConnectedWallet(address);
      setProvider(ethProvider);
      setContract(nftContract);
      setIsWhitelisted(isWhitelistedOnChain);

      await updateUserMintedCount(nftContract, address);
      toast.success(`Connected: ${truncateAddress(address)} ${isWhitelistedOnChain ? "(Whitelisted)" : "(Not Whitelisted)"}`);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error("Failed to connect wallet: " + (err.message || "Unknown error"));
      console.error(error);
    }
  };

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 5)}...${address.slice(-3)}`;
  };

  const getRole = (count: number): string => {
    if (count === 1) return "Normie";
    if (count === 2) return "Degen";
    if (count === 3) return "Based";
    if (count >= 4) return "Legend";
    return "None yet";
  };

  const mintNFT = async () => {
    if (!walletConnected || !contract || !connectedWallet) {
      toast.error("Please connect your wallet first!");
      return;
    }

    const now = Date.now();
    if (now < whitelistStartTime) {
      toast.error("Minting has not started yet.");
      return;
    }
    if (now >= mintEndTime) {
      toast.error("Minting has ended.");
      return;
    }
    if (now < publicStartTime && !isWhitelisted) {
      toast.error("You are not eligible for the whitelist mint.");
      return;
    }

    if (mintAmount < 1 || mintAmount > 10) {
      toast.error("Invalid mint amount. Please enter a value between 1 and 10.");
      return;
    }

    const totalCost = ethers.parseEther(mintPrice) * BigInt(mintAmount);
    const balance = await provider!.getBalance(connectedWallet);
    if (balance < totalCost) {
      toast.error("Insufficient funds to complete the mint.");
      return;
    }

    setIsMinting(true);
    try {
      const proof = now < publicStartTime && isWhitelisted ? await generateProof(connectedWallet) : [];
      console.log("Minting with:", { mintAmount, proof, totalCost: ethers.formatEther(totalCost), phase: now < publicStartTime ? "Whitelist" : "Public" });
      const tx = await contract.mintNFT(mintAmount, proof, { value: totalCost });
      const receipt = await tx.wait();

      setLastTxHash(tx.hash);
      await updateUserMintedCount(contract, connectedWallet);

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#00FFFF", "#FF00FF", "#FFFF00", "#FF69B4"],
      });

      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 5000);
    } catch (error: unknown) {
      const err = error as { reason?: string; message?: string };
      toast.error("Minting failed: " + (err.reason || err.message || "Unknown error"));
      console.error(error);
    } finally {
      setIsMinting(false);
    }
  };

  const updateUserMintedCount = async (nftContract: ethers.Contract, address: string) => {
    try {
      const balance = await nftContract.balanceOf(address);
      setUserMintedCount(Number(balance));
      setMintRole(getRole(Number(balance)));
    } catch (error) {
      toast.error("Failed to fetch your NFT count.");
      console.error(error);
    }
  };

  const decreaseAmount = () => {
    const newValue = Math.max(1, mintAmount - 1);
    setMintAmount(newValue);
    setInputValue(newValue.toString());
    setIsValid(true);
  };

  const increaseAmount = () => {
    const newValue = Math.min(10, mintAmount + 1);
    setMintAmount(newValue);
    setInputValue(newValue.toString());
    setIsValid(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setInputValue(value);
    if (value === "") {
      setMintAmount(1);
      setIsValid(false);
    } else {
      const numValue = parseInt(value, 10);
      if (numValue < 1 || numValue > 10 || value.startsWith("0")) {
        setIsValid(false);
      } else {
        setMintAmount(numValue);
        setIsValid(true);
      }
    }
  };

  const handleInputBlur = () => {
    if (!isValid || inputValue === "") {
      setMintAmount(1);
      setInputValue("1");
      setIsValid(true);
    } else if (inputValue !== mintAmount.toString()) {
      setInputValue(mintAmount.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
  };

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      let targetTime = whitelistStartTime;
      let prefix = "Whitelist Starts In: ";

      if (now >= whitelistStartTime && now < publicStartTime) {
        targetTime = publicStartTime;
        prefix = "Public Mint In: ";
      } else if (now >= publicStartTime && now < mintEndTime) {
        targetTime = mintEndTime;
        prefix = "Mint Ends In: ";
      } else if (now >= mintEndTime) {
        setTimeLeft("Mint Ended");
        return;
      } else if (whitelistStartTime === 0) {
        setTimeLeft("Loading...");
        return;
      }

      const diff = targetTime - now;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${prefix}${days}d ${hours}h ${minutes}m ${seconds}s`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [whitelistStartTime, publicStartTime, mintEndTime]);

  const getMintPhaseEmoji = () => {
    const now = Date.now();
    if (whitelistStartTime === 0) return "⏳";
    return now < whitelistStartTime ? "⏳" : now < publicStartTime ? (isWhitelisted ? "🔒" : "⏳") : now < mintEndTime ? "🚀" : "🏁";
  };

  const isMintDisabled = () => {
    const now = Date.now();
    if (!contract || now < whitelistStartTime || now >= mintEndTime || isMinting) return true;
    if (now < publicStartTime && !isWhitelisted) return true;
    return false;
  };

  const animationStyles = {
    spin: "animate-spin",
    bounce: "animate-bounce",
    pulse: "animate-pulse",
    none: "",
  };

  return (
    <div className="relative w-full md:max-w-md">
      <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
      <div className="flex flex-col items-center md:items-end mb-4">
        <button
          onClick={connectWallet}
          className="py-2 px-3 md:px-4 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg font-semibold text-sm md:text-base text-white transition-all duration-300 transform hover:scale-105 w-full md:w-auto max-w-[150px] md:max-w-none truncate"
        >
          {walletConnected && connectedWallet ? truncateAddress(connectedWallet) : "Connect Wallet"}
        </button>
      </div>

      <h2 className="text-2xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 mb-4 md:text-4xl md:text-left">
        {title}
      </h2>

      <div className="bg-gray-800/80 backdrop-blur-md p-6 rounded-xl shadow-xl border border-purple-500/30 transition-all duration-300 relative">
        <div className="absolute top-4 right-4 flex space-x-4">
          <a href="https://yourwebsite.com" target="_blank" rel="noopener noreferrer" className="text-gray-200 hover:text-cyan-400 transition-colors duration-200">
            <FaGlobe size={20} />
          </a>
          <a href="https://twitter.com/yourproject" target="_blank" rel="noopener noreferrer" className="text-gray-200 hover:text-cyan-400 transition-colors duration-200">
            <FaTwitter size={20} />
          </a>
        </div>

        <div className="flex flex-col space-y-4">
          <div className="text-gray-200 text-sm md:text-base space-y-1">
            <p><span className="font-semibold text-cyan-300">Total Supply:</span> {mintedCount} / {maxSupply}</p>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-cyan-300">Price:</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`animate-pulse-glow ${showUSD ? "hidden" : "text-cyan-400"}`}>
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22c-5.522 0-10-4.478-10-10S6.478 2 12 2s10 4.478 10 10-4.478 10-10 10zm-1-12.586V5h2v4.414l2.293 2.293-1.414 1.414L11 10.586zm2 4.586V19h-2v-4.414l-2.293-2.293 1.414-1.414L13 13.414z" fill="currentColor"/>
              </svg>
              <span className="text-xl md:text-2xl font-bold text-cyan-400">{showUSD ? "$0.30 USD" : `${mintPrice} MON`}</span>
              <div
                onClick={() => setShowUSD(!showUSD)}
                className={`toggle-switch w-12 h-6 bg-gray-700 rounded-full cursor-pointer flex items-center ${showUSD ? "bg-cyan-600" : "bg-purple-600"}`}
              >
                <div className={`toggle-switch-knob w-5 h-5 bg-white rounded-full transform ${showUSD ? "translate-x-6" : "translate-x-1"}`}></div>
              </div>
            </div>
          </div>

          <div className="text-gray-200 text-sm md:text-base space-y-1">
            <p>
              <span className="font-semibold text-cyan-300">Mint Phase:</span>{" "}
              {getMintPhaseEmoji()}{" "}
              {whitelistStartTime === 0 ? "Loading..." : Date.now() < whitelistStartTime ? "Not Started" : Date.now() < publicStartTime ? (isWhitelisted ? "Whitelist Mint" : "Whitelist (Not Eligible)") : Date.now() < mintEndTime ? "Public Mint" : "Ended"}
            </p>
            {walletConnected && (
              <p>
                <span className="font-semibold text-cyan-300">Eligibility:</span>{" "}
                {isWhitelisted ? "🥳 Eligible" : "😞 Not Eligible"}
              </p>
            )}
            <p className="flex items-center space-x-2 text-purple-300 font-semibold">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin-slow">
                <path d="M12 2v2m0 16v2m-8-10H2m20 0h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 6l-2 4h4l-2 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <animate attributeName="opacity" values="1;0.5;1" dur="1.5s" repeatCount="indefinite"/>
                </path>
              </svg>
              <span>{timeLeft}</span>
            </p>
          </div>

          <button
            onClick={mintNFT}
            disabled={isMintDisabled()}
            className={`w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold text-white transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed relative ${isMinting ? "cursor-wait" : ""}`}
          >
            {isMinting ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin-cosmic h-5 w-5 text-cyan-400 mr-2" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.3" />
                  <path d="M12 2a10 10 0 0110 10 10 10 0 01-10 10 10 10 0 01-10-10 10 10 0 0110-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="15 150" />
                </svg>
                Minting...
              </div>
            ) : (
              "Mint Now"
            )}
          </button>

          {walletConnected && (
            <div className="flex flex-col space-y-2 animate-stepper-entrance">
              <label className="text-gray-200 font-semibold">Quantity (1-10):</label>
              <div className="flex items-center justify-center space-x-2">
                <button onClick={decreaseAmount} disabled={mintAmount === 1 || isMinting} className="w-10 h-10 bg-gray-700 hover:bg-gray-600 active:scale-90 rounded-lg text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">-</button>
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  onKeyDown={handleKeyDown}
                  disabled={isMinting}
                  className={`w-16 h-10 text-center bg-gray-900 border rounded-lg text-xl font-semibold text-cyan-400 focus:outline-none focus:ring-2 transition-all duration-200 animate-number-change ${isValid ? "border-cyan-500/50 focus:ring-cyan-500" : "border-red-500/50 focus:ring-red-500"}`}
                />
                <button onClick={increaseAmount} disabled={mintAmount === 10 || isMinting} className="w-10 h-10 bg-gray-700 hover:bg-gray-600 active:scale-90 rounded-lg text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">+</button>
              </div>
              {!isValid && <p className="text-red-400 text-xs text-center">Please enter 1-10</p>}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-gray-200 text-sm md:text-base">
              <span className="font-semibold text-cyan-300">Minted:</span> {mintedCount} / {maxSupply}
            </p>
            <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden relative">
              <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${(mintedCount / maxSupply) * 100}%` }} />
              <svg width="100%" height="12" viewBox="0 0 100 12" preserveAspectRatio="none" className="absolute top-0 left-0">
                <circle cx="10" cy="6" r="2" fill="white" className="animate-sparkle" style={{ animationDelay: "0s" }}/>
                <circle cx="10" cy="6" r="1.5" fill="white" className="animate-sparkle" style={{ animationDelay: "0.5s" }}/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {walletConnected && (
        <div className="mt-6 p-4 bg-gray-900/80 rounded-xl border border-purple-500/30">
          <h3 className="text-lg font-semibold text-cyan-300 mb-2">Your Cosmic NFTs</h3>
          <div className="flex flex-col items-center space-y-4">
            <img
              src="https://teal-characteristic-reindeer-501.mypinata.cloud/ipfs/bafybeihq2hhm7aq36myaemvgfmg2f3vccrmgp7oa4m4q4g5ldtjhoolt54"
              alt="Cosmic NFT"
              className={`w-32 h-32 rounded-lg border-2 border-purple-500`}
            />
            <div className="text-gray-200 text-sm text-center">
              <p><span className="font-semibold text-cyan-300">Your Minted NFTs:</span> {userMintedCount}</p>
              <p><span className="font-semibold text-cyan-300">Your Role:</span> {mintRole}</p>
              {lastTxHash && (
                <p>
                  <span className="font-semibold text-cyan-300">Last Transaction:</span>{" "}
                  <a href={`https://testnet.monadexplorer.com/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">
                    {truncateAddress(lastTxHash)}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-xl shadow-2xl border border-purple-500/50 max-w-sm w-full text-center animate-fade-in">
            <h3 className="text-2xl font-bold text-cyan-300 mb-4">Congratulations, {mintRole}!</h3>
            <img src="./images/nft-1.png" alt="Minted NFT" className="w-40 h-40 mx-auto mb-4 animate-nft-pop" />
            <p className="text-gray-200 mb-4">You minted {mintAmount} NFT{mintAmount > 1 ? "s" : ""}! Your total: {userMintedCount}.</p>
            <button
              onClick={() => setShowPopup(false)}
              className="py-2 px-4 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg font-semibold text-white transition-all duration-300 transform hover:scale-105"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .animate-nft-pop {
          animation: nftPop 1s ease-in-out infinite;
        }
        @keyframes nftPop {
          0% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.1) rotate(5deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-in;
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-spin-cosmic {
          animation: spinCosmic 1s linear infinite;
        }
        @keyframes spinCosmic {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}