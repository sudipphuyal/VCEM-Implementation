# VCEM Benchmark Report

Status: executed
Timestamp: 2026-07-05T20:17:03.302Z
Git commit: 6077d27a9eca686e5395e8e081bbbf588b824a0b
Host: darwin 25.5.0 arm64, 11 CPUs, 19327352832 bytes RAM
Deployment manifest: /Users/sudipphuyal/Developments/zkp-with-snarkjs/deployments/vcem-manifest.json

## Deployment Manifest

```json
{
  "chainId": "20260703",
  "networkName": "vcem-besu-local",
  "consensus": "IBFT 2.0",
  "blockPeriodSeconds": 2,
  "validatorAddresses": [
    "0x3ca30eeC09411232b6F7E378C74Dd940a7443f92",
    "0x9EFCe7C38B58604575559080476e89b426D8Ea11",
    "0x4825CfF306b3a0F67B2ABC71447262328bA8F5EF",
    "0x70f8360D62Daf704888d8081558CB4a0be12eFaf"
  ],
  "topology": {
    "validators": [
      {
        "name": "validator1",
        "address": "0x3ca30eeC09411232b6F7E378C74Dd940a7443f92",
        "enode": "enode://7449a730a37a471801f2a76e8ab770ecdcb9a492b4968bf683a2655cab282b9e2e7cd8ce70c3357162247135a87cc609112d4a680ef2a6c0fe100594efefd42a@172.28.0.11:30303",
        "ip": "172.28.0.11"
      },
      {
        "name": "validator2",
        "address": "0x9EFCe7C38B58604575559080476e89b426D8Ea11",
        "enode": "enode://0f548ca3e98ff875443f3c197afc931f12a734e3ea151a251454dcd20e783a8915a6eeda32eff5a91336b0615da673b2fd30d6ef427f4ccca151e7a108a05265@172.28.0.12:30303",
        "ip": "172.28.0.12"
      },
      {
        "name": "validator3",
        "address": "0x4825CfF306b3a0F67B2ABC71447262328bA8F5EF",
        "enode": "enode://5ad04880acb6eef72459b043a5962c3f591412b1815a19ea5b9c26f641c6fcb4a38110aaf1b82f5c0a3ff2a1fbd8ab19f0035350bce06ba4e2ceb455795f4abf@172.28.0.13:30303",
        "ip": "172.28.0.13"
      },
      {
        "name": "validator4",
        "address": "0x70f8360D62Daf704888d8081558CB4a0be12eFaf",
        "enode": "enode://821cf69addfaec13be4b217cd1f1ead7012914ff16b9a0bfc7557db8ad1dd98585297e2c20f84920b13ea61e311425fd8239ace9b7b1d21d2a83207db8107aa7@172.28.0.14:30303",
        "ip": "172.28.0.14"
      }
    ],
    "rpc": [
      {
        "name": "rpc",
        "address": "0xD3eb80C5540Dc18976a5ba9b69F2824612505c99",
        "enode": "enode://1dc243a9e8151bf286b77ab7f4e473186dd490599b2f349ac5b418f4893e055720a70c1aab174a7f63762bac792c79db52ab41a3996f0dc5c649ffe52bc9c67a@172.28.0.15:30303",
        "ip": "172.28.0.15"
      }
    ]
  },
  "addresses": {
    "VCEMRegistry": "0x07318D43d8E7B129016ae895BA2C3D4B38AB6164",
    "VCEMConsent": "0x4CC050117F572E3CF92A20f6D99924B6b85D2e68",
    "VCEMAudit": "0x6ccf8567830024aAD2621eef08ecfc652c0FB2C2"
  },
  "deploymentTransactions": {
    "VCEMRegistry": "0x59102b906a7c5963a6b07072b45752c1182b2b897e53e0bf1f4a02ce6c9ec17c",
    "VCEMConsent": "0x3192344d8362615ae6f2a4eeda1af9aa3584afe974cf5e519ace7d313d625908",
    "VCEMAudit": "0xe5c445d29925346802b739eebc0203e20725c33ebf23379fad38aa3bd35d0082"
  },
  "abiVersion": "vcem-v1",
  "localRuntimeBytecodeHashes": {
    "VCEMRegistry": "0x0ae4ca0ea97be66b21afd1f7887b3df97f06c6fedeffdbb5e3aeda40cd66998a",
    "VCEMConsent": "0xa0baf68c826b93168b2192f7c30883359ad5fc7f00fd907bdb18cfbe3760a11d",
    "VCEMAudit": "0x2e3ffa3dcaaf7c932101a45e27a1933fa27281faf990fcafefc8fdae50a2cb38"
  },
  "deployedRuntimeBytecodeHashes": {
    "VCEMRegistry": "0x0ae4ca0ea97be66b21afd1f7887b3df97f06c6fedeffdbb5e3aeda40cd66998a",
    "VCEMConsent": "0xa12d6bdd7a5629644e1f049fb74cf3b9cd49e941a94b5328db7a00e93c2c1536",
    "VCEMAudit": "0x6f2c2620165c379c3e98d72d440c90f0627055ca44fd7b47dd3997039bc25bbf"
  },
  "deploymentTimestamp": "2026-07-05T18:55:17.498Z",
  "gitCommit": "6077d27a9eca686e5395e8e081bbbf588b824a0b"
}
```

