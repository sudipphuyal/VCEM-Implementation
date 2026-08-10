import childProcess from "child_process";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

const repoRoot = path.resolve(__dirname, "../..");
const evaluatedCommit = "6077d27a9eca686e5395e8e081bbbf588b824a0b";
const evaluatedRoot = process.env.VCEM_EVALUATED_ROOT || "/private/tmp/vcem-evaluated-6077d27a9eca686e5395e8e081bbbf588b824a0b";
const artifactRoot = process.env.VCEM_ARTIFACT_ROOT || path.join(evaluatedRoot, "artifacts");
const rpcUrl = process.env.BESU_NETWORK_URL || "http://127.0.0.1:8545";
const generatedRoot = process.env.BESU_GENERATED_ROOT || path.join(repoRoot, "infrastructure", "besu", "generated");
const reportRoot = path.join(repoRoot, "reports", "temporal-semantics");
const rawRoot = path.join(reportRoot, "raw");
const trials = Number(process.env.VCEM_TEMPORAL_TRIALS || "20");
const confirmations = Number(process.env.VCEM_TEMPORAL_CONFIRMATIONS || "1");
const Role = { PARTICIPANT: 2, RESEARCHER: 3, DATA_CUSTODIAN: 4, POLICY_GATEWAY: 5 };
const Purpose = { RESEARCH: 2 };

type Artifact = { abi: any[]; bytecode: string; deployedBytecode: string };
type ConnectedWallet = ethers.Wallet | ethers.HDNodeWallet;

function digest(label: string) {
  return ethers.sha256(ethers.toUtf8Bytes(label));
}

function actorId(label: string) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

