import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Client } from "pg";
import { ethers } from "ethers";

const repoRoot = path.resolve(__dirname, "../..");
const fixtureDir = path.join(repoRoot, "benchmarks", "raw", "fixtures");
const fixturePath = path.join(fixtureDir, "benchmark-fixtures.json");
const levels = [10, 25, 50, 75, 100];
const runs = [1, 2, 3, 4, 5];
const fixtureCount = Number(process.env.BENCHMARK_FIXTURE_COUNT || 75000);

function sha256(data: Buffer | string) {
  return ethers.sha256(typeof data === "string" ? Buffer.from(data) : data);
}

function hex32(label: string) {
  return sha256(label);
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function encryptFixture(plaintext: Buffer) {
  const key = crypto.createHash("sha256").update("vcem-benchmark-dev-key").digest();
  const iv = crypto.createHash("sha256").update("vcem-benchmark-iv").digest().subarray(0, 12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag(), keyId: "benchmark-dev-key" };
}

async function seedBaseline(fixtures: any) {
  const databaseUrl = process.env.BASELINE_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) return { status: "not executed", reason: "BASELINE_DATABASE_URL/DATABASE_URL not configured" };
  const sql = fs.readFileSync(path.join(repoRoot, "benchmarks", "baseline", "postgres-rls.sql"), "utf8");
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query(sql);
    await db.query(
      `INSERT INTO baseline_researchers(requestor_id, wallet, role, active) VALUES ($1, $2, 'researcher', TRUE)`,
      [fixtures.requestorId, fixtures.researcherWallet]
    );
    await db.query(
      `INSERT INTO baseline_sessions(token_hash, wallet, requestor_id, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')`,
      [tokenHash(fixtures.sessionToken), fixtures.researcherWallet.toLowerCase(), fixtures.requestorId]
    );
    await db.query(
      `INSERT INTO baseline_consent_policy(participant_id, requestor_id, purpose, scope_hash, active)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [fixtures.participantId, fixtures.requestorId, fixtures.purpose, fixtures.scopeHash]
    );
    await db.query(
      `INSERT INTO baseline_artifacts(data_hash, participant_id, scope_hash, ciphertext, iv, tag, key_id, plaintext_sha256)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $1)`,
      [
        fixtures.dataHash,
        fixtures.participantId,
        fixtures.scopeHash,
        Buffer.from(fixtures.encryptedArtifact.ciphertext, "base64"),
        Buffer.from(fixtures.encryptedArtifact.iv, "base64"),
        Buffer.from(fixtures.encryptedArtifact.tag, "base64"),
        fixtures.encryptedArtifact.keyId,
      ]
    );
    await db.query("COMMIT");
    return { status: "executed", database: "PostgreSQL" };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  } finally {
    await db.end();
  }
}

async function main() {
  fs.mkdirSync(fixtureDir, { recursive: true });
  const researcher = ethers.Wallet.fromPhrase("test test test test test test test test test test test junk");
  const participantId = hex32("benchmark-participant");
  const requestorId = hex32("benchmark-researcher");
  const scopeHash = hex32("benchmark-scope-observation");
  const plaintext = Buffer.from(JSON.stringify({ fixture: "benchmark-observation", value: 42 }));
  const dataHash = sha256(plaintext);
  const encrypted = encryptFixture(plaintext);
  const sessionToken = crypto.createHash("sha256").update("benchmark-session-token").digest("hex");
  const requests = Array.from({ length: fixtureCount }, (_, index) => ({
    index,
    participantId,
    requestorId,
    dataHash,
    scopeHash,
    purpose: 1,
    requestId: hex32(`benchmark-request-${index}`),
  }));
  const fixtures = {
    generatedAt: new Date().toISOString(),
    status: "fixture-generated",
    levels,
    runs,
    researcherWallet: researcher.address,
    participantId,
    requestorId,
    scopeHash,
    dataHash,
    purpose: 1,
    sessionToken,
    encryptedArtifact: {
      ciphertext: encrypted.ciphertext.toString("base64"),
      iv: encrypted.iv.toString("base64"),
      tag: encrypted.tag.toString("base64"),
      keyId: encrypted.keyId,
    },
    requests,
  };
  const baselineSeed = await seedBaseline(fixtures);
  fs.writeFileSync(fixturePath, JSON.stringify({ ...fixtures, baselineSeed }, null, 2));
  console.log(JSON.stringify({ fixturePath, requests: requests.length, baselineSeed }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
