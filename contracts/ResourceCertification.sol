// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IRegistries {
    function isTrustedIssuer(address _issuer) external view returns (bool);
}

contract ResourceCertification {
    struct Certificate {
        string resourceId;
        address subject;
        address issuer;
        uint256 issuedAt;
    }

    // Reference to the Registries contract for access control
    IRegistries public immutable registriesContract;

    // Array of certificates
    Certificate[] public certificates;

    // Mapping to keep track of the index of each certificate by resourceId
    mapping(string => uint256) private certificateIndexById;

    // Mapping to track which issuer created which certificate
    mapping(string => address) private certificateIssuer;
    mapping(string => bool) private certificateExists;

    // Event for resource certification
    event ResourceCertified(
        string indexed resourceIdHash,
        string resourceId,
        address subject,
        address issuer,
        uint256 issuedAt
    );
    event CertificateRemoved(string resourceId, address indexed issuer);

    // Constructor to set the Registries contract address
    constructor(address _registriesContractAddress) {
        registriesContract = IRegistries(_registriesContractAddress);
    }

    // Function to certify a resource (only callable by a trusted issuer)
    function certifyResource(
        string memory _resourceId,
        address _subject
    ) external {
        require(
            registriesContract.isTrustedIssuer(msg.sender),
            "Caller is not a trusted issuer"
        );

        // Create a certificate and store it
        certificates.push(
            Certificate({
                resourceId: _resourceId,
                subject: _subject,
                issuer: msg.sender,
                issuedAt: block.timestamp
            })
        );

        // Store the index and issuer of the certificate for future reference
        certificateIndexById[_resourceId] = certificates.length - 1;
        certificateIssuer[_resourceId] = msg.sender;
        certificateExists[_resourceId] = true;

        // Emit an event
        emit ResourceCertified(
            _resourceId,
            _resourceId,
            _subject,
            msg.sender,
            block.timestamp
        );
    }

    // Function to remove a certificate (only callable by the issuer of the certificate)
    function removeCertificate(string memory _resourceId) external {
        require(
            certificateIssuer[_resourceId] == msg.sender,
            "Caller did not issue this certificate"
        );

        // Find the index of the certificate to remove
        uint256 indexToRemove = certificateIndexById[_resourceId];

        // Get the last index in the array to move the last element into the removed slot
        uint256 lastIndex = certificates.length - 1;

        if (indexToRemove != lastIndex) {
            // Move the last certificate to the position of the one to be removed
            certificates[indexToRemove] = certificates[lastIndex];
            certificateIndexById[
                certificates[lastIndex].resourceId
            ] = indexToRemove;
        }

        // Remove the last element and update mappings
        certificates.pop();
        delete certificateIndexById[_resourceId];
        delete certificateIssuer[_resourceId];
        delete certificateExists[_resourceId];

        // Emit an event for the removal
        emit CertificateRemoved(_resourceId, msg.sender);
    }

    // Function to verify a resource by its ID and return its certificate
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
        )
    {
        require(certificateExists[_resourceId], "Resource not certified");
        uint256 index = certificateIndexById[_resourceId];
        require(index < certificates.length, "Resource not certified");

        Certificate memory certificate = certificates[index];
        return (
            certificate.resourceId,
            certificate.subject,
            certificate.issuer,
            certificate.issuedAt
        );
    }
}
