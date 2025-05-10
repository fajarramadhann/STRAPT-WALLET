const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config();

async function main() {
  console.log("Claiming USDC transfer...");
  
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
  
  // Find transfer files
  const files = fs.readdirSync("./").filter(file => 
    file.startsWith("transfer-") || file.startsWith("link-transfer-")
  );
  
  if (files.length === 0) {
    console.error("No transfer files found. Please create a transfer first.");
    process.exit(1);
  }
  
  console.log("Found transfer files:");
  files.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  
  // For this demo, we'll claim both transfers
  await claimDirectTransfer(files.find(f => f.startsWith("transfer-")), deploymentInfo);
  await claimLinkTransfer(files.find(f => f.startsWith("link-transfer-")), deploymentInfo);
}

async function claimDirectTransfer(filename, deploymentInfo) {
  if (!filename) {
    console.log("No direct transfer file found. Skipping.");
    return;
  }
  
  console.log(`\n=== Claiming Direct Transfer from ${filename} ===`);
  
  // Load transfer info
  const transferInfo = JSON.parse(fs.readFileSync(filename, "utf8"));
  console.log("Transfer details:");
  console.log("- Transfer ID:", transferInfo.transferId);
  console.log("- Claim Code:", transferInfo.claimCode);
  console.log("- Amount:", transferInfo.amount, transferInfo.tokenSymbol);
  console.log("- Expiry:", new Date(transferInfo.expiry * 1000).toLocaleString());
  
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
  
  // Check if transfer is claimable
  const isClaimable = await protectedTransfer.isTransferClaimable(transferInfo.transferId);
  if (!isClaimable) {
    console.error("Transfer is not claimable. It might have expired, been claimed already, or doesn't exist.");
    return;
  }
  
  // Claim the transfer
  console.log("Claiming transfer...");
  const tx = await protectedTransfer.claimTransfer(
    transferInfo.transferId,
    transferInfo.claimCode
  );
  
  console.log("Claim transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("Claim confirmed");
  
  // Get claim event
  const event = receipt.logs.find(log => {
    try {
      return protectedTransfer.interface.parseLog(log)?.name === "TransferClaimed";
    } catch (e) {
      return false;
    }
  });
  
  if (!event) {
    console.error("Could not find TransferClaimed event in receipt");
    return;
  }
  
  const parsedEvent = protectedTransfer.interface.parseLog(event);
  const claimer = parsedEvent.args[1];
  const amount = parsedEvent.args[2];
  
  console.log("\nTransfer claimed successfully!");
  console.log("Claimer:", claimer);
  console.log("Amount:", ethers.formatUnits(amount, transferInfo.tokenSymbol === "USDC" ? 6 : 18));
  
  // Delete the transfer file
  fs.unlinkSync(filename);
  console.log(`Transfer file ${filename} deleted`);
}

async function claimLinkTransfer(filename, deploymentInfo) {
  if (!filename) {
    console.log("No link transfer file found. Skipping.");
    return;
  }
  
  console.log(`\n=== Claiming Link Transfer from ${filename} ===`);
  
  // Load transfer info
  const transferInfo = JSON.parse(fs.readFileSync(filename, "utf8"));
  console.log("Transfer details:");
  console.log("- Transfer ID:", transferInfo.transferId);
  console.log("- Amount:", transferInfo.amount, transferInfo.tokenSymbol);
  console.log("- Expiry:", new Date(transferInfo.expiry * 1000).toLocaleString());
  console.log("- Claim Link:", transferInfo.claimLink);
  
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
  
  // Check if transfer is claimable
  const isClaimable = await protectedTransfer.isTransferClaimable(transferInfo.transferId);
  if (!isClaimable) {
    console.error("Transfer is not claimable. It might have expired, been claimed already, or doesn't exist.");
    return;
  }
  
  // Claim the transfer
  console.log("Claiming link transfer...");
  const tx = await protectedTransfer.claimLinkTransfer(transferInfo.transferId);
  
  console.log("Claim transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("Claim confirmed");
  
  // Get claim event
  const event = receipt.logs.find(log => {
    try {
      return protectedTransfer.interface.parseLog(log)?.name === "TransferClaimed";
    } catch (e) {
      return false;
    }
  });
  
  if (!event) {
    console.error("Could not find TransferClaimed event in receipt");
    return;
  }
  
  const parsedEvent = protectedTransfer.interface.parseLog(event);
  const claimer = parsedEvent.args[1];
  const amount = parsedEvent.args[2];
  
  console.log("\nLink transfer claimed successfully!");
  console.log("Claimer:", claimer);
  console.log("Amount:", ethers.formatUnits(amount, transferInfo.tokenSymbol === "USDC" ? 6 : 18));
  
  // Delete the transfer file
  fs.unlinkSync(filename);
  console.log(`Transfer file ${filename} deleted`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
