// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title ImprovedPaymentStream
 * @notice A contract for creating and managing continuous token streams, inspired by Sablier/LlamaPay.
 * @dev Allows for linear streaming of ERC20 tokens over a specified duration.
 *      Includes features for creation, withdrawal, cancellation, pausing, and resuming streams.
 *      Fixed fee calculation and improved state management.
 */
contract ImprovedPaymentStream is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Enum to track the status of a stream
    enum StreamStatus {
        Scheduled,  // 0: Stream is scheduled but not yet started
        Active,     // 1: Stream is active and tokens are being streamed
        Paused,     // 2: Stream is paused
        Completed,  // 3: Stream has been completed
        Canceled    // 4: Stream has been canceled
    }

    /// @notice Struct to store stream information
    struct Stream {
        address sender;           // Address of the stream creator
        address recipient;        // Address of the stream recipient
        address tokenAddress;     // Address of the token being streamed
        uint256 totalAmount;      // Total amount to be streamed to the recipient (net, after fee)
        uint256 ratePerSecond;    // totalAmount / (endTime - startTime)
        uint256 startTime;        // Timestamp when the stream starts
        uint256 endTime;          // Timestamp when the stream ends
        uint256 amountWithdrawn;  // Total amount withdrawn by the recipient so far
        StreamStatus status;      // Current status of the stream
        uint256 lastPausedTime;   // Timestamp when stream was last paused, 0 if not paused
        uint256 totalPausedDuration; // Cumulative duration the stream has been paused
    }

    /// @notice Fee collector address
    address public feeCollector;

    /// @notice Fee in basis points (1/100 of a percent)
    uint16 public feeInBasisPoints;

    /// @notice Maximum fee in basis points (5%)
    uint16 public constant MAX_FEE = 500;

    /// @notice Mapping of stream ID to stream
    mapping(bytes32 => Stream) public streams;

    /// @notice Counter to generate unique stream IDs
    uint256 public nextStreamIdNonce;

    /// @notice Mapping of token address to whether it's supported
    mapping(address => bool) public supportedTokens;

    /// @notice User stream tracking
    mapping(address => bytes32[]) public senderStreams;
    mapping(address => bytes32[]) public recipientStreams;

    // Events
    event StreamCreated(
        bytes32 indexed streamId,
        address indexed sender,
        address indexed recipient,
        address tokenAddress,
        uint256 totalAmount,      // Net amount for recipient
        uint256 depositAmount,    // Gross amount including fee
        uint256 startTime,
        uint256 endTime,
        uint256 ratePerSecond
    );

    event StreamWithdrawn(bytes32 indexed streamId, address indexed recipient, uint256 amount);
    event StreamPaused(bytes32 indexed streamId, uint256 timestamp);
    event StreamResumed(bytes32 indexed streamId, uint256 timestamp);
    event StreamCanceled(bytes32 indexed streamId, address indexed sender, address indexed recipient, uint256 senderRefund, uint256 recipientAmount);
    event StreamCompleted(bytes32 indexed streamId, uint256 timestamp);

    // Custom errors
    error InvalidTokenAddress();
    error InvalidAmount();
    error InvalidDuration();
    error InvalidRecipient();
    error TokenNotSupported();
    error StreamNotFound();
    error NotStreamSender();
    error NotStreamRecipient();
    error StreamNotActiveOrPaused();
    error StreamNotActive();
    error StreamNotPaused();
    error StreamCompletedOrCanceled();
    error InvalidFee();
    error InsufficientBalance();
    error NothingToWithdraw();
    error StartTimeInPast();
    error EndTimeBeforeStartTime();
    error CallerNotSenderOrRecipient();

    constructor(address _initialOwner, address _feeCollector, uint16 _feeInBasisPoints) 
        Ownable(_initialOwner) 
    {
        if (_feeInBasisPoints > MAX_FEE) revert InvalidFee();
        if (_feeCollector == address(0)) revert InvalidRecipient();
        feeCollector = _feeCollector;
        feeInBasisPoints = _feeInBasisPoints;
    }

    // --- Admin Functions ---

    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert InvalidRecipient();
        feeCollector = _feeCollector;
    }

    function setFeeInBasisPoints(uint16 _feeInBasisPoints) external onlyOwner {
        if (_feeInBasisPoints > MAX_FEE) revert InvalidFee();
        feeInBasisPoints = _feeInBasisPoints;
    }

    function setTokenSupport(address tokenAddress, bool isSupported) external onlyOwner {
        if (tokenAddress == address(0)) revert InvalidTokenAddress();
        supportedTokens[tokenAddress] = isSupported;
    }

    // --- Stream Creation ---

    /**
     * @notice Creates a new token stream.
     * @param recipient The address receiving the stream.
     * @param tokenAddress The ERC20 token to be streamed.
     * @param totalAmount The net amount of tokens to be streamed to the recipient.
     * @param startTime The Unix timestamp for when the stream should start.
     * @param endTime The Unix timestamp for when the stream should end.
     * @return streamId The ID of the newly created stream.
     */
    function createStream(
        address recipient,
        address tokenAddress,
        uint256 totalAmount,
        uint256 startTime,
        uint256 endTime
    ) external nonReentrant returns (bytes32 streamId) {
        // Validation
        if (recipient == address(0) || recipient == msg.sender) revert InvalidRecipient();
        if (tokenAddress == address(0)) revert InvalidTokenAddress();
        if (!supportedTokens[tokenAddress]) revert TokenNotSupported();
        if (totalAmount == 0) revert InvalidAmount();
        if (startTime < block.timestamp) revert StartTimeInPast();
        if (endTime <= startTime) revert EndTimeBeforeStartTime();

        uint256 duration = endTime - startTime;
        
        // FIXED: Calculate fee properly - fee is in addition to the amount
        uint256 feeAmount = (totalAmount * feeInBasisPoints) / 10000;
        uint256 depositAmount = totalAmount + feeAmount; // Total amount sender pays

        IERC20 token = IERC20(tokenAddress);
        if (token.balanceOf(msg.sender) < depositAmount) revert InsufficientBalance();
        
        // Transfer total amount (including fee) from sender
        token.safeTransferFrom(msg.sender, address(this), depositAmount);
        
        // Transfer fee to fee collector
        if (feeAmount > 0) {
            token.safeTransfer(feeCollector, feeAmount);
        }

        // Generate unique stream ID
        streamId = keccak256(abi.encodePacked(
            msg.sender, 
            recipient, 
            tokenAddress, 
            totalAmount, 
            startTime, 
            endTime, 
            nextStreamIdNonce
        ));
        nextStreamIdNonce++;

        // Create stream
        Stream storage newStream = streams[streamId];
        newStream.sender = msg.sender;
        newStream.recipient = recipient;
        newStream.tokenAddress = tokenAddress;
        newStream.totalAmount = totalAmount; // Net amount after fee
        newStream.ratePerSecond = totalAmount / duration;
        newStream.startTime = startTime;
        newStream.endTime = endTime;
        newStream.status = StreamStatus.Scheduled;

        // Update tracking
        senderStreams[msg.sender].push(streamId);
        recipientStreams[recipient].push(streamId);

        emit StreamCreated(
            streamId, 
            msg.sender, 
            recipient, 
            tokenAddress, 
            totalAmount, 
            depositAmount, 
            startTime, 
            endTime, 
            newStream.ratePerSecond
        );
        
        return streamId;
    }

    // --- Stream Interaction ---

    /**
     * @notice Calculates the amount of tokens that can be withdrawn from a stream.
     * @param streamId The ID of the stream.
     * @return withdrawableAmount The amount available for withdrawal.
     */
    function getWithdrawableAmount(bytes32 streamId) public view returns (uint256 withdrawableAmount) {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();

        if (stream.status == StreamStatus.Canceled || stream.status == StreamStatus.Completed) {
            return 0;
        }
        
        if (block.timestamp < stream.startTime) {
            return 0; // Stream hasn't started
        }

        uint256 effectiveCurrentTime = Math.min(block.timestamp, stream.endTime);
        uint256 activeDuration = effectiveCurrentTime - stream.startTime;

        // Subtract paused duration
        if (stream.status == StreamStatus.Paused) {
            activeDuration = activeDuration - stream.totalPausedDuration - (effectiveCurrentTime - stream.lastPausedTime);
        } else {
            activeDuration = activeDuration - stream.totalPausedDuration;
        }

        if (activeDuration == 0) return 0;

        uint256 streamedAmount = Math.min(activeDuration * stream.ratePerSecond, stream.totalAmount);
        withdrawableAmount = streamedAmount > stream.amountWithdrawn ? 
            streamedAmount - stream.amountWithdrawn : 0;

        return withdrawableAmount;
    }

    /**
     * @notice Updates stream status based on current time.
     */
    function _updateStreamStatus(Stream storage stream) internal {
        if (stream.status == StreamStatus.Scheduled && block.timestamp >= stream.startTime) {
            stream.status = StreamStatus.Active;
        }
    }

    /**
     * @notice Withdraws available tokens from a stream.
     * @param streamId The ID of the stream.
     * @return withdrawnAmount The amount of tokens withdrawn.
     */
    function withdrawFromStream(bytes32 streamId) external nonReentrant returns (uint256 withdrawnAmount) {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();
        if (msg.sender != stream.recipient) revert NotStreamRecipient();
        
        _updateStreamStatus(stream);

        if (stream.status != StreamStatus.Active && stream.status != StreamStatus.Paused) {
            revert StreamNotActiveOrPaused();
        }

        withdrawnAmount = getWithdrawableAmount(streamId);
        if (withdrawnAmount == 0) revert NothingToWithdraw();

        stream.amountWithdrawn += withdrawnAmount;

        IERC20(stream.tokenAddress).safeTransfer(stream.recipient, withdrawnAmount);

        emit StreamWithdrawn(streamId, stream.recipient, withdrawnAmount);

        // Check if stream is completed
        if (stream.amountWithdrawn >= stream.totalAmount) {
            stream.status = StreamStatus.Completed;
            emit StreamCompleted(streamId, block.timestamp);
        }
        
        return withdrawnAmount;
    }

    /**
     * @notice Pauses an active stream.
     * @param streamId The ID of the stream.
     */
    function pauseStream(bytes32 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();
        if (msg.sender != stream.sender && msg.sender != stream.recipient) {
            revert CallerNotSenderOrRecipient();
        }
        
        _updateStreamStatus(stream);
        if (stream.status != StreamStatus.Active) revert StreamNotActive();
        if (block.timestamp >= stream.endTime) revert StreamCompletedOrCanceled();

        stream.lastPausedTime = block.timestamp;
        stream.status = StreamStatus.Paused;

        emit StreamPaused(streamId, block.timestamp);
    }

    /**
     * @notice Resumes a paused stream.
     * @param streamId The ID of the stream.
     */
    function resumeStream(bytes32 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();
        if (msg.sender != stream.sender && msg.sender != stream.recipient) {
            revert CallerNotSenderOrRecipient();
        }
        if (stream.status != StreamStatus.Paused) revert StreamNotPaused();
        if (block.timestamp >= stream.endTime) revert StreamCompletedOrCanceled();

        stream.totalPausedDuration += (block.timestamp - stream.lastPausedTime);
        stream.lastPausedTime = 0;
        stream.status = StreamStatus.Active;

        emit StreamResumed(streamId, block.timestamp);
    }

    /**
     * @notice Cancels a stream and distributes remaining tokens.
     * @param streamId The ID of the stream.
     */
    function cancelStream(bytes32 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();
        if (msg.sender != stream.sender && msg.sender != stream.recipient) {
            revert CallerNotSenderOrRecipient();
        }
        if (stream.status == StreamStatus.Completed || stream.status == StreamStatus.Canceled) {
            revert StreamCompletedOrCanceled();
        }
        
        _updateStreamStatus(stream);

        // Calculate final amounts
        uint256 recipientAmount = getWithdrawableAmount(streamId);
        uint256 senderRefund = stream.totalAmount - stream.amountWithdrawn - recipientAmount;

        IERC20 token = IERC20(stream.tokenAddress);

        // Transfer to recipient
        if (recipientAmount > 0) {
            stream.amountWithdrawn += recipientAmount;
            token.safeTransfer(stream.recipient, recipientAmount);
        }

        // Refund to sender
        if (senderRefund > 0) {
            token.safeTransfer(stream.sender, senderRefund);
        }

        stream.status = StreamStatus.Canceled;
        emit StreamCanceled(streamId, stream.sender, stream.recipient, senderRefund, recipientAmount);
    }

    // --- View Functions ---

    function getStream(bytes32 streamId) external view returns (Stream memory) {
        Stream storage s = streams[streamId];
        if (s.sender == address(0)) revert StreamNotFound();
        return s;
    }

    function getSenderStreams(address sender) external view returns (bytes32[] memory) {
        return senderStreams[sender];
    }

    function getRecipientStreams(address recipient) external view returns (bytes32[] memory) {
        return recipientStreams[recipient];
    }

    function calculateFee(uint256 amount) public view returns (uint256) {
        return (amount * feeInBasisPoints) / 10000;
    }

    function calculateDepositAmount(uint256 netAmount) public view returns (uint256) {
        return netAmount + calculateFee(netAmount);
    }
}