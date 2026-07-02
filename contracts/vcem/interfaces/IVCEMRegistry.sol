// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {VCEMTypes} from "../VCEMTypes.sol";

interface IVCEMRegistry {
    function hasRole(address account, VCEMTypes.Role role) external view returns (bool);
    function isActiveActor(bytes32 actorId, VCEMTypes.Role role) external view returns (bool);
    function walletOf(bytes32 actorId) external view returns (address);
}
