// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PaymentStream {
    enum StreamStatus { Active, Paused, Stopped }

    struct Milestone {
        string description;
        uint256 amount;
        bool released;
    }

    struct Stream {
        address sender;
        address recipient;
        uint256 totalAmount;
        uint256 startTime;
        uint256 duration;
        uint256 releasedAmount;
        StreamStatus status;
        Milestone[] milestones;
        bool isMilestoneBased;
    }

    mapping(bytes32 => Stream) public streams;

    event StreamCreated(bytes32 indexed streamId, address indexed sender, address indexed recipient, uint256 totalAmount, uint256 duration, bool isMilestoneBased);
    event StreamPaused(bytes32 indexed streamId);
    event StreamResumed(bytes32 indexed streamId);
    event StreamStopped(bytes32 indexed streamId);
    event FundsReleased(bytes32 indexed streamId, uint256 amount);
    event MilestoneReleased(bytes32 indexed streamId, uint256 milestoneIndex, uint256 amount);

    // Create a time-based or milestone-based stream
    function createStream(address recipient, uint256 duration, bool isMilestoneBased, Milestone[] memory milestones) external payable returns (bytes32) {
        require(msg.value > 0, "No funds sent");
        require(recipient != address(0), "Invalid recipient");
        require(duration > 0, "Duration must be positive");
        bytes32 streamId = keccak256(abi.encodePacked(msg.sender, recipient, msg.value, duration, block.timestamp));
        Stream storage s = streams[streamId];
        s.sender = msg.sender;
        s.recipient = recipient;
        s.totalAmount = msg.value;
        s.startTime = block.timestamp;
        s.duration = duration;
        s.status = StreamStatus.Active;
        s.isMilestoneBased = isMilestoneBased;
        if (isMilestoneBased) {
            uint256 totalMilestoneAmount = 0;
            for (uint256 i = 0; i < milestones.length; i++) {
                s.milestones.push(milestones[i]);
                totalMilestoneAmount += milestones[i].amount;
            }
            require(totalMilestoneAmount == msg.value, "Milestone amounts must sum to total");
        }
        emit StreamCreated(streamId, msg.sender, recipient, msg.value, duration, isMilestoneBased);
        return streamId;
    }

    // Pause a stream
    function pauseStream(bytes32 streamId) external {
        Stream storage s = streams[streamId];
        require(msg.sender == s.sender, "Only sender can pause");
        require(s.status == StreamStatus.Active, "Not active");
        s.status = StreamStatus.Paused;
        emit StreamPaused(streamId);
    }

    // Resume a paused stream
    function resumeStream(bytes32 streamId) external {
        Stream storage s = streams[streamId];
        require(msg.sender == s.sender, "Only sender can resume");
        require(s.status == StreamStatus.Paused, "Not paused");
        s.status = StreamStatus.Active;
        emit StreamResumed(streamId);
    }

    // Stop a stream
    function stopStream(bytes32 streamId) external {
        Stream storage s = streams[streamId];
        require(msg.sender == s.sender, "Only sender can stop");
        require(s.status != StreamStatus.Stopped, "Already stopped");
        s.status = StreamStatus.Stopped;
        uint256 refund = s.totalAmount - s.releasedAmount;
        if (refund > 0) {
            payable(s.sender).transfer(refund);
        }
        emit StreamStopped(streamId);
    }

    // Release funds for time-based stream
    function releaseFunds(bytes32 streamId) external {
        Stream storage s = streams[streamId];
        require(s.status == StreamStatus.Active, "Stream not active");
        require(!s.isMilestoneBased, "Use releaseMilestone for milestone streams");
        uint256 elapsed = block.timestamp - s.startTime;
        if (elapsed > s.duration) {
            elapsed = s.duration;
        }
        uint256 releasable = (s.totalAmount * elapsed) / s.duration - s.releasedAmount;
        require(releasable > 0, "Nothing to release");
        s.releasedAmount += releasable;
        payable(s.recipient).transfer(releasable);
        emit FundsReleased(streamId, releasable);
    }

    // Release funds for a milestone
    function releaseMilestone(bytes32 streamId, uint256 milestoneIndex) external {
        Stream storage s = streams[streamId];
        require(s.status == StreamStatus.Active, "Stream not active");
        require(s.isMilestoneBased, "Not a milestone stream");
        require(milestoneIndex < s.milestones.length, "Invalid milestone");
        Milestone storage m = s.milestones[milestoneIndex];
        require(!m.released, "Already released");
        m.released = true;
        s.releasedAmount += m.amount;
        payable(s.recipient).transfer(m.amount);
        emit MilestoneReleased(streamId, milestoneIndex, m.amount);
    }
}