function readArtifact(name: string): Artifact {
  const artifactPath = path.join(artifactRoot, "contracts", "vcem", `${name}.sol`, `${name}.json`);
  if (!fs.existsSync(artifactPath)) throw new Error(`missing evaluated artifact ${artifactPath}`);
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

function readDeployerKey() {
  const keyPath = path.join(generatedRoot, "deployer.key");
  if (!fs.existsSync(keyPath)) throw new Error(`missing Besu deployer key ${keyPath}`);
  return `0x${fs.readFileSync(keyPath, "utf8").trim().replace(/^0x/, "")}`;
}

function normalizeReason(error: any) {
  const text = String(error?.shortMessage || error?.reason || error?.message || error);
  const match = text.match(/VCEMAudit: [A-Za-z ]+/);
  return match?.[0].trim() || text;
}

async function legacyOverrides(provider: ethers.JsonRpcProvider, signer: ConnectedWallet) {
  return { type: 0, gasPrice: 1n, gasLimit: 3_000_000n, nonce: await provider.getTransactionCount(signer.address, "pending") };
}

async function sendAndWait(contract: ethers.Contract, signer: ConnectedWallet, method: string, args: any[]) {
  const tx = await (contract.connect(signer) as any)[method](...args, await legacyOverrides(signer.provider as ethers.JsonRpcProvider, signer));
  const receipt = await tx.wait(confirmations);
  if (!receipt || receipt.status !== 1) throw new Error(`${method} failed: ${tx.hash}`);
  return { tx, receipt };
}

async function deploy(name: string, signer: ConnectedWallet, args: any[] = []) {
  const artifact = readArtifact(name);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const deployment = await factory.getDeployTransaction(...args);
  const tx = await signer.sendTransaction({ ...deployment, ...(await legacyOverrides(signer.provider as ethers.JsonRpcProvider, signer)), gasLimit: 8_000_000n });
  const receipt = await tx.wait(confirmations);
  if (!receipt?.contractAddress || receipt.status !== 1) throw new Error(`${name} deployment failed`);
  return { contract: new ethers.Contract(receipt.contractAddress, artifact.abi, signer), receipt, artifact };
}

async function fund(admin: ConnectedWallet, wallet: ConnectedWallet) {
  const tx = await admin.sendTransaction({ to: wallet.address, value: ethers.parseEther("2"), ...(await legacyOverrides(admin.provider as ethers.JsonRpcProvider, admin)) });
  await tx.wait(confirmations);
}

async function signRequest(audit: ethers.Contract, signer: ConnectedWallet, chainId: bigint, request: any) {
  return signer.signTypedData(
    { name: "VCEMAudit", version: "1", chainId, verifyingContract: await audit.getAddress() },
    {
      AccessRequest: [
        { name: "participantId", type: "bytes32" },
        { name: "requestorId", type: "bytes32" },
        { name: "dataHash", type: "bytes32" },
        { name: "scopeHash", type: "bytes32" },
        { name: "requestedPurpose", type: "uint8" },
        { name: "requestId", type: "bytes32" },
        { name: "clientTimestamp", type: "uint64" },
        { name: "requestExpiry", type: "uint64" },
        { name: "expectedConsentHash", type: "bytes32" },
      ],
    },
    request
  );
}

function percentile95(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

function statistics(values: number[]) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length / 2;
  return {
    n: values.length,
    values,
    meanMs: mean,
    sampleStandardDeviationMs: Math.sqrt(variance),
    medianMs: (sorted[middle - 1] + sorted[middle]) / 2,
    minimumMs: sorted[0],
    maximumMs: sorted[sorted.length - 1],
    p95Ms: percentile95(values),
  };
}

function csvEscape(value: unknown) {
  return JSON.stringify(value ?? "");
}

async function main() {
  if (trials !== 20) throw new Error(`manuscript experiment requires exactly 20 trials; got ${trials}`);
  const actualEvaluatedCommit = childProcess.execFileSync("git", ["rev-parse", "HEAD"], { cwd: evaluatedRoot, encoding: "utf8" }).trim();
  if (actualEvaluatedCommit !== evaluatedCommit) throw new Error(`evaluated worktree is ${actualEvaluatedCommit}, expected ${evaluatedCommit}`);

  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { polling: true, pollingInterval: 250 });
  const network = await provider.getNetwork();
  if (network.chainId !== 20260703n) throw new Error(`unexpected Besu chain ID ${network.chainId}`);
  const admin = new ethers.Wallet(readDeployerKey(), provider);
  const researcher = ethers.Wallet.createRandom().connect(provider);
  const gateway = ethers.Wallet.createRandom().connect(provider);
  const custodian = ethers.Wallet.createRandom().connect(provider);
  await fund(admin, researcher);
  await fund(admin, gateway);
  await fund(admin, custodian);

  const registryDeployment = await deploy("VCEMRegistry", admin);
  const consentDeployment = await deploy("VCEMConsent", admin, [await registryDeployment.contract.getAddress()]);
  const auditDeployment = await deploy("VCEMAudit", admin, [await registryDeployment.contract.getAddress(), await consentDeployment.contract.getAddress()]);
  const registry = registryDeployment.contract;
  const consent = consentDeployment.contract;
  const audit = auditDeployment.contract;
  const ids = {
    researcher: actorId("temporal:besu:researcher"),
    gateway: actorId("temporal:besu:gateway"),
    custodian: actorId("temporal:besu:custodian"),
  };
  await sendAndWait(registry, admin, "registerActor", [ids.researcher, researcher.address, Role.RESEARCHER]);
  await sendAndWait(registry, admin, "registerActor", [ids.gateway, gateway.address, Role.POLICY_GATEWAY]);
  await sendAndWait(registry, admin, "registerActor", [ids.custodian, custodian.address, Role.DATA_CUSTODIAN]);

  const rows: any[] = [];
  for (let trial = 1; trial <= trials; trial++) {
    const participant = ethers.Wallet.createRandom().connect(provider);
    await fund(admin, participant);
    const participantId = actorId(`temporal:besu:participant:${trial}`);
    const scopeHash = digest(`temporal:besu:scope:${trial}`);
    const dataHash = digest(`temporal:besu:data:${trial}`);
    await sendAndWait(registry, admin, "registerActor", [participantId, participant.address, Role.PARTICIPANT]);
    await sendAndWait(consent, participant, "createConsent", [
      participantId,
      { purposeMask: Purpose.RESEARCH, scopeHash, zkConsentCommitment: digest(`temporal:besu:zk:${trial}`) },
      [ids.researcher],
    ]);
    await sendAndWait(audit, custodian, "registerDataHash", [participantId, scopeHash, dataHash]);
    const before = await (consent as any).getCurrentConsentVersion(participantId);
    const latest = await provider.getBlock("latest");
    const request = {
      participantId,
      requestorId: ids.researcher,
      dataHash,
      scopeHash,
      requestedPurpose: Purpose.RESEARCH,
      requestId: digest(`temporal:besu:request:${trial}`),
      clientTimestamp: latest!.timestamp,
      requestExpiry: latest!.timestamp + 3600,
      expectedConsentHash: before.consentHash,
    };
    const signature = await signRequest(audit, researcher, network.chainId, request);
    const submittedAt = new Date().toISOString();
    const monotonicStart = process.hrtime.bigint();
    const revocationTx = await (consent.connect(participant) as any).revokeConsent(
      participantId,
      await legacyOverrides(provider, participant)
    );
    const revocationReceipt = await revocationTx.wait(confirmations);
    const monotonicEnd = process.hrtime.bigint();
    const finalizedAt = new Date().toISOString();
    if (!revocationReceipt || revocationReceipt.status !== 1) throw new Error(`trial ${trial}: revocation failed`);
    const latencyMs = Number(monotonicEnd - monotonicStart) / 1_000_000;
    const after = await (consent as any).getCurrentConsentVersion(participantId);

    let rejectionReason = "";
    try {
      await (audit.connect(gateway) as any).authorizeAndLogAccess.staticCall(request, signature);
    } catch (error) {
      rejectionReason = normalizeReason(error);
    }
    const staleTx = await gateway.sendTransaction({
      to: await audit.getAddress(),
      data: audit.interface.encodeFunctionData("authorizeAndLogAccess", [request, signature]),
      ...(await legacyOverrides(provider, gateway)),
    });
    let staleReceipt: ethers.TransactionReceipt | null = null;
    try {
      staleReceipt = await staleTx.wait(confirmations);
    } catch (error: any) {
      staleReceipt = error?.receipt || await provider.getTransactionReceipt(staleTx.hash);
    }
    const staleRejected = staleReceipt?.status === 0;
    if (!staleRejected || rejectionReason !== "VCEMAudit: consent inactive") {
      throw new Error(`trial ${trial}: stale request result=${staleReceipt?.status}, reason=${rejectionReason}`);
    }
    const row = {
      trial,
      participantId,
      preRevocationConsentVersion: before.version.toString(),
      preRevocationConsentHash: before.consentHash,
      revocationTxHash: revocationTx.hash,
      revocationSubmissionTimestamp: submittedAt,
      revocationReceiptFinalityTimestamp: finalizedAt,
      elapsedLatencyMs: latencyMs,
      revocationBlockNumber: revocationReceipt.blockNumber,
      revocationTransactionIndex: revocationReceipt.index,
      resultingConsentVersion: after.version.toString(),
      resultingConsentHash: after.consentHash,
      resultingStatus: Number(after.status),
      staleAuthorizationRequestId: request.requestId,
      staleAuthorizationTxHash: staleTx.hash,
      staleAuthorizationBlockNumber: staleReceipt!.blockNumber,
      staleAuthorizationTransactionIndex: staleReceipt!.index,
      staleAuthorizationResult: "denied",
      rejectionReason,
    };
    rows.push(row);
    console.log(JSON.stringify({ trial, latencyMs, revocationBlock: row.revocationBlockNumber, staleRequest: "denied" }));
  }

  fs.mkdirSync(rawRoot, { recursive: true });
  const stats = statistics(rows.map((row) => row.elapsedLatencyMs));
  const dockerImage = childProcess.execFileSync("docker", ["inspect", "--format", "{{.Config.Image}}", "vcem-besu-rpc-1"], { encoding: "utf8" }).trim();
  const evidence = {
    provenance: {
      evaluatedCommit,
      evaluatedWorktree: evaluatedRoot,
      contractsModified: false,
      rpcUrl,
      chainId: network.chainId.toString(),
      client: await provider.send("web3_clientVersion", []),
      dockerImage,
      consensus: "IBFT 2.0",
      validators: 4,
      rpcNodes: 1,
      blockPeriodSeconds: 2,
      confirmations,
      definition: "elapsed monotonic wall-clock time from immediately before revokeConsent submission to receipt/finality",
      generatedAt: new Date().toISOString(),
    },
    deployment: {
      VCEMRegistry: await registry.getAddress(),
      VCEMConsent: await consent.getAddress(),
      VCEMAudit: await audit.getAddress(),
      transactions: {
        VCEMRegistry: registryDeployment.receipt.hash,
        VCEMConsent: consentDeployment.receipt.hash,
        VCEMAudit: auditDeployment.receipt.hash,
      },
    },
    statistics: stats,
    trials: rows,
  };
  fs.writeFileSync(path.join(rawRoot, "besu-revocation-latency.json"), JSON.stringify(evidence, null, 2));
  fs.writeFileSync(path.join(rawRoot, "besu-temporal-execution.log"), rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  const columns = Object.keys(rows[0]);
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
  fs.writeFileSync(path.join(reportRoot, "revocation-latency-runs.csv"), `${csv}\n`);
  fs.writeFileSync(path.join(reportRoot, "revocation-latency-summary.json"), JSON.stringify(stats, null, 2));
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
