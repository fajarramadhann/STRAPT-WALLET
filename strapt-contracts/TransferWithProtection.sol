// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TransferWithProtection {
    // Struct to store transfer details
    struct Transfer {
        address sender;
        address recipient;
        uint256 amount;
        uint256 expiry;
        bytes32 passwordHash;
        bool claimed;
        bool refunded;
    }

    mapping(bytes32 => Transfer) public transfers;

    event TransferCreated(bytes32 indexed transferId, address indexed sender, uint256 amount, uint256 expiry);
    event TransferClaimed(bytes32 indexed transferId, address indexed recipient);
    event TransferRefunded(bytes32 indexed transferId, address indexed sender);

    // Create a transfer with password protection and expiry
    function createTransfer(address recipient, uint256 expiry, bytes32 passwordHash) external payable returns (bytes32) {
        require(msg.value > 0, "No funds sent");
        require(expiry > block.timestamp, "Expiry must be in the future");
        bytes32 transferId = keccak256(abi.encodePacked(msg.sender, recipient, msg.value, expiry, passwordHash, block.timestamp));
        transfers[transferId] = Transfer({
            sender: msg.sender,
            recipient: recipient,
            amount: msg.value,
            expiry: expiry,
            passwordHash: passwordHash,
            claimed: false,
            refunded: false
        });
        emit TransferCreated(transferId, msg.sender, msg.value, expiry);
        return transferId;
    }

    // Claim transfer with password
    function claimTransfer(bytes32 transferId, string memory password) external {
        Transfer storage t = transfers[transferId];
        require(!t.claimed, "Already claimed");
        require(!t.refunded, "Already refunded");
        require(t.amount > 0, "Invalid transfer");
        require(block.timestamp <= t.expiry, "Transfer expired");
        require(keccak256(abi.encodePacked(password)) == t.passwordHash, "Invalid password");
        t.claimed = true;
        payable(msg.sender).transfer(t.amount);
        emit TransferClaimed(transferId, msg.sender);
    }

    // Refund if not claimed after expiry
    function refundTransfer(bytes32 transferId) external {
        Transfer storage t = transfers[transferId];
        require(!t.claimed, "Already claimed");
        require(!t.refunded, "Already refunded");
        require(t.amount > 0, "Invalid transfer");
        require(block.timestamp > t.expiry, "Not expired yet");
        require(msg.sender == t.sender, "Only sender can refund");
        t.refunded = true;
        payable(t.sender).transfer(t.amount);
        emit TransferRefunded(transferId, t.sender);
    }
}