// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {VCEMTypes} from "../VCEMTypes.sol";

interface IVCEMConsent {
    function getCurrentConsentVersion(bytes32 participantId) external view returns (VCEMTypes.ConsentVersion memory);
    function getConsentVersion(bytes32 participantId, uint64 version) external view returns (VCEMTypes.ConsentVersion memory);
    function getCurrentActiveConsentHash(bytes32 participantId) external view returns (bytes32);
    function isActorAuthorized(bytes32 participantId, uint64 version, bytes32 actorId) external view returns (bool);
    function isPurposeAuthorized(bytes32 participantId, uint64 version, uint8 purpose) external view returns (bool);
    function isScopeAuthorized(bytes32 participantId, uint64 version, bytes32 scopeHash) external view returns (bool);
}
