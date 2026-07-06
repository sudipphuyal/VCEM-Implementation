// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {VCEMTypes} from "./VCEMTypes.sol";

contract VCEMRegistry {
    mapping(address => uint256) private _rolesByWallet;
    mapping(address => bytes32) public idOfWallet;
    mapping(bytes32 => address) public walletOf;
    mapping(bytes32 => uint256) private _rolesById;
    mapping(bytes32 => bool) public activeId;
    mapping(bytes32 => bool) public revokedId;

    bool public paused;
    address public immutable owner;

    event RoleGranted(bytes32 indexed actorId, address indexed wallet, VCEMTypes.Role indexed role, address operator);
    event RoleRevoked(bytes32 indexed actorId, address indexed wallet, VCEMTypes.Role indexed role, address operator);
    event ActorRegistered(bytes32 indexed actorId, address indexed wallet, VCEMTypes.Role primaryRole, address operator);
    event ActorWalletUpdated(bytes32 indexed actorId, address indexed oldWallet, address indexed newWallet);
    event ActorRevoked(bytes32 indexed actorId, address indexed wallet, address operator);
    event Paused(address indexed operator);
    event Unpaused(address indexed operator);

    modifier onlyAdmin() {
        require(msg.sender == owner || hasRole(msg.sender, VCEMTypes.Role.ADMIN), "VCEMRegistry: admin only");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "VCEMRegistry: paused");
        _;
    }

    constructor() {
        owner = msg.sender;
        _grantRole(msg.sender, VCEMTypes.Role.ADMIN);
    }

    function roleMask(VCEMTypes.Role role) public pure returns (uint256) {
        require(role != VCEMTypes.Role.NONE, "VCEMRegistry: invalid role");
        return 1 << uint8(role);
    }

    function hasRole(address account, VCEMTypes.Role role) public view returns (bool) {
        return (_rolesByWallet[account] & roleMask(role)) != 0;
    }

    function hasIdRole(bytes32 actorId, VCEMTypes.Role role) public view returns (bool) {
        return (_rolesById[actorId] & roleMask(role)) != 0;
    }

    function isActiveActor(bytes32 actorId, VCEMTypes.Role role) external view returns (bool) {
        return activeId[actorId] && !revokedId[actorId] && hasIdRole(actorId, role) && walletOf[actorId] != address(0);
    }

    function registerActor(bytes32 actorId, address wallet, VCEMTypes.Role primaryRole) external onlyAdmin whenNotPaused {
        require(actorId != bytes32(0), "VCEMRegistry: empty id");
        require(wallet != address(0), "VCEMRegistry: empty wallet");
        require(walletOf[actorId] == address(0), "VCEMRegistry: id exists");
        require(idOfWallet[wallet] == bytes32(0), "VCEMRegistry: wallet exists");

        walletOf[actorId] = wallet;
        idOfWallet[wallet] = actorId;
        activeId[actorId] = true;
        _grantRoleToId(actorId, wallet, primaryRole);
        emit ActorRegistered(actorId, wallet, primaryRole, msg.sender);
    }

    function grantRole(bytes32 actorId, VCEMTypes.Role role) external onlyAdmin whenNotPaused {
        address wallet = walletOf[actorId];
        require(wallet != address(0), "VCEMRegistry: unknown id");
        _grantRoleToId(actorId, wallet, role);
    }

    function revokeRole(bytes32 actorId, VCEMTypes.Role role) external onlyAdmin whenNotPaused {
        address wallet = walletOf[actorId];
        require(wallet != address(0), "VCEMRegistry: unknown id");
        uint256 mask = roleMask(role);
        _rolesById[actorId] &= ~mask;
        _rolesByWallet[wallet] &= ~mask;
        emit RoleRevoked(actorId, wallet, role, msg.sender);
    }

    function updateWallet(bytes32 actorId, address newWallet) external onlyAdmin whenNotPaused {
        require(newWallet != address(0), "VCEMRegistry: empty wallet");
        require(idOfWallet[newWallet] == bytes32(0), "VCEMRegistry: wallet exists");
        address oldWallet = walletOf[actorId];
        require(oldWallet != address(0), "VCEMRegistry: unknown id");
        delete idOfWallet[oldWallet];
        _rolesByWallet[newWallet] = _rolesByWallet[oldWallet];
        delete _rolesByWallet[oldWallet];
        walletOf[actorId] = newWallet;
        idOfWallet[newWallet] = actorId;
        emit ActorWalletUpdated(actorId, oldWallet, newWallet);
    }

    function revokeActor(bytes32 actorId) external onlyAdmin whenNotPaused {
        address wallet = walletOf[actorId];
        require(wallet != address(0), "VCEMRegistry: unknown id");
        activeId[actorId] = false;
        revokedId[actorId] = true;
        delete _rolesByWallet[wallet];
        delete _rolesById[actorId];
        emit ActorRevoked(actorId, wallet, msg.sender);
    }

    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function _grantRole(address wallet, VCEMTypes.Role role) internal {
        _rolesByWallet[wallet] |= roleMask(role);
    }

    function _grantRoleToId(bytes32 actorId, address wallet, VCEMTypes.Role role) internal {
        uint256 mask = roleMask(role);
        _rolesById[actorId] |= mask;
        _rolesByWallet[wallet] |= mask;
        emit RoleGranted(actorId, wallet, role, msg.sender);
    }
}
