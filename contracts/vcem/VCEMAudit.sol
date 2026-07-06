// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {VCEMTypes} from "./VCEMTypes.sol";
import {IVCEMRegistry} from "./interfaces/IVCEMRegistry.sol";
import {IVCEMConsent} from "./interfaces/IVCEMConsent.sol";
import {VCEMSecurity} from "./libraries/VCEMSecurity.sol";

contract VCEMAudit {
    using VCEMSecurity for bytes32;

    bytes32 public constant ACCESS_REQUEST_TYPEHASH = keccak256(
        "AccessRequest(bytes32 participantId,bytes32 requestorId,bytes32 dataHash,bytes32 scopeHash,uint8 requestedPurpose,bytes32 requestId,uint64 clientTimestamp,uint64 requestExpiry,bytes32 expectedConsentHash)"
    );

    IVCEMRegistry public immutable registry;
    IVCEMConsent public immutable consent;
    bool public paused;
    bool private _entered;

    mapping(bytes32 => bool) public usedRequestIds;
    mapping(bytes32 => mapping(bytes32 => bytes32)) public registeredDataHash;
    mapping(bytes32 => VCEMTypes.AccessEvent) private _accessEvents;
    bytes32[] private _accessEventIds;

    event AccessAuthorized(
        bytes32 indexed requestId,
        bytes32 indexed participantId,
        bytes32 indexed requestorId,
        bytes32 dataHash,
        bytes32 scopeHash,
        uint8 requestedPurpose,
        uint64 consentVersion,
        bytes32 consentHash,
        bytes32 actorsRoot,
        uint64 timestamp
    );

    enum DenialReason {
        NONE,
        NO_ACTIVE_CONSENT,
        CONSENT_REVOKED,
        STALE_CONSENT_HASH,
        INVALID_SIGNATURE,
        EXPIRED_REQUEST,
        REPLAYED_REQUEST,
        UNAUTHORIZED_ACTOR,
        INVALID_PURPOSE,
        PURPOSE_NOT_ALLOWED,
        INVALID_SCOPE,
        SCOPE_NOT_ALLOWED,
        UNKNOWN_DATA_HASH,
        REQUESTOR_REVOKED
    }

    event AccessDenied(
        bytes32 indexed requestId,
        bytes32 indexed participantId,
        bytes32 indexed requestorId,
        DenialReason reasonCode,
        bytes32 expectedConsentHash,
        bytes32 activeConsentHash,
        uint64 timestamp
    );
    event DataHashRegistered(bytes32 indexed participantId, bytes32 indexed scopeHash, bytes32 dataHash, address operator);
    event Paused(address indexed operator);
    event Unpaused(address indexed operator);

    modifier onlyAdmin() {
        require(registry.hasRole(msg.sender, VCEMTypes.Role.ADMIN), "VCEMAudit: admin only");
        _;
    }

    modifier onlyGateway() {
        require(registry.hasRole(msg.sender, VCEMTypes.Role.POLICY_GATEWAY), "VCEMAudit: gateway only");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "VCEMAudit: paused");
        _;
    }

    modifier nonReentrant() {
        require(!_entered, "VCEMAudit: reentrant");
        _entered = true;
        _;
        _entered = false;
    }

    struct AccessRequest {
        bytes32 participantId;
        bytes32 requestorId;
        bytes32 dataHash;
        bytes32 scopeHash;
        uint8 requestedPurpose;
        bytes32 requestId;
        uint64 clientTimestamp;
        uint64 requestExpiry;
        bytes32 expectedConsentHash;
    }

    constructor(address registryAddress, address consentAddress) {
        require(registryAddress != address(0), "VCEMAudit: empty registry");
        require(consentAddress != address(0), "VCEMAudit: empty consent");
        registry = IVCEMRegistry(registryAddress);
        consent = IVCEMConsent(consentAddress);
    }

    function authorizeAndLogAccess(
        AccessRequest calldata request,
        bytes calldata actorSignature
    ) external onlyGateway whenNotPaused nonReentrant returns (bytes32) {
        require(request.requestId != bytes32(0), "VCEMAudit: empty request");
        require(request.dataHash != bytes32(0), "VCEMAudit: empty data hash");
        require(VCEMTypes.isSingleValidPurpose(request.requestedPurpose), "VCEMAudit: invalid purpose");
        require(block.timestamp <= request.requestExpiry, "VCEMAudit: expired request");
        require(!usedRequestIds[request.requestId], "VCEMAudit: replayed request");

        address requestorWallet = registry.walletOf(request.requestorId);
        require(requestorWallet != address(0), "VCEMAudit: unknown requestor");
        require(registry.isActiveActor(request.requestorId, VCEMTypes.Role.RESEARCHER), "VCEMAudit: inactive requestor");
        require(_recoverRequestSigner(request, actorSignature) == requestorWallet, "VCEMAudit: invalid signature");

        VCEMTypes.ConsentVersion memory activeConsent = consent.getCurrentConsentVersion(request.participantId);
        require(activeConsent.status == VCEMTypes.ConsentStatus.ACTIVE, "VCEMAudit: consent inactive");
        require(activeConsent.consentHash == request.expectedConsentHash, "VCEMAudit: outdated consent hash");
        require(consent.isActorAuthorized(request.participantId, activeConsent.version, request.requestorId), "VCEMAudit: actor denied");
        require(consent.isPurposeAuthorized(request.participantId, activeConsent.version, request.requestedPurpose), "VCEMAudit: purpose denied");
        require(consent.isScopeAuthorized(request.participantId, activeConsent.version, request.scopeHash), "VCEMAudit: scope denied");
        require(registeredDataHash[request.participantId][request.scopeHash] == request.dataHash, "VCEMAudit: data hash denied");

        usedRequestIds[request.requestId] = true;
        _accessEvents[request.requestId] = VCEMTypes.AccessEvent({
            requestId: request.requestId,
            participantId: request.participantId,
            requestorId: request.requestorId,
            dataHash: request.dataHash,
            scopeHash: request.scopeHash,
            consentVersion: activeConsent.version,
            consentHash: activeConsent.consentHash,
            actorsRoot: activeConsent.actorsRoot,
            purpose: request.requestedPurpose,
            timestamp: uint64(block.timestamp),
            authorized: true
        });
        _accessEventIds.push(request.requestId);

        emit AccessAuthorized(
            request.requestId,
            request.participantId,
            request.requestorId,
            request.dataHash,
            request.scopeHash,
            request.requestedPurpose,
            activeConsent.version,
            activeConsent.consentHash,
            activeConsent.actorsRoot,
            uint64(block.timestamp)
        );

        return activeConsent.consentHash;
    }

    function logDeniedAccess(AccessRequest calldata request, DenialReason reasonCode, bytes32 activeConsentHash) external onlyGateway whenNotPaused {
        require(request.requestId != bytes32(0), "VCEMAudit: empty request");
        require(reasonCode != DenialReason.NONE, "VCEMAudit: empty reason");
        emit AccessDenied(
            request.requestId,
            request.participantId,
            request.requestorId,
            reasonCode,
            request.expectedConsentHash,
            activeConsentHash,
            uint64(block.timestamp)
        );
    }

    function registerDataHash(bytes32 participantId, bytes32 scopeHash, bytes32 dataHash) external whenNotPaused {
        require(registry.hasRole(msg.sender, VCEMTypes.Role.DATA_CUSTODIAN), "VCEMAudit: custodian only");
        require(participantId != bytes32(0), "VCEMAudit: empty participant");
        require(scopeHash != bytes32(0), "VCEMAudit: empty scope");
        require(dataHash != bytes32(0), "VCEMAudit: empty data hash");
        registeredDataHash[participantId][scopeHash] = dataHash;
        emit DataHashRegistered(participantId, scopeHash, dataHash, msg.sender);
    }

    function getAccessEvent(bytes32 requestId) external view returns (VCEMTypes.AccessEvent memory) {
        return _accessEvents[requestId];
    }

    function getAccessEventIds(uint256 offset, uint256 limit) external view returns (bytes32[] memory) {
        require(limit <= 500, "VCEMAudit: limit too large");
        if (offset >= _accessEventIds.length) {
            return new bytes32[](0);
        }
        uint256 end = offset + limit;
        if (end > _accessEventIds.length) {
            end = _accessEventIds.length;
        }
        bytes32[] memory ids = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            ids[i - offset] = _accessEventIds[i];
        }
        return ids;
    }

    function accessEventCount() external view returns (uint256) {
        return _accessEventIds.length;
    }

    function hashAccessRequest(AccessRequest calldata request) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ACCESS_REQUEST_TYPEHASH,
                request.participantId,
                request.requestorId,
                request.dataHash,
                request.scopeHash,
                request.requestedPurpose,
                request.requestId,
                request.clientTimestamp,
                request.requestExpiry,
                request.expectedConsentHash
            )
        );
    }

    function requestDigest(AccessRequest calldata request) public view returns (bytes32) {
        return VCEMSecurity.typedDataHash(
            VCEMSecurity.domainSeparator("VCEMAudit", "1", address(this)),
            hashAccessRequest(request)
        );
    }

    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function _recoverRequestSigner(AccessRequest calldata request, bytes calldata signature) internal view returns (address) {
        return VCEMSecurity.recoverSigner(requestDigest(request), signature);
    }
}
