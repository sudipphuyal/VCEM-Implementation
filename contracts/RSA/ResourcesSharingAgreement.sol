// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IUtils {
    function generateRsaId(
        address _provider,
        address _recipient,
        string memory _recipientEmail
    ) external pure returns (bytes20);

    function getDurationInSeconds(
        string memory _duration
    ) external view returns (uint256);

    function generateAssignmentId(
        bytes20 _rsaId,
        uint256 _timestamp,
        uint256 _blockNumber
    ) external pure returns (bytes20);
}

interface IRegistries {
    function isPatient(address _patient) external view returns (bool);

    function isHealthcareProfessional(
        address _professional
    ) external view returns (bool);

    function isTrustedIssuer(
        address _trustedIssuer
    ) external view returns (bool);
}

interface IResourceCertification {
    function verifyResource(
        string memory _resourceId
    )
        external
        view
        returns (
            string memory resourceId,
            address subject,
            address issuer,
            uint256 issuedAt
        );
}

contract ResourcesSharingAgreement {
    enum RsaState {
        Pending,
        Active
    }

    struct Rsa {
        address provider;
        address recipient;
        string recipientEmail;
        RsaState state;
        string duration;
        string[] sharedResources;
        bytes20[] observerAssignmentIds;
        bool secondOpinion;
        uint256 expiresAt;
        uint256 createdAt;
    }

    struct ObserverAssignment {
        bytes20 assignmentId;
        address observerAddress;
        string observerEmail;
        bool accepted;
        uint256 createdAt;
    }

    struct RsaInfo {
        bytes20 rsaId;
        address provider;
        address recipient;
        string recipientEmail;
        RsaState state;
        string duration;
        string[] sharedResources;
        ObserverAssignment[] observersAssignments;
        bool secondOpinion;
        uint256 expiresAt;
        uint256 createdAt;
    }

    mapping(bytes20 => Rsa) public rsas;
    mapping(address => bytes20[]) private providerRsas;
    mapping(address => bytes20[]) private recipientRsas;
    mapping(address => bytes20[]) private observerRsas;

    mapping(bytes20 => ObserverAssignment) private observerAssignments;

    IUtils public immutable utils;
    IRegistries public immutable registriesContract;
    IResourceCertification public immutable resourceCertificationContract;

    event RsaCreated(
        bytes20 indexed rsaId,
        address provider,
        address recipient,
        string recipientEmail,
        string duration,
        bool secondOpinion
    );
    event RsaCancelled(
        bytes20 indexed rsaId,
        address provider,
        address recipient
    );
    event RsaRejected(
        bytes20 indexed rsaId,
        address provider,
        address recipient
    );
    event RsaAccepted(
        bytes20 indexed rsaId,
        address provider,
        address recipient
    );
    event RsaRevoked(
        bytes20 indexed rsaId,
        address provider,
        address recipient,
        string recipientEmail,
        address caller
    );
    event ObserverAdded(
        bytes20 indexed rsaId,
        address provider,
        address recipient,
        address observer,
        string observerEmail,
        bytes20 assignmentId
    );
    event ObserverAccepted(
        bytes20 indexed rsaId,
        address provider,
        address recipient,
        address observer,
        bytes20 assignmentId
    );
    event ObserverRejected(
        bytes20 indexed rsaId,
        address provider,
        address recipient,
        address observer,
        bytes20 assignmentId
    );
    event ObserverRemoved(
        bytes20 indexed rsaId,
        address provider,
        address recipient,
        address observer,
        string observerEmail,
        address caller,
        bytes20 assignmentId
    );
    event ResourceAccessed(
        bytes20 indexed rsaId,
        string indexed resourceIdHash,
        address resourceOwner,
        string resourceId,
        address resourceAccessor,
        string resourceAccessorEmail,
        address caller
    );

    constructor(
        address _utilsContract,
        address _registriesContract,
        address _resourceCertificationContract
    ) {
        utils = IUtils(_utilsContract);
        registriesContract = IRegistries(_registriesContract);
        resourceCertificationContract = IResourceCertification(
            _resourceCertificationContract
        );
    }

    modifier onlyProvider(bytes20 _rsaId) {
        require(
            rsas[_rsaId].provider == msg.sender,
            "Caller is not the provider"
        );
        _;
    }

    modifier onlyRecipient(bytes20 _rsaId) {
        require(
            rsas[_rsaId].recipient == msg.sender,
            "Caller is not the recipient"
        );
        _;
    }

    modifier onlyActive(bytes20 _rsaId) {
        if (rsas[_rsaId].state != RsaState.Active) revert("Rsa is not active");
        _;
    }

    function _isObserver(
        bytes20 _rsaId,
        address _observer
    ) internal view returns (bool) {
        Rsa storage rsa = rsas[_rsaId];
        bytes20[] storage assignmentIds = rsa.observerAssignmentIds;

        for (uint256 i = 0; i < assignmentIds.length; i++) {
            ObserverAssignment storage assignment = observerAssignments[
                assignmentIds[i]
            ];
            if (assignment.observerAddress == _observer) {
                return true;
            }
        }
        return false;
    }

    function _isObserverEmail(
        bytes20 _rsaId,
        string memory _observerEmail
    ) internal view returns (bool) {
        Rsa storage rsa = rsas[_rsaId];
        bytes20[] storage assignmentIds = rsa.observerAssignmentIds;

        for (uint256 i = 0; i < assignmentIds.length; i++) {
            ObserverAssignment storage assignment = observerAssignments[
                assignmentIds[i]
            ];
            if (
                keccak256(bytes(assignment.observerEmail)) ==
                keccak256(bytes(_observerEmail))
            ) {
                return true;
            }
        }
        return false;
    }

    function _removeObserverAssignment(
        bytes20 _rsaId,
        bytes20 _assignmentId
    ) internal {
        Rsa storage rsa = rsas[_rsaId];
        bytes20[] storage assignmentIds = rsa.observerAssignmentIds;

        for (uint256 i = 0; i < assignmentIds.length; i++) {
            if (assignmentIds[i] == _assignmentId) {
                assignmentIds[i] = assignmentIds[assignmentIds.length - 1];
                assignmentIds.pop();
                delete observerAssignments[_assignmentId];
                break;
            }
        }
    }

    function _isSharedResource(
        Rsa storage rsa,
        string memory _resourceId
    ) internal view returns (bool) {
        for (uint256 i = 0; i < rsa.sharedResources.length; i++) {
            if (
                keccak256(bytes(rsa.sharedResources[i])) ==
                keccak256(bytes(_resourceId))
            ) {
                return true;
            }
        }
        return false;
    }

    function _removeRsaIdFromProvider(
        bytes20 _rsaId,
        address _provider
    ) internal {
        bytes20[] storage rsaIds = providerRsas[_provider];
        for (uint256 i = 0; i < rsaIds.length; i++) {
            if (rsaIds[i] == _rsaId) {
                rsaIds[i] = rsaIds[rsaIds.length - 1];
                rsaIds.pop();
                break;
            }
        }
    }

    function _removeRsaIdFromRecipient(
        bytes20 _rsaId,
        address _recipient
    ) internal {
        bytes20[] storage rsaIds = recipientRsas[_recipient];
        for (uint256 i = 0; i < rsaIds.length; i++) {
            if (rsaIds[i] == _rsaId) {
                rsaIds[i] = rsaIds[rsaIds.length - 1];
                rsaIds.pop();
                break;
            }
        }
    }

    function _removeRsaIdFromObserver(
        address _observer,
        bytes20 _rsaId
    ) internal {
        bytes20[] storage rsaIds = observerRsas[_observer];
        for (uint256 i = 0; i < rsaIds.length; i++) {
            if (rsaIds[i] == _rsaId) {
                rsaIds[i] = rsaIds[rsaIds.length - 1];
                rsaIds.pop();
                break;
            }
        }
    }

    function createRsa(
        address _recipient,
        string memory _recipientEmail,
        string memory _duration,
        bool _secondOpinion,
        string[] memory _sharedResources
    ) external {
        require(
            registriesContract.isPatient(msg.sender),
            "Caller is not a patient"
        );

        require(
            bytes(_recipientEmail).length > 0 || _recipient != address(0),
            "Either recipient address or email must be provided"
        );

        bytes20 rsaId;
        if (_recipient != address(0)) {
            require(
                registriesContract.isHealthcareProfessional(_recipient),
                "Recipient must be a healthcare professional"
            );
        }

        rsaId = utils.generateRsaId(msg.sender, _recipient, _recipientEmail);

        require(
            rsas[rsaId].provider == address(0),
            "Rsa already exists between these parties"
        );

        require(
            _sharedResources.length > 0,
            "At least one resource must be shared"
        );

        // Validate that all shared resources are owned by the provider
        for (uint256 i = 0; i < _sharedResources.length; i++) {
            (
                string memory certifiedResourceId,
                address subject,
                address issuer,
                uint256 issuedAt
            ) = resourceCertificationContract.verifyResource(_sharedResources[i]);

            require(bytes(certifiedResourceId).length > 0, "Invalid resource");
            require(issuer != address(0), "Invalid issuer");
            require(issuedAt <= block.timestamp, "Invalid certification timestamp");
            require(subject == msg.sender, "Resource not owned by provider");
        }

        RsaState initialState = bytes(_recipientEmail).length > 0 &&
            _recipient == address(0)
            ? RsaState.Active
            : RsaState.Pending;

        uint256 durationInSeconds = utils.getDurationInSeconds(_duration);
        uint256 expiresAt = (initialState == RsaState.Active)
            ? block.timestamp + durationInSeconds
            : 0;

        rsas[rsaId] = Rsa({
            provider: msg.sender,
            recipient: _recipient,
            recipientEmail: _recipientEmail,
            state: initialState,
            duration: _duration,
            sharedResources: _sharedResources,
            observerAssignmentIds: new bytes20[](0),
            secondOpinion: _secondOpinion,
            expiresAt: expiresAt,
            createdAt: block.timestamp
        });

        providerRsas[msg.sender].push(rsaId);

        if (_recipient != address(0)) {
            recipientRsas[_recipient].push(rsaId);
        }

        emit RsaCreated(
            rsaId,
            msg.sender,
            _recipient,
            _recipientEmail,
            _duration,
            _secondOpinion
        );
    }

    function cancelRsa(bytes20 _rsaId) external onlyProvider(_rsaId) {
        Rsa storage rsa = rsas[_rsaId];
        require(rsa.provider != address(0), "Invalid Rsa ID");

        require(rsa.state == RsaState.Pending, "Can only cancel a pending Rsa");

        address recipient = rsa.recipient;

        _removeRsaIdFromProvider(_rsaId, msg.sender);

        _removeRsaIdFromRecipient(_rsaId, recipient);

        delete rsas[_rsaId];

        emit RsaCancelled(_rsaId, msg.sender, recipient);
    }

    function rejectRsa(bytes20 _rsaId) external onlyRecipient(_rsaId) {
        Rsa storage rsa = rsas[_rsaId];
        require(rsa.provider != address(0), "Invalid Rsa ID");

        require(rsa.state == RsaState.Pending, "Can only reject a pending Rsa");

        address provider = rsa.provider;

        _removeRsaIdFromProvider(_rsaId, provider);

        _removeRsaIdFromRecipient(_rsaId, msg.sender);

        delete rsas[_rsaId];

        emit RsaRejected(_rsaId, provider, msg.sender);
    }

    function acceptRsa(bytes20 _rsaId) external onlyRecipient(_rsaId) {
        Rsa storage rsa = rsas[_rsaId];
        require(rsa.provider != address(0), "Invalid Rsa ID");

        require(rsa.state == RsaState.Pending, "Rsa is not pending");

        rsa.state = RsaState.Active;
        rsa.expiresAt =
            block.timestamp +
            utils.getDurationInSeconds(rsa.duration);

        emit RsaAccepted(_rsaId, rsa.provider, msg.sender);
    }

    function revokeRsa(bytes20 _rsaId) external {
        Rsa storage rsa = rsas[_rsaId];
        require(rsa.provider != address(0), "Invalid Rsa ID");

        require(
            msg.sender == rsa.provider || msg.sender == rsa.recipient,
            "Only provider or recipient can revoke Rsa"
        );

        address provider = rsa.provider;
        address recipient = rsa.recipient;
        string memory recipientEmail = rsa.recipientEmail;

        _removeRsaIdFromProvider(_rsaId, provider);

        if (recipient != address(0)) {
            _removeRsaIdFromRecipient(_rsaId, recipient);
        }

        bytes20[] memory assignmentIdsCopy = rsa.observerAssignmentIds;

        for (uint256 i = 0; i < assignmentIdsCopy.length; i++) {
            ObserverAssignment storage assignment = observerAssignments[
                assignmentIdsCopy[i]
            ];

            if (assignment.observerAddress != address(0)) {
                _removeRsaIdFromObserver(assignment.observerAddress, _rsaId);
            }

            _removeObserverAssignment(_rsaId, assignment.assignmentId);
        }

        delete rsa.observerAssignmentIds;

        delete rsas[_rsaId];

        emit RsaRevoked(
            _rsaId,
            provider,
            recipient,
            recipientEmail,
            msg.sender
        );
    }

    function createObserverAssignment(
        bytes20 _rsaId,
        address _observer,
        string memory _observerEmail
    ) external onlyRecipient(_rsaId) onlyActive(_rsaId) {
        Rsa storage rsa = rsas[_rsaId];

        require(rsa.secondOpinion, "Adding observers not allowed");

        require(
            _observer != address(0) || bytes(_observerEmail).length > 0,
            "Observer address or email must be provided"
        );

        if (_observer != address(0)) {
            require(
                registriesContract.isHealthcareProfessional(_observer),
                "Observer must be a healthcare professional"
            );
            require(!_isObserver(_rsaId, _observer), "Observer already added");
        } else {
            require(
                !_isObserverEmail(_rsaId, _observerEmail),
                "Observer email already added"
            );
        }

        bytes20 assignmentId = utils.generateAssignmentId(
            _rsaId,
            block.timestamp,
            block.number
        );

        bool isAccepted = (_observer == address(0));

        ObserverAssignment memory assignment = ObserverAssignment({
            assignmentId: assignmentId,
            observerAddress: _observer,
            observerEmail: _observerEmail,
            accepted: isAccepted,
            createdAt: block.timestamp
        });

        observerAssignments[assignmentId] = assignment;
        rsa.observerAssignmentIds.push(assignmentId);

        if (_observer != address(0)) {
            observerRsas[_observer].push(_rsaId);

            emit ObserverAdded(
                _rsaId,
                rsa.provider,
                rsa.recipient,
                _observer,
                "",
                assignmentId
            );
        } else {
            emit ObserverAdded(
                _rsaId,
                rsa.provider,
                rsa.recipient,
                address(0),
                _observerEmail,
                assignmentId
            );
        }
    }

    function acceptObserverAssignment(bytes20 _rsaId) external {
        Rsa storage rsa = rsas[_rsaId];
        require(rsa.provider != address(0), "Invalid Rsa ID");

        bytes20[] storage assignmentIds = rsa.observerAssignmentIds;
        bool isObserver = false;
        bytes20 targetAssignmentId = bytes20(0);

        for (uint256 i = 0; i < assignmentIds.length; i++) {
            ObserverAssignment storage assignment = observerAssignments[
                assignmentIds[i]
            ];
            if (assignment.observerAddress == msg.sender) {
                isObserver = true;
                targetAssignmentId = assignment.assignmentId;
                break;
            }
        }

        require(isObserver, "Caller is not an observer for this Rsa");

        ObserverAssignment storage targetAssignment = observerAssignments[
            targetAssignmentId
        ];

        require(!targetAssignment.accepted, "Assignment already accepted");

        targetAssignment.accepted = true;

        emit ObserverAccepted(
            _rsaId,
            rsa.provider,
            rsa.recipient,
            msg.sender,
            targetAssignmentId
        );
    }

    function rejectObserverAssignment(bytes20 _rsaId) external {
        Rsa storage rsa = rsas[_rsaId];
        require(rsa.provider != address(0), "Invalid Rsa ID");

        bytes20[] storage assignmentIds = rsa.observerAssignmentIds;
        bytes20 targetAssignmentId = bytes20(0);
        bool isObserver = false;

        for (uint256 i = 0; i < assignmentIds.length; i++) {
            ObserverAssignment storage assignment = observerAssignments[
                assignmentIds[i]
            ];
            if (assignment.observerAddress == msg.sender) {
                require(!assignment.accepted, "Observer already accepted");
                targetAssignmentId = assignment.assignmentId;
                isObserver = true;
                break;
            }
        }

        require(isObserver, "Caller is not an observer for this Rsa");

        _removeObserverAssignment(_rsaId, targetAssignmentId);
        _removeRsaIdFromObserver(msg.sender, _rsaId);

        emit ObserverRejected(
            _rsaId,
            rsa.provider,
            rsa.recipient,
            msg.sender,
            targetAssignmentId
        );
    }

    function removeObserverAssignment(
        bytes20 _rsaId,
        address _observer,
        string memory _observerEmail
    ) external {
        Rsa storage rsa = rsas[_rsaId];
        require(rsa.provider != address(0), "Invalid Rsa ID");

        require(
            _observer != address(0) || bytes(_observerEmail).length > 0,
            "Observer address or email must be provided"
        );

        bytes20[] storage assignmentIds = rsa.observerAssignmentIds;
        bytes20 targetAssignmentId = bytes20(0);
        bool observerFound = false;

        for (uint256 i = 0; i < assignmentIds.length; i++) {
            ObserverAssignment storage assignment = observerAssignments[
                assignmentIds[i]
            ];

            if (
                (_observer != address(0) &&
                    assignment.observerAddress == _observer) ||
                (bytes(_observerEmail).length > 0 &&
                    keccak256(bytes(assignment.observerEmail)) ==
                    keccak256(bytes(_observerEmail)))
            ) {
                targetAssignmentId = assignment.assignmentId;
                observerFound = true;

                // Validate caller permissions
                if (_observer != address(0)) {
                    require(
                        msg.sender == rsa.recipient ||
                            (msg.sender == _observer && assignment.accepted),
                        "Caller must be the recipient or the accepted observer themselves"
                    );
                } else {
                    require(
                        msg.sender == rsa.recipient,
                        "Only recipient can remove observer"
                    );
                }
                break;
            }
        }

        require(observerFound, "Observer not found");

        _removeObserverAssignment(_rsaId, targetAssignmentId);

        if (_observer != address(0)) {
            _removeRsaIdFromObserver(_observer, _rsaId);

            emit ObserverRemoved(
                _rsaId,
                rsa.provider,
                rsa.recipient,
                _observer,
                "",
                msg.sender,
                targetAssignmentId
            );
        } else {
            emit ObserverRemoved(
                _rsaId,
                rsa.provider,
                rsa.recipient,
                address(0),
                _observerEmail,
                msg.sender,
                targetAssignmentId
            );
        }
    }

    function authorizeAndLogAccess(
        bytes20 _rsaId,
        string memory _resourceId,
        address _resourceAccessor,
        string memory _resourceAccessorEmail
    ) external {
        require(
            registriesContract.isTrustedIssuer(msg.sender),
            "Caller is not a trusted issuer"
        );

        Rsa storage rsa = rsas[_rsaId];
        address resourceOwner = rsa.provider;
        require(resourceOwner != address(0), "Invalid Rsa ID");

        require(rsa.state == RsaState.Active, "Rsa is not active");

        if (rsa.expiresAt > 0) {
            require(block.timestamp <= rsa.expiresAt, "Rsa has expired");
        }

        require(
            _isSharedResource(rsa, _resourceId),
            "Resource ID not shared in this Rsa"
        );

        // Access Control
        if (_resourceAccessor == address(0)) {
            require(
                keccak256(bytes(rsa.recipientEmail)) ==
                    keccak256(bytes(_resourceAccessorEmail)) ||
                    _isObserverEmail(_rsaId, _resourceAccessorEmail),
                "Email does not match Rsa recipient email"
            );
        } else {
            require(
                _resourceAccessor == rsa.recipient ||
                    _isObserver(_rsaId, _resourceAccessor),
                "Accessor must be recipient or an observer"
            );
        }

        emit ResourceAccessed(
            _rsaId,
            _resourceId,
            resourceOwner,
            _resourceId,
            _resourceAccessor,
            _resourceAccessorEmail,
            msg.sender
        );
    }

    /* VIEW FUNCTIONS */

    function _getRsaInfo(
        bytes20 _rsaId,
        Rsa memory _rsa
    ) internal view returns (RsaInfo memory) {
        ObserverAssignment[]
            memory observersAssignments = new ObserverAssignment[](
                _rsa.observerAssignmentIds.length
            );

        for (uint256 i = 0; i < _rsa.observerAssignmentIds.length; i++) {
            bytes20 assignmentId = _rsa.observerAssignmentIds[i];
            observersAssignments[i] = observerAssignments[assignmentId];
        }
        return
            RsaInfo({
                rsaId: _rsaId,
                provider: _rsa.provider,
                recipient: _rsa.recipient,
                recipientEmail: _rsa.recipientEmail,
                state: _rsa.state,
                duration: _rsa.duration,
                sharedResources: _rsa.sharedResources,
                secondOpinion: _rsa.secondOpinion,
                expiresAt: _rsa.expiresAt,
                createdAt: _rsa.createdAt,
                observersAssignments: observersAssignments
            });
    }

    function getRsaInfo(bytes20 _rsaId) external view returns (RsaInfo memory) {
        Rsa storage rsa = rsas[_rsaId];
        return _getRsaInfo(_rsaId, rsa);
    }

    function getRsaById(bytes20 _rsaId) external view returns (RsaInfo memory) {
        return _getRsaInfo(_rsaId, rsas[_rsaId]);
    }

    function getRsaState(bytes20 _rsaId) external view returns (RsaState) {
        return rsas[_rsaId].state;
    }

    function getObserverAssignments(
        bytes20 _rsaId
    ) external view returns (ObserverAssignment[] memory) {
        Rsa storage rsa = rsas[_rsaId];
        bytes20[] storage assignmentIds = rsa.observerAssignmentIds;

        ObserverAssignment[] memory assignments = new ObserverAssignment[](
            assignmentIds.length
        );
        for (uint256 i = 0; i < assignmentIds.length; i++) {
            assignments[i] = observerAssignments[assignmentIds[i]];
        }

        return assignments;
    }

    function getProviderRsas(
        address _provider
    ) external view returns (bytes20[] memory) {
        return providerRsas[_provider];
    }

    function getRecipientRsas(
        address _recipient
    ) external view returns (bytes20[] memory) {
        return recipientRsas[_recipient];
    }

    function getObserverRsas(
        address _observer
    ) external view returns (bytes20[] memory) {
        return observerRsas[_observer];
    }
}
