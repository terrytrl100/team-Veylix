// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VeylixAnchor
/// @notice Notary for Veylix risk reports. Stores a timestamp + author per report
///         hash so anyone can later prove a report is authentic and unaltered.
///         Holds no funds. Anyone can anchor; anyone can read. First write wins,
///         so a timestamp can never be overwritten.
contract VeylixAnchor {
    /// @dev reportHash => block timestamp it was first anchored (0 = never)
    mapping(bytes32 => uint256) public anchoredAt;

    /// @dev reportHash => the address that anchored it
    mapping(bytes32 => address) public anchoredBy;

    event Anchored(bytes32 indexed reportHash, address indexed by, uint256 timestamp);

    /// @notice Record a report hash on-chain. Reverts if already anchored.
    function anchor(bytes32 reportHash) external {
        require(anchoredAt[reportHash] == 0, "already anchored");
        anchoredAt[reportHash] = block.timestamp;
        anchoredBy[reportHash] = msg.sender;
        emit Anchored(reportHash, msg.sender, block.timestamp);
    }

    /// @notice Read helper. Returns (timestamp, author). timestamp 0 = not anchored.
    function verify(bytes32 reportHash) external view returns (uint256, address) {
        return (anchoredAt[reportHash], anchoredBy[reportHash]);
    }
}
