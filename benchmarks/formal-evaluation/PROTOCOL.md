# VCEM Formal Performance Evaluation Protocol

Protocol date: 2026-08-09
Purpose: revised formal implementation and experimental evaluation following Reviewer 2 performance and bottleneck concerns.

## Experimental systems

1. VCEM implementation on a five-node Hyperledger Besu IBFT 2.0 logical network: four validators and one non-validator RPC node.
2. PostgreSQL reference implementation using PostgreSQL 15.2.
3. Both systems execute on the same physical Apple Silicon host.
4. PostgreSQL and VCEM application paths use the same pg-pool default maximum of 10 database connections.
5. Besu tx-pool-max-future-by-sender is fixed at 800 for every formal VCEM repetition.
6. The value 800 is a revised experimental configuration and must not be described as the configuration of the earlier evaluation.

## Load levels and repetitions

Concurrent virtual users: 10, 25, 50, 75, 100, 125, 150, 175, 200.
Independent repetitions: 5 per load level per system.
Total planned formal runs: 90.
Execution order: 10, 25, 50, 75, 100, 125, 150, 175, and 200 VUs.
Within each VU level, execute PostgreSQL repetitions 1-5 followed by VCEM repetitions 1-5.
Warm-up period: 60 seconds.
Measurement period: 300 seconds.
Think time: 1 second per completed workflow iteration.

## Experimental independence and state reset

1. Every PostgreSQL repetition begins from a freshly recreated baseline schema and delivery ledger.
2. Every VCEM repetition begins from the same fixed pre-benchmark Besu network snapshot.
3. A fresh VCEM request fixture is generated after restoration of the fixed network snapshot.
4. Each fixture contains 75000 unique request identifiers unless a larger explicitly recorded value is required.
5. The fixture used by every repetition is preserved and SHA-256 hashed.
6. Failed runs are preserved and never silently overwritten.
7. Runs invalidated by external interruption, host sleep, or instrumentation failure are retained as invalid evidence and any replacement run is explicitly identified.

## Pre-run acceptance conditions

1. Host swap usage must be zero before a formal repetition starts.
2. If non-zero swap is detected after a repetition, the host must be rebooted before the next repetition.
3. Preliminary diagnostics showed substantial memory pressure at high VCEM loads; therefore, a reboot is planned before each VCEM repetition at 150, 175, and 200 VUs.
4. At 125 VUs and below, a reboot is required whenever the zero-swap precondition is not satisfied.
5. Rebooting does not change the logical experimental starting state because the same frozen formal Besu snapshot is restored before every VCEM repetition.
6. PostgreSQL must pass pg_isready for both experimental arms that use PostgreSQL.
7. For VCEM, all five Besu nodes must be running and the validator set must match the fixed formal network.
8. For VCEM, RPC transaction-pool occupancy must be zero before workload execution.
9. The deployed VCEM contract addresses and runtime bytecode hashes must match the frozen formal deployment manifest.

## Measurement-window rules

1. The first 60 seconds are warm-up and are excluded from reported formal latency and throughput statistics.
2. Custom latency metrics are recorded only for workflows completing during the 300-second measurement window.
3. Warm-up HTTP traffic remains available as diagnostic evidence but is not included in the primary reported performance metrics.

## Primary metrics

1. Completed workflow throughput = successful workflows completed during the measurement window divided by 300 seconds.
2. End-to-end application latency: baseline_latency_ms for PostgreSQL and vcem_app_latency_ms for VCEM.
3. VCEM transaction-confirmation latency: vcem_tx_confirmation_ms.
4. Failure behavior: workflow failures, HTTP failures, authorization failures, release failures, reverts, transaction wait errors, and timeouts.
5. Raw http_reqs/s is not used for PostgreSQL-versus-VCEM throughput comparison because VCEM uses two successful HTTP calls per workflow whereas the PostgreSQL reference uses one.

## VCEM bottleneck telemetry

Each VCEM formal repetition records:
- relay outstanding queue depth and queue-wait time;
- nonce allocation and nonce retry/submission failures;
- locally submitted, RPC-returned, mined, reverted, errored, and timed-out transaction events;
- RPC request counts and processing time;
- transaction-pool occupancy and rejection counters;
- sampled block transaction count and gas usage;
- validator IBFT executor queues and rejected tasks;
- Proposal, Prepare, Commit, and RoundChange P2P message counters;
- Docker CPU and memory per Besu container;
- Docker network and block-I/O counters;
- PostgreSQL container CPU, memory, network, and block-I/O;
- host swap state.

## Statistical analysis

1. The independent experimental unit is one complete repetition, not an individual request.
2. For each system and load level, report the mean and sample standard deviation across the five valid repetitions.
3. Report a two-sided 95 percent confidence interval for the run-level mean using the Student t distribution.
4. For five valid repetitions, the t critical value is 2.776 with four degrees of freedom.
5. Report run-level median and p95 latency and summarize these consistently across repetitions.
6. Do not treat thousands of requests within one repetition as independent statistical replicates.

## Interpretation boundaries

1. The experiment characterizes the implemented VCEM architecture and configured experimental deployment.
2. Successful execution at 200 VUs does not by itself establish production readiness.
3. The experiment does not claim the maximum capacity of IBFT 2.0.
4. Co-location of Besu validators, RPC node, APIs, PostgreSQL, and k6 on one host remains an experimental limitation.
5. Operational adequacy is not claimed without an application-specific arrival-rate or workload requirement.