## Raw Artifact Paths

- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/100u/run-1
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/100u/run-2
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/100u/run-3
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/100u/run-4
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/100u/run-5
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/10u/run-1
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/10u/run-2
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/10u/run-3
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/10u/run-4
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/10u/run-5
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/25u/run-1
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/25u/run-2
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/25u/run-3
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/25u/run-4
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/25u/run-5
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/50u/run-1
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/50u/run-2
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/50u/run-3
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/50u/run-4
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/50u/run-5
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/75u/run-1
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/75u/run-2
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/75u/run-3
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/75u/run-4
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/baseline/75u/run-5
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/100u/run-1
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/100u/run-2
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/100u/run-3
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/100u/run-4
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/100u/run-5
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/10u/run-1
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/10u/run-2
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/10u/run-3
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/10u/run-4
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/10u/run-5
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/25u/run-1
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/25u/run-2
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/25u/run-3
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/25u/run-4
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/25u/run-5
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/50u/run-1
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/50u/run-2
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/50u/run-3
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/50u/run-4
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/50u/run-5
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/75u/run-1
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/75u/run-2
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/75u/run-3
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/75u/run-4
- /Users/sudipphuyal/Developments/zkp-with-snarkjs/benchmarks/raw/vcem/75u/run-5

## Aggregate Metrics

| mode | users | metric | status | executed runs | failed runs | not executed | mean | SD | p50 | p95 | 95% CI |
|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| baseline | 100 | baseline_latency_ms | partial | 2/5 | 3 | 0 | 93.236 | 78.551 | 12.000 | 568.950 | 108.867 |
| baseline | 100 | http_req_duration | partial | 2/5 | 3 | 0 | 82.408 | 68.824 | 3.771 | 515.491 | 95.385 |
| baseline | 100 | http_reqs | partial | 2/5 | 3 | 0 | 90.658 | 7.461 | 0.000 | 0.000 | 10.340 |
| baseline | 100 | http_req_failed | partial | 2/5 | 3 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 100 | baseline_release_rate | partial | 2/5 | 3 | 0 | 1.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 100 | baseline_denial_rate | partial | 2/5 | 3 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 10 | baseline_latency_ms | executed | 5/5 | 0 | 0 | 4.993 | 0.753 | 4.000 | 11.010 | 0.660 |
| baseline | 10 | http_req_duration | executed | 5/5 | 0 | 0 | 4.645 | 0.634 | 3.737 | 10.589 | 0.556 |
| baseline | 10 | http_reqs | executed | 5/5 | 0 | 0 | 9.945 | 0.009 | 0.000 | 0.000 | 0.008 |
| baseline | 10 | http_req_failed | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 10 | baseline_release_rate | executed | 5/5 | 0 | 0 | 1.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 10 | baseline_denial_rate | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 25 | baseline_latency_ms | executed | 5/5 | 0 | 0 | 5.832 | 0.654 | 4.600 | 12.910 | 0.574 |
| baseline | 25 | http_req_duration | executed | 5/5 | 0 | 0 | 5.472 | 0.648 | 4.341 | 12.344 | 0.568 |
| baseline | 25 | http_reqs | executed | 5/5 | 0 | 0 | 24.833 | 0.020 | 0.000 | 0.000 | 0.018 |
| baseline | 25 | http_req_failed | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 25 | baseline_release_rate | executed | 5/5 | 0 | 0 | 1.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 25 | baseline_denial_rate | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 50 | baseline_latency_ms | executed | 5/5 | 0 | 0 | 6.900 | 0.458 | 5.200 | 16.410 | 0.401 |
| baseline | 50 | http_req_duration | executed | 5/5 | 0 | 0 | 6.463 | 0.464 | 4.639 | 15.749 | 0.407 |
| baseline | 50 | http_reqs | executed | 5/5 | 0 | 0 | 49.628 | 0.020 | 0.000 | 0.000 | 0.018 |
| baseline | 50 | http_req_failed | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 50 | baseline_release_rate | executed | 5/5 | 0 | 0 | 1.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 50 | baseline_denial_rate | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 75 | baseline_latency_ms | executed | 5/5 | 0 | 0 | 12.851 | 11.064 | 4.400 | 30.800 | 9.698 |
| baseline | 75 | http_req_duration | executed | 5/5 | 0 | 0 | 11.990 | 10.491 | 3.670 | 29.038 | 9.196 |
| baseline | 75 | http_reqs | executed | 5/5 | 0 | 0 | 73.957 | 0.858 | 0.000 | 0.000 | 0.752 |
| baseline | 75 | http_req_failed | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 75 | baseline_release_rate | executed | 5/5 | 0 | 0 | 1.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| baseline | 75 | baseline_denial_rate | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 100 | vcem_app_latency_ms | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 100 | vcem_tx_confirmation_ms | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 100 | http_req_duration | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 100 | http_reqs | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 100 | http_req_failed | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 100 | vcem_proxy_release_rate | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 100 | vcem_proxy_denial_rate | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 100 | vcem_rpc_failure_rate | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 10 | vcem_app_latency_ms | executed | 5/5 | 0 | 0 | 4344.011 | 6.267 | 4343.800 | 4369.600 | 5.493 |
| vcem | 10 | vcem_tx_confirmation_ms | executed | 5/5 | 0 | 0 | 4248.458 | 4.743 | 4249.000 | 4268.200 | 4.158 |
| vcem | 10 | http_req_duration | executed | 5/5 | 0 | 0 | 2171.700 | 3.130 | 2166.796 | 4264.263 | 2.744 |
| vcem | 10 | http_reqs | executed | 5/5 | 0 | 0 | 3.742 | 0.005 | 0.000 | 0.000 | 0.004 |
| vcem | 10 | http_req_failed | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 10 | vcem_proxy_release_rate | executed | 5/5 | 0 | 0 | 1.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 10 | vcem_proxy_denial_rate | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 10 | vcem_rpc_failure_rate | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 25 | vcem_app_latency_ms | executed | 5/5 | 0 | 0 | 4424.257 | 93.043 | 4387.200 | 5079.350 | 81.556 |
| vcem | 25 | vcem_tx_confirmation_ms | executed | 5/5 | 0 | 0 | 4318.224 | 84.121 | 4284.200 | 4969.400 | 73.735 |
| vcem | 25 | http_req_duration | executed | 5/5 | 0 | 0 | 2211.395 | 46.077 | 1413.310 | 4359.879 | 40.388 |
| vcem | 25 | http_reqs | executed | 5/5 | 0 | 0 | 9.200 | 0.180 | 0.000 | 0.000 | 0.158 |
| vcem | 25 | http_req_failed | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 25 | vcem_proxy_release_rate | executed | 5/5 | 0 | 0 | 1.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 25 | vcem_proxy_denial_rate | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 25 | vcem_rpc_failure_rate | executed | 5/5 | 0 | 0 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 50 | vcem_app_latency_ms | failed | 0/5 | 4 | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 50 | vcem_tx_confirmation_ms | failed | 0/5 | 4 | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 50 | http_req_duration | failed | 0/5 | 4 | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 50 | http_reqs | failed | 0/5 | 4 | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 50 | http_req_failed | failed | 0/5 | 4 | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 50 | vcem_proxy_release_rate | failed | 0/5 | 4 | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 50 | vcem_proxy_denial_rate | failed | 0/5 | 4 | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 50 | vcem_rpc_failure_rate | failed | 0/5 | 4 | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 75 | vcem_app_latency_ms | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 75 | vcem_tx_confirmation_ms | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 75 | http_req_duration | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 75 | http_reqs | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 75 | http_req_failed | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 75 | vcem_proxy_release_rate | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 75 | vcem_proxy_denial_rate | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| vcem | 75 | vcem_rpc_failure_rate | not executed | 0/5 | 0 | 5 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |

## Baseline Comparison

Compare `baseline_latency_ms` and `vcem_app_latency_ms` for end-to-end latency, and `http_reqs` / `http_req_failed` for throughput and error behavior. Missing rows mean the corresponding benchmark was not executed.

## Resource Summary

## Notes

No paper performance figures are claimed by this report unless the corresponding raw run directories show `status: executed`.
Rows with `partial`, `failed`, or `not executed` status are diagnostic only unless the manuscript explicitly describes the incomplete run set and excludes failed repetitions from statistical claims.