// Script to deploy the PaymentStream contract
const hre = require("hardhat");

async function main() {
  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Get deployer balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance));

  // Get fee parameters from environment variables or use defaults
  const feeCollector = process.env.FEE_COLLECTOR || deployer.address;
  const feeInBasisPoints = process.env.FEE_BASIS_POINTS ? parseInt(process.env.FEE_BASIS_POINTS) : 20; // Default 0.2%

  // Deploy the contract
  console.log(`Deploying with parameters: feeCollector=${feeCollector}, feeInBasisPoints=${feeInBasisPoints}`);
  const PaymentStream = await hre.ethers.getContractFactory("PaymentStream");
  const paymentStream = await PaymentStream.deploy(feeCollector, feeInBasisPoints);
  await paymentStream.waitForDeployment();

  // Get the contract address
  const contractAddress = await paymentStream.getAddress();
  console.log("PaymentStream deployed to:", contractAddress);

  // Set token support for USDC and IDRX
  // Replace these with the actual token addresses on Lisk Sepolia
  const USDC_ADDRESS = "0x72db95F0716cF79C0efe160F23fB17bF1c161317"; // Lisk Sepolia USDC
  const IDRX_ADDRESS = "0xD63029C1a3dA68b51c67c6D1DeC3DEe50D681661"; // Lisk Sepolia IDRX

  console.log("Setting token support for USDC...");
  await paymentStream.setTokenSupport(USDC_ADDRESS, true);
  console.log("Setting token support for IDRX...");
  await paymentStream.setTokenSupport(IDRX_ADDRESS, true);

  // Save deployment info to a file
  const fs = require("fs");
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

  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  fs.writeFileSync(
    `./deployments/PaymentStream-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`Deployment info saved to ./deployments/PaymentStream-${hre.network.name}.json`);

  // Wait for a few seconds to make sure the contract is deployed
  console.log("Waiting for contract to be fully deployed...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Verify contract on Blockscout if on Lisk Sepolia
  if (hre.network.name === "liskSepolia") {
    console.log("Verifying contract on Blockscout...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [feeCollector, feeInBasisPoints],
        contract: "contracts/streams/PaymentStream.sol:PaymentStream"
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.error("Error verifying contract:", error);
    }
  }

  console.log("Deployment completed successfully");
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
