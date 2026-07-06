// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface IUtils {
    function generateHash(string memory input) external pure returns (bytes32);
}

interface IDataSharingAgreement {
    enum DsaState {
        Pending,
        Active
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

    function getDsaInfo(bytes20 _dsaId) external view returns (DsaInfo memory);

    function getDsaState(bytes20 _dsaId) external view returns (DsaState);

    function getProviderDsas(
        address _provider
    ) external view returns (bytes20[] memory);

    function getRecipientDsas(
        address _recipient
    ) external view returns (bytes20[] memory);
}

contract DsaEnumerator {
    IUtils public immutable utils;
    IDataSharingAgreement private immutable dsaContract;

    constructor(address _utilsContract, address _dsaContract) {
        utils = IUtils(_utilsContract);
        dsaContract = IDataSharingAgreement(_dsaContract);
    }

    function _getStateFromString(
        string memory _stateFilter
    ) private view returns (IDataSharingAgreement.DsaState, bool) {
        if (utils.generateHash(_stateFilter) == utils.generateHash("ALL")) {
            return (IDataSharingAgreement.DsaState.Pending, false);
        } else if (
            utils.generateHash(_stateFilter) == utils.generateHash("ACTIVE")
        ) {
            return (IDataSharingAgreement.DsaState.Active, true);
        } else if (
            utils.generateHash(_stateFilter) == utils.generateHash("PENDING")
        ) {
            return (IDataSharingAgreement.DsaState.Pending, true);
        } else {
            revert("Invalid state filter");
        }
    }

    function getProviderDsaCount(
        address _provider,
        string memory _stateFilter
    ) external view returns (uint256) {
        (
            IDataSharingAgreement.DsaState targetState,
            bool applyFilter
        ) = _getStateFromString(_stateFilter);

        uint256 count = 0;
        bytes20[] memory dsaIds = dsaContract.getProviderDsas(_provider);

        for (uint256 i = 0; i < dsaIds.length; i++) {
            if (
                !applyFilter ||
                dsaContract.getDsaState(dsaIds[i]) == targetState
            ) {
                count++;
            }
        }
        return count;
    }

    function getDsasByProvider(
        address _provider,
        string memory _stateFilter,
        uint256 _offset,
        uint256 _limit
    ) external view returns (IDataSharingAgreement.DsaInfo[] memory) {
        (
            IDataSharingAgreement.DsaState targetState,
            bool applyFilter
        ) = _getStateFromString(_stateFilter);
        bytes20[] memory dsaIds = dsaContract.getProviderDsas(_provider);
        uint256 resultCount = 0;

        for (
            uint256 i = _offset;
            i < dsaIds.length && resultCount < _limit;
            i++
        ) {
            if (
                !applyFilter ||
                dsaContract.getDsaState(dsaIds[i]) == targetState
            ) {
                resultCount++;
            }
        }

        IDataSharingAgreement.DsaInfo[]
            memory result = new IDataSharingAgreement.DsaInfo[](resultCount);
        uint256 index = 0;

        for (
            uint256 i = _offset;
            i < dsaIds.length && index < resultCount;
            i++
        ) {
            if (
                !applyFilter ||
                dsaContract.getDsaState(dsaIds[i]) == targetState
            ) {
                result[index] = dsaContract.getDsaInfo(dsaIds[i]);
                index++;
            }
        }

        return result;
    }

    function getRecipientDsaCount(
        address _recipient,
        string memory _stateFilter
    ) external view returns (uint256) {
        (
            IDataSharingAgreement.DsaState targetState,
            bool applyFilter
        ) = _getStateFromString(_stateFilter);

        bytes20[] memory dsaIds = dsaContract.getRecipientDsas(_recipient);

        uint256 count = 0;
        for (uint256 i = 0; i < dsaIds.length; i++) {
            if (
                !applyFilter ||
                dsaContract.getDsaState(dsaIds[i]) == targetState
            ) {
                count++;
            }
        }

        return count;
    }

    function getDsasByRecipient(
        address _recipient,
        string memory _stateFilter,
        uint256 _offset,
        uint256 _limit
    ) external view returns (IDataSharingAgreement.DsaInfo[] memory) {
        (
            IDataSharingAgreement.DsaState targetState,
            bool applyFilter
        ) = _getStateFromString(_stateFilter);

        bytes20[] memory dsaIds = dsaContract.getRecipientDsas(_recipient);

        uint256 resultCount = 0;
        for (uint256 i = 0; i < dsaIds.length; i++) {
            if (
                !applyFilter ||
                dsaContract.getDsaState(dsaIds[i]) == targetState
            ) {
                resultCount++;
            }
        }

        uint256 start = _offset;
        uint256 end = start + _limit > resultCount
            ? resultCount
            : start + _limit;

        IDataSharingAgreement.DsaInfo[]
            memory result = new IDataSharingAgreement.DsaInfo[](end - start);
        uint256 index = 0;

        for (uint256 i = 0; i < dsaIds.length && index < end - start; i++) {
            if (
                !applyFilter ||
                dsaContract.getDsaState(dsaIds[i]) == targetState
            ) {
                if (index >= start) {
                    result[index] = dsaContract.getDsaInfo(dsaIds[i]);
                }
                index++;
            }
        }

        return result;
    }
}
