// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

library VCEMSecurity {
    function recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "VCEM: bad signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "VCEM: bad signature v");
        require(
            uint256(s) <= 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
            "VCEM: bad signature s"
        );
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "VCEM: invalid signature");
        return signer;
    }

    function domainSeparator(string memory name, string memory version, address verifyingContract) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                block.chainid,
                verifyingContract
            )
        );
    }

    function typedDataHash(bytes32 domain, bytes32 structHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
    }
}
