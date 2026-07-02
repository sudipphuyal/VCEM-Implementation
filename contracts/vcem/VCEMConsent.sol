// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {VCEMTypes} from "./VCEMTypes.sol";
import {IVCEMRegistry} from "./interfaces/IVCEMRegistry.sol";

contract VCEMConsent {
    IVCEMRegistry public immutable registry;
    bool public paused;

    mapping(bytes32 => uint64) private _currentVersion;
    mapping(bytes32 => mapping(uint64 => VCEMTypes.ConsentVersion)) private _versions;
    mapping(bytes32 => mapping(uint64 => mapping(bytes32 => bool))) private _authorizedActors;
    mapping(bytes32 => bytes32[]) private _participantHistory;

    event ConsentRecorded(
        bytes32 indexed participantId,
        uint64 indexed version,
        bytes32 previousConsentHash,
        bytes32 consentHash,
        uint8 purposeMask,
        bytes32 scopeHash,
        bytes32 actorsRoot,
        bytes32 zkConsentCommitment,
        VCEMTypes.ConsentStatus status,
        uint64 timestamp
    );
    event ConsentUpdated(
        bytes32 indexed participantId,
        uint64 indexed version,
        bytes32 previousConsentHash,
        bytes32 consentHash,
        uint8 purposeMask,
        bytes32 scopeHash,
        bytes32 actorsRoot,
        bytes32 zkConsentCommitment,
        VCEMTypes.ConsentStatus status,
        uint64 timestamp
    );
    event ConsentRevoked(
        bytes32 indexed participantId,
        uint64 indexed version,
        bytes32 previousConsentHash,
        bytes32 consentHash,
        bytes32 actorsRoot,
        VCEMTypes.ConsentStatus status,
        uint64 timestamp
    );
    event Paused(address operator);
    event Unpaused(address operator);

    modifier onlyAdmin() {
        require(registry.hasRole(msg.sender, VCEMTypes.Role.ADMIN), "VCEMConsent: admin only");
        _;
    }

    modifier onlyParticipant(bytes32 participantId) {
        require(registry.walletOf(participantId) == msg.sender, "VCEMConsent: participant only");
        require(registry.isActiveActor(participantId, VCEMTypes.Role.PARTICIPANT), "VCEMConsent: inactive participant");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "VCEMConsent: paused");
        _;
    }

    constructor(address registryAddress) {
        require(registryAddress != address(0), "VCEMConsent: empty registry");
        registry = IVCEMRegistry(registryAddress);
    }

    function createConsent(
        bytes32 participantId,
        VCEMTypes.ConsentPolicy calldata policy,
        bytes32[] calldata authorizedActors
    ) external onlyParticipant(participantId) whenNotPaused returns (bytes32) {
        require(_currentVersion[participantId] == 0, "VCEMConsent: consent exists");
        return _recordVersion(participantId, policy, authorizedActors, VCEMTypes.ConsentStatus.ACTIVE, true);
    }

    function updateConsent(
        bytes32 participantId,
        VCEMTypes.ConsentPolicy calldata policy,
        bytes32[] calldata authorizedActors
    ) external onlyParticipant(participantId) whenNotPaused returns (bytes32) {
        uint64 current = _currentVersion[participantId];
        require(current != 0, "VCEMConsent: no consent");
        require(_versions[participantId][current].status == VCEMTypes.ConsentStatus.ACTIVE, "VCEMConsent: not active");
        _versions[participantId][current].status = VCEMTypes.ConsentStatus.UPDATED;
        return _recordVersion(participantId, policy, authorizedActors, VCEMTypes.ConsentStatus.ACTIVE, false);
    }

    function revokeConsent(bytes32 participantId) external onlyParticipant(participantId) whenNotPaused returns (bytes32) {
        uint64 current = _currentVersion[participantId];
        require(current != 0, "VCEMConsent: no consent");
        VCEMTypes.ConsentVersion storage previous = _versions[participantId][current];
        require(previous.status == VCEMTypes.ConsentStatus.ACTIVE, "VCEMConsent: not active");
        previous.status = VCEMTypes.ConsentStatus.UPDATED;

        VCEMTypes.ConsentPolicy memory policy = VCEMTypes.ConsentPolicy({
            purposeMask: previous.purposeMask,
            scopeHash: previous.scopeHash,
            actorsRoot: previous.actorsRoot,
            zkConsentCommitment: previous.zkConsentCommitment
        });

        bytes32 consentHash = _recordVersion(participantId, policy, new bytes32[](0), VCEMTypes.ConsentStatus.REVOKED, false);
        _versions[participantId][_currentVersion[participantId]].revokedAt = uint64(block.timestamp);
        return consentHash;
    }

    function getCurrentConsentVersion(bytes32 participantId) external view returns (VCEMTypes.ConsentVersion memory) {
        return _versions[participantId][_currentVersion[participantId]];
    }

    function getConsentVersion(bytes32 participantId, uint64 version) external view returns (VCEMTypes.ConsentVersion memory) {
        return _versions[participantId][version];
    }

    function getCurrentVersionNumber(bytes32 participantId) external view returns (uint64) {
        return _currentVersion[participantId];
    }

    function getCurrentActiveConsentHash(bytes32 participantId) external view returns (bytes32) {
        VCEMTypes.ConsentVersion memory current = _versions[participantId][_currentVersion[participantId]];
        require(current.status == VCEMTypes.ConsentStatus.ACTIVE, "VCEMConsent: no active consent");
        return current.consentHash;
    }

    function getConsentHashHistory(bytes32 participantId) external view returns (bytes32[] memory) {
        return _participantHistory[participantId];
    }

    function isActorAuthorized(bytes32 participantId, uint64 version, bytes32 actorId) external view returns (bool) {
        return _authorizedActors[participantId][version][actorId];
    }

    function isPurposeAuthorized(bytes32 participantId, uint64 version, uint8 purpose) external view returns (bool) {
        require(purpose < 8, "VCEMConsent: invalid purpose");
        return (_versions[participantId][version].purposeMask & uint8(1 << purpose)) != 0;
    }

    function isScopeAuthorized(bytes32 participantId, uint64 version, bytes32 scopeHash) external view returns (bool) {
        return _versions[participantId][version].scopeHash == scopeHash;
    }

    function computeConsentHash(
        bytes32 previousConsentHash,
        bytes32 participantId,
        uint8 purposeMask,
        bytes32 scopeHash,
        bytes32 actorsRoot,
        uint64 timestamp,
        uint64 version
    ) public pure returns (bytes32) {
        return sha256(abi.encode(previousConsentHash, participantId, purposeMask, scopeHash, actorsRoot, timestamp, version));
    }

    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function _recordVersion(
        bytes32 participantId,
        VCEMTypes.ConsentPolicy memory policy,
        bytes32[] memory authorizedActors,
        VCEMTypes.ConsentStatus status,
        bool isCreate
    ) internal returns (bytes32) {
        require(policy.scopeHash != bytes32(0), "VCEMConsent: empty scope");
        require(policy.actorsRoot != bytes32(0), "VCEMConsent: empty actors root");
        require(policy.purposeMask != 0, "VCEMConsent: empty purpose");

        uint64 version = _currentVersion[participantId] + 1;
        bytes32 previousHash = version == 1 ? bytes32(0) : _versions[participantId][version - 1].consentHash;
        uint64 timestamp = uint64(block.timestamp);
        bytes32 consentHash = computeConsentHash(
            previousHash,
            participantId,
            policy.purposeMask,
            policy.scopeHash,
            policy.actorsRoot,
            timestamp,
            version
        );

        _versions[participantId][version] = VCEMTypes.ConsentVersion({
            version: version,
            status: status,
            purposeMask: policy.purposeMask,
            scopeHash: policy.scopeHash,
            actorsRoot: policy.actorsRoot,
            previousConsentHash: previousHash,
            consentHash: consentHash,
            zkConsentCommitment: policy.zkConsentCommitment,
            timestamp: timestamp,
            revokedAt: status == VCEMTypes.ConsentStatus.REVOKED ? timestamp : 0
        });

        for (uint256 i = 0; i < authorizedActors.length; i++) {
            require(authorizedActors[i] != bytes32(0), "VCEMConsent: empty actor");
            _authorizedActors[participantId][version][authorizedActors[i]] = true;
        }

        _currentVersion[participantId] = version;
        _participantHistory[participantId].push(consentHash);

        if (isCreate) {
            emit ConsentRecorded(
                participantId,
                version,
                previousHash,
                consentHash,
                policy.purposeMask,
                policy.scopeHash,
                policy.actorsRoot,
                policy.zkConsentCommitment,
                status,
                timestamp
            );
        } else if (status == VCEMTypes.ConsentStatus.REVOKED) {
            emit ConsentRevoked(participantId, version, previousHash, consentHash, policy.actorsRoot, status, timestamp);
        } else {
            emit ConsentUpdated(
                participantId,
                version,
                previousHash,
                consentHash,
                policy.purposeMask,
                policy.scopeHash,
                policy.actorsRoot,
                policy.zkConsentCommitment,
                status,
                timestamp
            );
        }

        return consentHash;
    }
}
