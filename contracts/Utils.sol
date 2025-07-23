// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract Utils {
    enum State {
        Pending,
        Active
    }

    string private constant DURATION_HOUR = "1 hour";
    string private constant DURATION_DAY = "1 day";
    string private constant DURATION_MONTH = "1 month";
    string private constant DURATION_YEAR = "1 year";

    function generateHash(string memory input) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(input));
    }

    function generateRsaId(
        address _provider,
        address _recipient,
        string memory _recipientEmail
    ) external pure returns (bytes20) {
        return
            ripemd160(
                abi.encodePacked(
                    keccak256(
                        abi.encodePacked(_provider, _recipient, _recipientEmail)
                    )
                )
            );
    }

    function generateDsaId(
        address _provider,
        address _recipient
    ) external pure returns (bytes20) {
        return
            ripemd160(
                abi.encodePacked(
                    keccak256(abi.encodePacked(_provider, _recipient))
                )
            );
    }

    function generateAssignmentId(
        bytes20 _rsaId,
        uint256 _timestamp,
        uint256 _blockNumber
    ) external pure returns (bytes20) {
        return
            ripemd160(
                abi.encodePacked(
                    keccak256(
                        abi.encodePacked(_rsaId, _timestamp, _blockNumber)
                    )
                )
            );
    }

    function getDurationInSeconds(
        string memory _duration
    ) external view returns (uint256) {
        if (this.generateHash(_duration) == this.generateHash(DURATION_HOUR))
            return 1 hours;
        if (this.generateHash(_duration) == this.generateHash(DURATION_DAY))
            return 1 days;
        if (this.generateHash(_duration) == this.generateHash(DURATION_MONTH))
            return 30 days;
        if (this.generateHash(_duration) == this.generateHash(DURATION_YEAR))
            return 365 days;
        revert("Invalid duration");
    }
    function generateDsaIdFromCommitments(
    uint256 _providerCommitment,
    uint256 _recipientCommitment
) external pure returns (bytes20) {
    return ripemd160(abi.encodePacked(_providerCommitment, _recipientCommitment));
}


    constructor() {}
}
