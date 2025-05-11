#!/bin/bash

# Script to deploy ProtectedTransferV2 to Lisk Sepolia

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check for dry run flag
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo -e "${YELLOW}DRY RUN MODE: No actual deployment will be performed${NC}"
fi

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${RED}Error: .env file not found.${NC}"
  echo -e "Please create a .env file with your private key. You can copy .env.example to .env and fill in your private key."
  echo -e "Example:"
  echo -e "${YELLOW}cp .env.example .env${NC}"
  echo -e "${YELLOW}nano .env${NC}"
  exit 1
fi

# Check if PRIVATE_KEY is set in .env
if ! grep -q "PRIVATE_KEY=" .env || grep -q "PRIVATE_KEY=your_private_key_here_without_0x_prefix" .env; then
  echo -e "${RED}Error: PRIVATE_KEY not set in .env file.${NC}"
  echo -e "Please set your private key in the .env file."
  exit 1
fi

# Load environment variables from .env
echo -e "${YELLOW}Loading environment variables from .env...${NC}"
export $(grep -v '^#' .env | xargs)

# Display configuration
echo -e "${GREEN}Deployment Configuration:${NC}"
echo -e "Network: Lisk Sepolia"
echo -e "RPC URL: ${LISK_SEPOLIA_RPC_URL:-https://rpc.sepolia-api.lisk.com}"
echo -e "Fee Collector: ${FEE_COLLECTOR:-Deployer Address}"
echo -e "Fee Basis Points: ${FEE_BASIS_POINTS:-20} (${FEE_BASIS_POINTS:-20}/10000 = 0.2%)"

# Compile contracts
echo -e "${YELLOW}Compiling contracts...${NC}"
npx hardhat compile

# Deploy to Lisk Sepolia
echo -e "${YELLOW}Deploying to Lisk Sepolia...${NC}"
echo -e "This will deploy the ProtectedTransferV2 contract to Lisk Sepolia testnet."
echo -e "Make sure you have enough testnet ETH in your account."
echo -e "You can get testnet ETH from the Lisk Sepolia faucet: https://faucet.sepolia-api.lisk.com/"
echo -e ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Pass environment variables to the deployment script
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY RUN: Skipping actual deployment${NC}"
  echo -e "Would run: npx hardhat run scripts/deploy-protected-transfer-v2.js --network liskSepolia"
  echo -e "With environment variables:"
  echo -e "  PRIVATE_KEY=********"
  echo -e "  LISK_SEPOLIA_RPC_URL=${LISK_SEPOLIA_RPC_URL:-https://rpc.sepolia-api.lisk.com}"
  echo -e "  FEE_COLLECTOR=${FEE_COLLECTOR:-<deployer address>}"
  echo -e "  FEE_BASIS_POINTS=${FEE_BASIS_POINTS:-20}"
  exit 0
else
  PRIVATE_KEY=$PRIVATE_KEY \
  LISK_SEPOLIA_RPC_URL=${LISK_SEPOLIA_RPC_URL:-https://rpc.sepolia-api.lisk.com} \
  FEE_COLLECTOR=$FEE_COLLECTOR \
  FEE_BASIS_POINTS=${FEE_BASIS_POINTS:-20} \
  npx hardhat run scripts/deploy-protected-transfer-v2.js --network liskSepolia
fi

# Get the deployed contract address
DEPLOYMENT_FILE=$(ls -t deployments/ProtectedTransferV2-liskSepolia.json 2>/dev/null)

if [ -f "$DEPLOYMENT_FILE" ]; then
  CONTRACT_ADDRESS=$(grep -o '"contractAddress": *"[^"]*"' "$DEPLOYMENT_FILE" | cut -d'"' -f4)
  FEE_COLLECTOR=$(grep -o '"feeCollector": *"[^"]*"' "$DEPLOYMENT_FILE" | cut -d'"' -f4)
  FEE_BASIS_POINTS=$(grep -o '"feeInBasisPoints": *[0-9]*' "$DEPLOYMENT_FILE" | awk '{print $2}')

  echo -e "${GREEN}Contract deployed at: $CONTRACT_ADDRESS${NC}"

  # Verify contract on Blockscout
  echo -e "${YELLOW}Verifying contract on Blockscout...${NC}"
  PRIVATE_KEY=$PRIVATE_KEY \
  LISK_SEPOLIA_RPC_URL=${LISK_SEPOLIA_RPC_URL:-https://rpc.sepolia-api.lisk.com} \
  npx hardhat verify --network liskSepolia "$CONTRACT_ADDRESS" "$FEE_COLLECTOR" "$FEE_BASIS_POINTS"

  echo -e "${GREEN}Deployment and verification complete!${NC}"
  echo -e "Contract address: ${YELLOW}$CONTRACT_ADDRESS${NC}"
  echo -e "Fee collector: ${YELLOW}$FEE_COLLECTOR${NC}"
  echo -e "Fee basis points: ${YELLOW}$FEE_BASIS_POINTS${NC}"

  # Update frontend ABI
  echo -e "${YELLOW}Updating frontend ABI...${NC}"
  node scripts/update-frontend-abi.js
  echo -e "${GREEN}Frontend ABI updated${NC}"
else
  echo -e "${RED}Deployment file not found. Verification skipped.${NC}"
fi
