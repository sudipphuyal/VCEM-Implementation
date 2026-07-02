// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

library VCEMTypes {
    enum ConsentStatus {
        NONE,
        ACTIVE,
        UPDATED,
        REVOKED
    }

    enum Role {
        NONE,
        ADMIN,
        PARTICIPANT,
        RESEARCHER,
        DATA_CUSTODIAN,
        POLICY_GATEWAY,
        AUDITOR
    }

    struct ConsentPolicy {
        uint8 purposeMask;
        bytes32 scopeHash;
        bytes32 actorsRoot;
        bytes32 zkConsentCommitment;
    }

    struct ConsentVersion {
        uint64 version;
        ConsentStatus status;
        uint8 purposeMask;
        bytes32 scopeHash;
        bytes32 actorsRoot;
        bytes32 previousConsentHash;
        bytes32 consentHash;
        bytes32 zkConsentCommitment;
        uint64 timestamp;
        uint64 revokedAt;
    }

    struct AccessEvent {
        bytes32 requestId;
        bytes32 participantId;
        bytes32 requestorId;
        bytes32 dataHash;
        bytes32 scopeHash;
        bytes32 consentHash;
        uint8 purpose;
        uint64 timestamp;
        bool authorized;
    }
}
