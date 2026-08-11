import "dotenv/config";
import crypto from "crypto";
import http from "http";
import { Pool } from "pg";

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

export async function createBaselineServer(databaseUrl: string) {
  const db = new Pool({ connectionString: databaseUrl });
  await db.query("SELECT 1");
  return http.createServer(async (req, res) => {
    const started = Date.now();
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (req.method !== "POST" || url.pathname !== "/baseline/access") return send(res, 404, { error: "not found" });
      const auth = req.headers.authorization || "";
      if (!auth.startsWith("Bearer ")) return send(res, 401, { error: "unauthenticated" });
      const body = await readJson(req);
      const required = ["participantId", "requestorId", "dataHash", "scopeHash", "purpose", "requestId"];
      for (const field of required) if (body[field] === undefined) throw new Error(`missing ${field}`);
      const result = await db.query(
        `SELECT * FROM baseline_authorize_artifact($1, $2, $3, $4, $5, $6, $7)`,
        [
          tokenHash(auth.slice("Bearer ".length)),
          body.participantId,
          body.requestorId,
          body.dataHash,
          body.scopeHash,
          Number(body.purpose),
          body.requestId,
        ]
      );
      const row = result.rows[0];
      if (!row) throw new Error("artifact not found");
      return send(res, 200, {
        dataHash: row.data_hash,
        ciphertext: Buffer.from(row.ciphertext).toString("base64"),
        iv: Buffer.from(row.iv).toString("base64"),
        tag: Buffer.from(row.tag).toString("base64"),
        keyId: row.key_id,
        latencyMs: Date.now() - started,
      });
    } catch (err: any) {
      return send(res, 403, { error: err.message, latencyMs: Date.now() - started });
    }
  });
}

async function main() {
  const databaseUrl = process.env.BASELINE_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("BASELINE_DATABASE_URL or DATABASE_URL is required");
  const port = Number(process.env.BASELINE_PORT || 8091);
  const server = await createBaselineServer(databaseUrl);
  server.listen(port, () => console.log(`baseline benchmark API listening on ${port}`));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
