// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract Registries {
    // Contract owner and health authority
    address public immutable owner;

    // Role mappings
    mapping(address => bool) public patients;
    mapping(address => bool) public healthcareProfessionals;
    mapping(address => bool) public trustedApplications;
    mapping(address => bool) public healthcareOrganizations;
    mapping(address => bool) public trustedIssuers;
    mapping(address => bool) public healthAuthorities;

    // Track who added who for removal control
    mapping(address => address) public addedByTrustedApplications;
    mapping(address => address) public addedByHealthcareOrgs;
    mapping(address => address) public addedByHealthAuthorities;

    // Modifiers to restrict actions to specific roles
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action.");
        _;
    }

    modifier onlyHealthAuthority() {
        require(
            healthAuthorities[msg.sender],
            "Only health authority can perform this action."
        );
        _;
    }

    modifier onlyHealthcareOrganization() {
        require(
            healthcareOrganizations[msg.sender],
            "Only healthcare organization can perform this action."
        );
        _;
    }

    modifier onlyTrustedApplication() {
        require(
            trustedApplications[msg.sender],
            "Only trusted application can perform this action."
        );
        _;
    }

    // Constructor to set the contract owner and first health authority
    constructor() {
        owner = msg.sender;
        healthAuthorities[msg.sender] = true; // Contract owner is the first health authority
    }

    // Utility functions to check roles
    function isHealthAuthority(address _addr) public view returns (bool) {
        return healthAuthorities[_addr];
    }

    function isHealthcareOrganization(
        address _addr
    ) public view returns (bool) {
        return healthcareOrganizations[_addr];
    }

    function isTrustedApplication(address _addr) public view returns (bool) {
        return trustedApplications[_addr];
    }

    function isPatient(address _addr) public view returns (bool) {
        return patients[_addr];
    }

    function isHealthcareProfessional(
        address _addr
    ) public view returns (bool) {
        return healthcareProfessionals[_addr];
    }

    function isTrustedIssuer(address _addr) public view returns (bool) {
        return trustedIssuers[_addr];
    }

    // Add functions for each role
    function addPatient(address _patient) public onlyTrustedApplication {
        patients[_patient] = true;
        addedByTrustedApplications[_patient] = msg.sender;
    }

    function addHealthcareProfessional(
        address _professional
    ) public onlyHealthcareOrganization {
        healthcareProfessionals[_professional] = true;
        addedByHealthcareOrgs[_professional] = msg.sender;
    }

    function addTrustedApplication(
        address _application
    ) public onlyHealthAuthority {
        trustedApplications[_application] = true;
        addedByHealthAuthorities[_application] = msg.sender;
    }

    function addHealthcareOrganization(
        address _organization
    ) public onlyHealthAuthority {
        healthcareOrganizations[_organization] = true;
        addedByHealthAuthorities[_organization] = msg.sender;
    }

    function addTrustedIssuer(address _issuer) public onlyHealthAuthority {
        trustedIssuers[_issuer] = true;
        addedByHealthAuthorities[_issuer] = msg.sender;
    }

    function addHealthAuthority(address _authority) public onlyOwner {
        healthAuthorities[_authority] = true;
    }

    // Remove functions for each role
    function removePatient(address _patient) public {
        require(
            addedByTrustedApplications[_patient] == msg.sender,
            "You can only remove patients added by you."
        );
        delete patients[_patient];
        delete addedByTrustedApplications[_patient];
    }

    function removeHealthcareProfessional(address _professional) public {
        require(
            addedByHealthcareOrgs[_professional] == msg.sender,
            "You can only remove professionals added by you."
        );
        delete healthcareProfessionals[_professional];
        delete addedByHealthcareOrgs[_professional];
    }

    function removeTrustedApplication(
        address _application
    ) public onlyHealthAuthority {
        require(
            addedByHealthAuthorities[_application] == msg.sender,
            "You can only remove applications added by you."
        );
        delete trustedApplications[_application];
        delete addedByHealthAuthorities[_application];
    }

    function removeHealthcareOrganization(
        address _organization
    ) public onlyHealthAuthority {
        require(
            addedByHealthAuthorities[_organization] == msg.sender,
            "You can only remove organizations added by you."
        );
        delete healthcareOrganizations[_organization];
        delete addedByHealthAuthorities[_organization];
    }

    function removeTrustedIssuer(address _issuer) public onlyHealthAuthority {
        require(
            addedByHealthAuthorities[_issuer] == msg.sender,
            "You can only remove issuers added by you."
        );
        delete trustedIssuers[_issuer];
        delete addedByHealthAuthorities[_issuer];
    }

    function removeHealthAuthority(address _authority) public onlyOwner {
        delete healthAuthorities[_authority];
    }
}
