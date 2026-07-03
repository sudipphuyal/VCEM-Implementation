import childProcess from "child_process";
import fs from "fs";

const scannedFiles = childProcess.execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const patterns = [
  { name: "private key assignment", regex: /\b(?:PRIVATE_KEY|SECRET_KEY|DEPLOYER_KEY)\s*=\s*(0x)?[0-9a-fA-F]{64}\b/ },
  { name: "mnemonic phrase", regex: /\b(?:MNEMONIC|SEED_PHRASE)\s*=\s*["']?[a-z]+(?:\s+[a-z]+){11,}/i },
  { name: "generic API key", regex: /\b(?:API_KEY|ALCHEMY_API_KEY|RPC_KEY|DATABASE_URL)\s*=\s*[^<\s][^\s]+/ },
  { name: "raw hex private key assignment", regex: /\b(?:privateKey|walletKey|secretKey|deployerKey)\s*[:=]\s*["']?0x[0-9a-fA-F]{64}\b/i },
];
const allowlisted = new Set([
  ".env.example",
  "docs/secret-rotation.md",
  "docs/security-fixes.md",
  "docs/dependency-risk-register.md",
  "benchmarks/reports/benchmark-report.md",
  "deployments/vcem-manifest.json",
]);

const findings: Array<{ file: string; pattern: string }> = [];
for (const file of scannedFiles) {
  if (allowlisted.has(file)) continue;
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) findings.push({ file, pattern: pattern.name });
  }
}

if (findings.length) {
  console.error("Potential committed secrets detected:");
  for (const finding of findings) console.error(`- ${finding.file}: ${finding.pattern}`);
  process.exitCode = 1;
} else {
  console.log("No obvious secrets detected in tracked or unignored worktree files.");
}
