# STRAPT Smart Contracts

Smart contracts for the STRAPT (Secure Transfer and Payment) platform.

## Features

### Protected Transfer
- Send tokens with claim code protection
- Create transfers claimable via link/QR code
- Auto-refund for expired transfers
- Supports IDRX and USDC tokens

## Development

### Prerequisites
- Node.js
- Bun (package manager)
- Hardhat

### Setup

1. Install dependencies:
```bash
bun install
```

2. Compile contracts:
```bash
npx hardhat compile
```

3. Run tests:
```bash
npx hardhat test
```

4. Deploy contracts:
```bash
npx hardhat run scripts/deploy.ts --network <network-name>
```

## Contract Architecture

### Tokens
- `IDRX.sol`: Indonesian Rupiah stablecoin (ERC20)
- `USDC.sol`: USD Coin mock for testing (ERC20)

### Core Contracts
- `ProtectedTransfer.sol`: Handles protected transfers with claim codes and expiry times

## Security Features

- Uses OpenZeppelin's SafeERC20 for secure token transfers
- Implements ReentrancyGuard to prevent reentrancy attacks
- Proper validation of inputs and state transitions
- Secure handling of claim codes (only stores hashes)

## License
MIT
