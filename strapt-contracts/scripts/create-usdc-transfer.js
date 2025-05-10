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
  console.log("Creating USDC transfer...");
  
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
  
  const erc20Artifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json"),
      "utf8"
    )
  );
  
  // Connect to deployed contracts
  const protectedTransferAddress = deploymentInfo.protectedTransfer;
  const usdcAddress = deploymentInfo.usdc;
  
  const protectedTransfer = new ethers.Contract(
    protectedTransferAddress,
    protectedTransferArtifact.abi,
    wallet
  );
  
  const usdc = new ethers.Contract(
    usdcAddress,
    erc20Artifact.abi,
    wallet
  );
  
  console.log("Connected to ProtectedTransfer at:", protectedTransferAddress);
  console.log("Connected to USDC Mock at:", usdcAddress);
  
  // Check USDC balance
  const balance = await usdc.balanceOf(address);
  console.log("USDC balance:", ethers.formatUnits(balance, 6));
  
  if (balance === 0n) {
    console.error("You don't have any USDC. Please mint some first.");
    process.exit(1);
  }
  
  // Create a transfer
  console.log("\n=== Creating Direct Transfer with Claim Code ===");
  
  // Generate a random claim code
  const claimCode = generateClaimCode();
  console.log("Generated claim code:", claimCode);
  
  // Hash the claim code
  const claimCodeHash = ethers.keccak256(ethers.toUtf8Bytes(claimCode));
  
  // Set recipient (for demo, we'll use the same account)
  const recipient = address;
  
  // Set amount (10 USDC)
  const amount = ethers.parseUnits("10", 6);
  
  // Set expiry (1 hour from now)
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  
  // Approve token transfer
  console.log("Approving ProtectedTransfer to spend USDC...");
  const approveTx = await usdc.approve(protectedTransferAddress, amount);
  console.log("Approval transaction sent:", approveTx.hash);
  await approveTx.wait();
  console.log("Approval confirmed");
  
  // Create transfer
  console.log("Creating transfer...");
  const tx = await protectedTransfer.createTransfer(
    recipient,
    usdcAddress,
    amount,
    expiry,
    claimCodeHash
  );
  
  console.log("Transfer transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("Transfer confirmed");
  
  // Get transfer ID from event
  const event = receipt.logs.find(log => {
    try {
      return protectedTransfer.interface.parseLog(log)?.name === "TransferCreated";
    } catch (e) {
      return false;
    }
  });
  
  if (!event) {
    console.error("Could not find TransferCreated event in receipt");
    process.exit(1);
  }
  
  const parsedEvent = protectedTransfer.interface.parseLog(event);
  const transferId = parsedEvent.args[0];
  
  console.log("\nTransfer created successfully!");
  console.log("Transfer ID:", transferId);
  console.log("Claim code:", claimCode);
  console.log("Recipient:", recipient);
  console.log("Amount:", ethers.formatUnits(amount, 6), "USDC");
  console.log("Expiry:", new Date(expiry * 1000).toLocaleString());
  
  // Save transfer info to a file
  const transferInfo = {
    type: "direct",
    transferId: transferId,
    claimCode: claimCode,
    recipient: recipient,
    amount: ethers.formatUnits(amount, 6),
    token: usdcAddress,
    tokenSymbol: "USDC",
    expiry: expiry,
    expiryDate: new Date(expiry * 1000).toISOString()
  };
  
  const filename = `transfer-${transferId.slice(0, 8)}.json`;
  fs.writeFileSync(
    filename,
    JSON.stringify(transferInfo, null, 2)
  );
  console.log(`Transfer info saved to ${filename}`);
  
  // Create a link transfer
  console.log("\n=== Creating Link/QR Transfer ===");
  
  // Set amount (5 USDC)
  const linkAmount = ethers.parseUnits("5", 6);
  
  // Approve token transfer
  console.log("Approving ProtectedTransfer to spend USDC...");
  const linkApproveTx = await usdc.approve(protectedTransferAddress, linkAmount);
  console.log("Approval transaction sent:", linkApproveTx.hash);
  await linkApproveTx.wait();
  console.log("Approval confirmed");
  
  // Create link transfer
  console.log("Creating link transfer...");
  const linkTx = await protectedTransfer.createLinkTransfer(
    usdcAddress,
    linkAmount,
    expiry
  );
  
  console.log("Link transfer transaction sent:", linkTx.hash);
  const linkReceipt = await linkTx.wait();
  console.log("Link transfer confirmed");
  
  // Get transfer ID from event
  const linkEvent = linkReceipt.logs.find(log => {
    try {
      return protectedTransfer.interface.parseLog(log)?.name === "TransferCreated";
    } catch (e) {
      return false;
    }
  });
  
  if (!linkEvent) {
    console.error("Could not find TransferCreated event in receipt");
    process.exit(1);
  }
  
  const parsedLinkEvent = protectedTransfer.interface.parseLog(linkEvent);
  const linkTransferId = parsedLinkEvent.args[0];
  
  console.log("\nLink transfer created successfully!");
  console.log("Transfer ID:", linkTransferId);
  console.log("Amount:", ethers.formatUnits(linkAmount, 6), "USDC");
  console.log("Expiry:", new Date(expiry * 1000).toLocaleString());
  
  // Generate claim link
  const claimLink = `https://your-app.com/claim?id=${linkTransferId}`;
  console.log("Claim link:", claimLink);
  
  // Save link transfer info to a file
  const linkTransferInfo = {
    type: "link",
    transferId: linkTransferId,
    amount: ethers.formatUnits(linkAmount, 6),
    token: usdcAddress,
    tokenSymbol: "USDC",
    expiry: expiry,
    expiryDate: new Date(expiry * 1000).toISOString(),
    claimLink: claimLink
  };
  
  const linkFilename = `link-transfer-${linkTransferId.slice(0, 8)}.json`;
  fs.writeFileSync(
    linkFilename,
    JSON.stringify(linkTransferInfo, null, 2)
  );
  console.log(`Link transfer info saved to ${linkFilename}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
