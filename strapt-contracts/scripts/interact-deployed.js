const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Load environment variables
require("dotenv").config();

// Helper function to generate a random claim code
function generateClaimCode() {
  // Generate a random 6-character alphanumeric code
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

async function main() {
  console.log("Starting interaction...");
  
  // Load deployment info
  let deploymentInfo;
  try {
    deploymentInfo = JSON.parse(fs.readFileSync("deployment-info.json", "utf8"));
    console.log("Loaded deployment info from file");
  } catch (error) {
    console.error("Error loading deployment info:", error.message);
    console.error("Please make sure deployment-info.json exists");
    process.exit(1);
  }
  
  // Load private key from .env
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("Please set PRIVATE_KEY in .env file");
    process.exit(1);
  }
  
  // Connect to Lisk Sepolia
  const provider = new ethers.JsonRpcProvider("https://rpc.sepolia-api.lisk.com");
  const wallet = new ethers.Wallet(privateKey, provider);
  const address = wallet.address;
  
  console.log("Connected with account:", address);
  
  // Load contract artifacts
  const protectedTransferArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/transfers/ProtectedTransfer.sol/ProtectedTransfer.json"),
      "utf8"
    )
  );
  
  // Connect to deployed contract
  const protectedTransferAddress = deploymentInfo.protectedTransfer;
  const protectedTransfer = new ethers.Contract(
    protectedTransferAddress,
    protectedTransferArtifact.abi,
    wallet
  );
  
  console.log("Connected to ProtectedTransfer at:", protectedTransferAddress);
  
  // Check contract owner
  const owner = await protectedTransfer.owner();
  console.log("Contract owner:", owner);
  
  // Check fee settings
  const fee = await protectedTransfer.feeInBasisPoints();
  console.log("Current fee:", fee.toString(), "basis points (", Number(fee) / 100, "%)");
  
  // Whitelist IDRX token
  const idrxAddress = "0xD63029C1a3dA68b51c67c6D1DeC3DEe50D681661";
  console.log("Whitelisting IDRX token:", idrxAddress);
  
  try {
    const tx = await protectedTransfer.setTokenSupport(idrxAddress, true);
    console.log("Transaction sent:", tx.hash);
    await tx.wait();
    console.log("IDRX token whitelisted successfully");
    
    // Check if token is whitelisted
    const isWhitelisted = await protectedTransfer.supportedTokens(idrxAddress);
    console.log("Is IDRX whitelisted:", isWhitelisted);
  } catch (error) {
    console.error("Error whitelisting token:", error.message);
  }
  
  console.log("\nInteraction completed successfully!");
  console.log("\nTo create a transfer, you need to:");
  console.log("1. Approve the ProtectedTransfer contract to spend your tokens");
  console.log("2. Call createTransfer or createLinkTransfer");
  console.log("\nContract address:", protectedTransferAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });