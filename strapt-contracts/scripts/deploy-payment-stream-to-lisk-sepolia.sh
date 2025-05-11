#!/bin/bash

# Script to deploy the PaymentStream contract to Lisk Sepolia

# Ensure .env file is loaded
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "Warning: .env file not found. Make sure environment variables are set."
fi

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
  echo "Error: PRIVATE_KEY environment variable is not set."
  exit 1
fi

# Check if LISK_SEPOLIA_RPC_URL is set
if [ -z "$LISK_SEPOLIA_RPC_URL" ]; then
  echo "Using default Lisk Sepolia RPC URL"
  export LISK_SEPOLIA_RPC_URL="https://rpc.sepolia-api.lisk.com"
fi

# Set fee parameters if not already set
if [ -z "$FEE_COLLECTOR" ]; then
  echo "FEE_COLLECTOR not set, will use deployer address"
fi

if [ -z "$FEE_BASIS_POINTS" ]; then
  echo "FEE_BASIS_POINTS not set, using default (20 = 0.2%)"
  export FEE_BASIS_POINTS=20
fi

# Compile contracts
echo "Compiling contracts..."
npx hardhat compile

# Deploy contract
echo "Deploying PaymentStream to Lisk Sepolia..."
npx hardhat run scripts/deploy-payment-stream.js --network liskSepolia

echo "Deployment process completed."
