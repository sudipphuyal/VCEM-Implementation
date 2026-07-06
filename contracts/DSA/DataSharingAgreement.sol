// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
// import "../PatientIdVerifier.sol";

interface IUtils {
    function generateDsaId(
        address _provider,
        address _recipient
    ) external pure returns (bytes20);

    function getDurationInSeconds(
        string memory _duration
    ) external view returns (uint256);
}

interface IRegistries {
    function isPatient(address _patient) external view returns (bool);

    function isHealthcareProfessional(
        address _professional
    ) external view returns (bool);
}

contract DataSharingAgreement {
    enum DsaState {
        Pending,
        Active
    }

    struct Dsa {
        address provider;
        address recipient;
        DsaState state;
        string duration;
        string sharedData;
        uint256 expiresAt;
        uint256 createdAt;
    }

    struct DsaInfo {
        bytes20 dsaId;
        address provider;
        address recipient;
        DsaState state;
        string duration;
        string sharedData;
        uint256 expiresAt;
        uint256 createdAt;
    }

    mapping(bytes20 => Dsa) public dsas;
    mapping(address => bytes20[]) private providerDsas;
    mapping(address => bytes20[]) private recipientDsas;

    IUtils public immutable utils;
    IRegistries public immutable registriesContract;

    event DsaCreated(
        bytes20 indexed dsaId,
        address indexed provider,
        address indexed recipient,
        string duration,
        uint256 expiresAt,
        string sharedData
    );
    event DsaAccepted(
        bytes20 indexed dsaId,
        address provider,
        address recipient
    );
    event DsaRejected(
        bytes20 indexed dsaId,
        address provider,
        address recipient
    );
    event DsaCancelled(
        bytes20 indexed dsaId,
        address provider,
        address recipient
    );
    event DsaRevoked(
        bytes20 indexed dsaId,
        address provider,
        address recipient,
        address caller
    );

    constructor(address _utilsContract, address _registriesContract) {
        utils = IUtils(_utilsContract);
        registriesContract = IRegistries(_registriesContract);
    }

    function _removeDsaIdFromProvider(
        bytes20 _dsaId,
        address _provider
    ) internal {
        bytes20[] storage dsaIds = providerDsas[_provider];
        for (uint256 i = 0; i < dsaIds.length; i++) {
            if (dsaIds[i] == _dsaId) {
                dsaIds[i] = dsaIds[dsaIds.length - 1];
                dsaIds.pop();
                break;
            }
        }
    }


    function _removeDsaIdFromRecipient(
        bytes20 _dsaId,
        address _recipient
    ) internal {
        bytes20[] storage dsaIds = recipientDsas[_recipient];
        for (uint256 i = 0; i < dsaIds.length; i++) {
            if (dsaIds[i] == _dsaId) {
                dsaIds[i] = dsaIds[dsaIds.length - 1];
                dsaIds.pop();
                break;
            }
        }
    }

    function createDsa(
        address _recipient,
        string memory _duration,
        string memory _sharedData
    ) external {
        require(
            registriesContract.isPatient(msg.sender),
            "Only patients can create DSAs"
        );
        require(
            registriesContract.isHealthcareProfessional(_recipient),
            "Recipient must be a healthcare professional"
        );

        bytes20 dsaId = utils.generateDsaId(msg.sender, _recipient);
        require(dsas[dsaId].provider == address(0), "DSA already exists");

        uint256 durationInSeconds = utils.getDurationInSeconds(_duration);

        dsas[dsaId] = Dsa({
            provider: msg.sender,
            recipient: _recipient,
            state: DsaState.Pending,
            duration: _duration,
            sharedData: _sharedData,
            expiresAt: block.timestamp + durationInSeconds,
            createdAt: block.timestamp
        });
        providerDsas[msg.sender].push(dsaId);
        recipientDsas[_recipient].push(dsaId);

        emit DsaCreated(
            dsaId,
            msg.sender,
            _recipient,
            _duration,
            dsas[dsaId].expiresAt,
            _sharedData
        );
    }

    function acceptDsa(bytes20 _dsaId) external {
        require(
            registriesContract.isHealthcareProfessional(msg.sender),
            "Only healthcare professionals can accept DSAs"
        );
        require(dsas[_dsaId].recipient == msg.sender, "Not the recipient");
        if (dsas[_dsaId].state != DsaState.Pending) revert("DSA not pending");

        dsas[_dsaId].state = DsaState.Active;
        emit DsaAccepted(_dsaId, dsas[_dsaId].provider, dsas[_dsaId].recipient);
    }

    function burnDsa(bytes20 _dsaId) internal {
        require(dsas[_dsaId].provider != address(0), "DSA not found");

        _removeDsaIdFromProvider(_dsaId, dsas[_dsaId].provider);

        if (dsas[_dsaId].recipient != address(0)) {
            _removeDsaIdFromRecipient(_dsaId, dsas[_dsaId].recipient);
        }

        delete dsas[_dsaId];
    }

    function rejectDsa(bytes20 _dsaId) external {
        require(dsas[_dsaId].recipient == msg.sender, "Not the recipient");
        if (dsas[_dsaId].state != DsaState.Pending) revert("DSA not pending");

        address provider = dsas[_dsaId].provider;
        address recipient = dsas[_dsaId].recipient;

        burnDsa(_dsaId);

        emit DsaRejected(_dsaId, provider, recipient);
    }

    function cancelDsa(bytes20 _dsaId) external {
        require(dsas[_dsaId].provider == msg.sender, "Not the provider");
        if (dsas[_dsaId].state != DsaState.Pending) revert("Cannot cancel");

        address provider = dsas[_dsaId].provider;
        address recipient = dsas[_dsaId].recipient;

        burnDsa(_dsaId);

        emit DsaCancelled(_dsaId, provider, recipient);
    }

    function revokeDsa(bytes20 _dsaId) external {
        Dsa storage dsa = dsas[_dsaId];
        require(dsa.provider != address(0), "Invalid Dsa ID");

        require(
            msg.sender == dsa.provider || msg.sender == dsa.recipient,
            "Only provider or recipient can revoke Dsa"
        );

        address provider = dsa.provider;
        address recipient = dsa.recipient;

        burnDsa(_dsaId);

        emit DsaRevoked(_dsaId, provider, recipient, msg.sender);
    }

    /* VIEW FUNCTIONS */

    function _getDsaInfo(
        bytes20 _dsaId,
        Dsa memory _dsa
    ) internal pure returns (DsaInfo memory) {
        return
            DsaInfo({
                dsaId: _dsaId,
                provider: _dsa.provider,
                recipient: _dsa.recipient,
                state: _dsa.state,
                duration: _dsa.duration,
                sharedData: _dsa.sharedData,
                expiresAt: _dsa.expiresAt,
                createdAt: _dsa.createdAt
            });
    }

    function getDsaInfo(bytes20 _dsaId) external view returns (DsaInfo memory) {
        Dsa storage dsa = dsas[_dsaId];
        require(dsa.provider != address(0), "DSA not found");
        return _getDsaInfo(_dsaId, dsa);
    }

    function getDsaById(bytes20 _dsaId) external view returns (DsaInfo memory) {
        Dsa memory dsa = dsas[_dsaId];
        require(dsa.provider != address(0), "DSA not found");
        return
            DsaInfo({
                dsaId: _dsaId,
                provider: dsa.provider,
                recipient: dsa.recipient,
                state: dsa.state,
                duration: dsa.duration,
                sharedData: dsa.sharedData,
                expiresAt: dsa.expiresAt,
                createdAt: dsa.createdAt
            });
    }

    function getDsaState(bytes20 _dsaId) external view returns (DsaState) {
        require(dsas[_dsaId].provider != address(0), "DSA not found");
        return dsas[_dsaId].state;
    }

    function getDsaByParties(
        address _provider,
        address _recipient
    ) external view returns (DsaInfo memory) {
        bytes20 dsaId = utils.generateDsaId(_provider, _recipient);
        require(dsas[dsaId].provider != address(0), "DSA not found");
        Dsa memory dsa = dsas[dsaId];
        return
            DsaInfo({
                dsaId: dsaId,
                provider: dsa.provider,
                recipient: dsa.recipient,
                state: dsa.state,
                duration: dsa.duration,
                sharedData: dsa.sharedData,
                expiresAt: dsa.expiresAt,
                createdAt: dsa.createdAt
            });
    }

    function getProviderDsas(
        address _provider
    ) external view returns (bytes20[] memory) {
        return providerDsas[_provider];
    }

    function getRecipientDsas(
        address _recipient
    ) external view returns (bytes20[] memory) {
        return recipientDsas[_recipient];
    }
}
