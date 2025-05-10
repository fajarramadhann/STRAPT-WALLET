const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config();

async function main() {
  console.log("Starting deployment...");
  
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
  
  console.log("Deploying with account:", address);
  
  // Load contract artifacts
  const protectedTransferArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/transfers/ProtectedTransfer.sol/ProtectedTransfer.json"),
      "utf8"
    )
  );
  
  // Deploy ProtectedTransfer
  console.log("Deploying ProtectedTransfer...");
  
  // Initial parameters
  const initialOwner = address;
  const initialFeeCollector = address;
  const initialFeeInBasisPoints = 25; // 0.25% fee
  
  console.log("Deploying with parameters:");
  console.log("- Owner:", initialOwner);
  console.log("- Fee Collector:", initialFeeCollector);
  console.log("- Fee:", initialFeeInBasisPoints, "basis points");
  
  // Create contract factory
  const ProtectedTransferFactory = new ethers.ContractFactory(
    protectedTransferArtifact.abi,
    protectedTransferArtifact.bytecode,
    wallet
  );
  
  // Deploy contract
  const protectedTransfer = await ProtectedTransferFactory.deploy(
    initialOwner,
    initialFeeCollector,
    initialFeeInBasisPoints
  );
  
  // Wait for deployment to complete
  await protectedTransfer.waitForDeployment();
  
  const protectedTransferAddress = await protectedTransfer.getAddress();
  console.log("ProtectedTransfer deployed to:", protectedTransferAddress);
  
  // Save deployment info
  const deploymentInfo = {
    network: "liskSepolia",
    protectedTransfer: protectedTransferAddress,
    owner: initialOwner,
    feeCollector: initialFeeCollector,
    fee: initialFeeInBasisPoints,
    deploymentTime: new Date().toISOString()
  };
  
  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("Deployment information saved to deployment-info.json");
  console.log("Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
