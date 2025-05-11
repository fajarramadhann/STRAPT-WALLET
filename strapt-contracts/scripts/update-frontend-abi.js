// Script to update the ABI in the frontend
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Updating frontend ABI for ProtectedTransferV2...");

  // Check if the artifacts directory exists
  const artifactsDir = path.join(__dirname, '../artifacts/contracts/transfers/ProtectedTransferV2.sol');
  if (!fs.existsSync(artifactsDir)) {
    console.error("Artifacts directory not found. Please compile the contracts first.");
    process.exit(1);
  }

  // Read the contract artifact
  const artifactPath = path.join(artifactsDir, 'ProtectedTransferV2.json');
  if (!fs.existsSync(artifactPath)) {
    console.error("Contract artifact not found. Please compile the contracts first.");
    process.exit(1);
  }

  const contractArtifact = require(artifactPath);

  // Check if the frontend directory exists
  const frontendDir = path.join(__dirname, '../../strapt-frontend/src/contracts');
  if (!fs.existsSync(frontendDir)) {
    console.log("Creating frontend contracts directory...");
    fs.mkdirSync(frontendDir, { recursive: true });
  }

  // Write the ABI to the frontend
  const frontendPath = path.join(frontendDir, 'ProtectedTransferV2.json');
  fs.writeFileSync(
    frontendPath,
    JSON.stringify(contractArtifact, null, 2)
  );

  console.log("ABI updated successfully at:", frontendPath);

  // Get deployment info if available
  const deploymentPath = path.join(__dirname, '../deployments');
  if (fs.existsSync(deploymentPath)) {
    const deploymentFiles = fs.readdirSync(deploymentPath).filter(file => file.startsWith('ProtectedTransferV2-'));
    
    if (deploymentFiles.length > 0) {
      // Get the most recent deployment file
      const latestDeployment = deploymentFiles.sort().pop();
      const deploymentInfo = require(path.join(deploymentPath, latestDeployment));
      
      // Create a config file for the frontend
      const configPath = path.join(frontendDir, 'contract-config.json');
      const config = {
        ProtectedTransferV2: {
          address: deploymentInfo.contractAddress,
          network: deploymentInfo.network,
          supportedTokens: deploymentInfo.supportedTokens
        }
      };
      
      fs.writeFileSync(
        configPath,
        JSON.stringify(config, null, 2)
      );
      
      console.log("Contract config updated at:", configPath);
    }
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
