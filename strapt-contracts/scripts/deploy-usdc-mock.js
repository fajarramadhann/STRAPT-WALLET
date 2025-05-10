const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config();

async function main() {
  console.log("Starting USDC Mock deployment...");
  
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
  const usdcMockArtifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../artifacts/contracts/mocks/USDCMock.sol/USDCMock.json"),
      "utf8"
    )
  );
  
  // Deploy USDC Mock
  console.log("Deploying USDC Mock...");
  
  // Create contract factory
  const USDCMockFactory = new ethers.ContractFactory(
    usdcMockArtifact.abi,
    usdcMockArtifact.bytecode,
    wallet
  );
  
  // Deploy contract
  const usdcMock = await USDCMockFactory.deploy(address);
  
  // Wait for deployment to complete
  await usdcMock.waitForDeployment();
  
  const usdcMockAddress = await usdcMock.getAddress();
  console.log("USDC Mock deployed to:", usdcMockAddress);
  
  // Mint some USDC to the deployer
  const mintAmount = ethers.parseUnits("1000000", 6); // 1,000,000 USDC with 6 decimals
  console.log("Minting 1,000,000 USDC to deployer...");
  
  const mintTx = await usdcMock.mint(address, mintAmount);
  await mintTx.wait();
  
  console.log("USDC minted successfully");
  
  // Load existing deployment info if available
  let deploymentInfo = {};
  try {
    deploymentInfo = JSON.parse(fs.readFileSync("deployment-info.json", "utf8"));
    console.log("Loaded existing deployment info");
  } catch (error) {
    console.log("No existing deployment info found, creating new file");
  }
  
  // Update deployment info
  deploymentInfo.usdc = usdcMockAddress;
  deploymentInfo.usdcDeploymentTime = new Date().toISOString();
  
  // Save updated deployment info
  fs.writeFileSync(
    "deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("Deployment information updated in deployment-info.json");
  
  // Whitelist USDC in ProtectedTransfer if available
  if (deploymentInfo.protectedTransfer) {
    console.log("Whitelisting USDC in ProtectedTransfer...");
    
    // Load ProtectedTransfer contract
    const protectedTransferArtifact = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../artifacts/contracts/transfers/ProtectedTransfer.sol/ProtectedTransfer.json"),
        "utf8"
      )
    );
    
    const protectedTransfer = new ethers.Contract(
      deploymentInfo.protectedTransfer,
      protectedTransferArtifact.abi,
      wallet
    );
    
    try {
      const tx = await protectedTransfer.setTokenSupport(usdcMockAddress, true);
      console.log("Transaction sent:", tx.hash);
      await tx.wait();
      console.log("USDC Mock whitelisted successfully in ProtectedTransfer");
    } catch (error) {
      console.error("Error whitelisting USDC:", error.message);
    }
  }
  
  console.log("\nUSCD Mock deployment completed successfully!");
  console.log("USDC Mock address:", usdcMockAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
