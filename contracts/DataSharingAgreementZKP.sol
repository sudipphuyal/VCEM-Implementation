// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./ABVerifier.sol";
import "./Utils.sol";

interface IUtils {
    function generateDsaIdFromCommitments(uint256 _providerCommitment, uint256 _recipientCommitment) external pure returns (bytes20);
    function getDurationInSeconds(string memory _duration) external view returns (uint256);
}

contract DataSharingAgreementZKP {
    enum DsaState { Pending, Active }

    struct Dsa {
        uint256 providerCommitment;
        uint256 recipientCommitment;
        DsaState state;
        string duration;
        string sharedData;
        uint256 expiresAt;
        uint256 createdAt;
    }

    struct DsaInfo {
        bytes20 dsaId;
        uint256 providerCommitment;
        uint256 recipientCommitment;
        DsaState state;
        string duration;
        string sharedData;
        uint256 expiresAt;
        uint256 createdAt;
    }

    mapping(bytes20 => Dsa) public dsas;

    Utils public immutable utils;
    ABVerifier public immutable verifier;

    event DsaCreated(bytes20 indexed dsaId, uint256 providerCommitment, uint256 recipientCommitment, string duration, uint256 expiresAt, string sharedData);
    event DsaAccepted(bytes20 indexed dsaId);

    constructor(address _utilsContract, address _verifierContract) {
        utils = Utils(_utilsContract);
        verifier = ABVerifier(_verifierContract);
    }

    function createDsaWithProof(
        string memory _duration,
        string memory _sharedData,
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[1] memory input  // provider commitment
    ) external {
        require(verifier.verifyProof(a, b, c, input), "Invalid ZK proof");

        uint256 providerCommitment = input[0];
        uint256 recipientCommitment = 0; // set later by recipient

        bytes20 dsaId = utils.generateDsaIdFromCommitments(providerCommitment, recipientCommitment);
        if (dsas[dsaId].providerCommitment != 0) revert("DSA already exists");

        uint256 durationInSeconds = utils.getDurationInSeconds(_duration);

        dsas[dsaId] = Dsa({
            providerCommitment: providerCommitment,
            recipientCommitment: recipientCommitment,
            state: DsaState.Pending,
            duration: _duration,
            sharedData: _sharedData,
            expiresAt: block.timestamp + durationInSeconds,
            createdAt: block.timestamp
        });

        emit DsaCreated(dsaId, providerCommitment, recipientCommitment, _duration, block.timestamp + durationInSeconds, _sharedData);
    }

    function acceptDsaWithProof(
        uint256 _providerCommitment,
        string memory,
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[1] memory input // recipient commitment
    ) external {
        require(verifier.verifyProof(a, b, c, input), "Invalid ZK proof");

        uint256 recipientCommitment = input[0];
        bytes20 dsaId = utils.generateDsaIdFromCommitments(_providerCommitment, 0);
        if (dsas[dsaId].providerCommitment != _providerCommitment) revert("DSA not found");
        if (dsas[dsaId].state != DsaState.Pending) revert("DSA not pending");

        // update recipient commitment and promote state
        dsas[dsaId].recipientCommitment = recipientCommitment;
        dsas[dsaId].state = DsaState.Active;

        emit DsaAccepted(dsaId);
    }

    function getDsaInfo(bytes20 _dsaId) external view returns (DsaInfo memory) {
        Dsa memory dsa = dsas[_dsaId];
        require(dsa.providerCommitment != 0, "DSA not found");
        return DsaInfo({
            dsaId: _dsaId,
            providerCommitment: dsa.providerCommitment,
            recipientCommitment: dsa.recipientCommitment,
            state: dsa.state,
            duration: dsa.duration,
            sharedData: dsa.sharedData,
            expiresAt: dsa.expiresAt,
            createdAt: dsa.createdAt
        });
    }

    function getDsaState(bytes20 _dsaId) external view returns (DsaState) {
        require(dsas[_dsaId].providerCommitment != 0, "DSA not found");
        return dsas[_dsaId].state;
    }

    function getCommitments(bytes20 _dsaId) external view returns (uint256, uint256) {
        Dsa memory dsa = dsas[_dsaId];
        return (dsa.providerCommitment, dsa.recipientCommitment);
    }
}
