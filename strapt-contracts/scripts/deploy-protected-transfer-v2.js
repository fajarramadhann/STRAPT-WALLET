// Script to deploy the ProtectedTransferV2 contract
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying ProtectedTransferV2 contract...");

  // Check if we have signers available
  const signers = await hre.ethers.getSigners();
  if (!signers || signers.length === 0) {
    console.error("No signers available. Make sure you have set up your PRIVATE_KEY in .env file.");
    console.error("You can copy .env.example to .env and fill in your private key.");
    process.exit(1);
  }

  // Get the deployer account
  const [deployer] = signers;
  console.log("Deploying with account:", deployer.address);

  // Get the contract factory
  const ProtectedTransferV2 = await hre.ethers.getContractFactory("ProtectedTransferV2");

  // Set the fee collector address (using deployer address by default)
  const feeCollector = process.env.FEE_COLLECTOR || deployer.address;

  // Set the fee in basis points (0.2% by default)
  const feeInBasisPoints = process.env.FEE_BASIS_POINTS ? Number.parseInt(process.env.FEE_BASIS_POINTS) : 20;

  // Deploy the contract
  console.log(`Deploying with parameters: feeCollector=${feeCollector}, feeInBasisPoints=${feeInBasisPoints}`);
  const protectedTransferV2 = await ProtectedTransferV2.deploy(feeCollector, feeInBasisPoints);
  await protectedTransferV2.waitForDeployment();

  // Get the contract address
  const contractAddress = await protectedTransferV2.getAddress();
  console.log("ProtectedTransferV2 deployed to:", contractAddress);

  // Set token support for USDC and IDRX
  // Replace these with the actual token addresses on Lisk Sepolia
  const USDC_ADDRESS = "0x72db95F0716cF79C0efe160F23fB17bF1c161317"; // Lisk Sepolia USDC
  const IDRX_ADDRESS = "0xD63029C1a3dA68b51c67c6D1DeC3DEe50D681661"; // Lisk Sepolia IDRX

  console.log("Setting token support for USDC...");
  const setUsdcTx = await protectedTransferV2.setTokenSupport(USDC_ADDRESS, true);
  await setUsdcTx.wait();
  console.log("USDC support set");

  console.log("Setting token support for IDRX...");
  const setIdrxTx = await protectedTransferV2.setTokenSupport(IDRX_ADDRESS, true);
  await setIdrxTx.wait();
  console.log("IDRX support set");

  // Save deployment info to a file
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress,
    feeCollector,
    feeInBasisPoints,
    supportedTokens: {
      USDC: USDC_ADDRESS,
      IDRX: IDRX_ADDRESS
    },
    deploymentTime: new Date().toISOString()
  };

  const deploymentPath = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentPath, `ProtectedTransferV2-${hre.network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("Deployment info saved to:", path.join(deploymentPath, `ProtectedTransferV2-${hre.network.name}.json`));

  // Copy ABI to frontend
  try {
    const contractArtifact = require('../artifacts/contracts/transfers/ProtectedTransferV2.sol/ProtectedTransferV2.json');
    const frontendPath = path.join(__dirname, '../../strapt-frontend/src/contracts');

    if (!fs.existsSync(frontendPath)) {
      fs.mkdirSync(frontendPath, { recursive: true });
    }

    fs.writeFileSync(
      path.join(frontendPath, 'ProtectedTransferV2.json'),
      JSON.stringify(contractArtifact, null, 2)
    );

    console.log("Contract ABI copied to frontend");
  } catch (error) {
    console.warn("Could not copy ABI to frontend:", error.message);
  }

  console.log("\nDeployment and configuration complete!");
  console.log("Contract address:", contractAddress);
  console.log("Fee collector:", feeCollector);
  console.log("Fee in basis points:", feeInBasisPoints);
  console.log("Supported tokens:");
  console.log("- USDC:", USDC_ADDRESS);
  console.log("- IDRX:", IDRX_ADDRESS);

  // Verify the contract on Blockscout
  console.log("\nTo verify the contract on Blockscout, run:");
  console.log(`npx hardhat verify --network liskSepolia ${contractAddress} ${feeCollector} ${feeInBasisPoints}`);

  // Alternative verification using Foundry
  console.log("\nOr using Foundry:");
  console.log(`forge verify-contract ${contractAddress} ProtectedTransferV2 --constructor-args $(cast abi-encode "constructor(address,uint16)" "${feeCollector}" ${feeInBasisPoints}) --rpc-url https://rpc.sepolia-api.lisk.com --verify --verifier blockscout --verifier-url 'https://sepolia-blockscout.lisk.com/api/'`);
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
