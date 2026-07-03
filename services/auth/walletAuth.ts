import crypto from "crypto";
import { ethers } from "ethers";
import { Database } from "../storage/postgres";

export type AuthChallenge = {
  wallet: string;
  nonce: string;
  message: string;
  expiresAt: Date;
};

export type AuthSession = {
  wallet: string;
  requestorId: string;
  authenticatedAt: number;
  expiresAt?: number;
  tokenHash?: string;
};

export interface ChallengeStore {
  save(challenge: AuthChallenge): Promise<void>;
  consume(wallet: string, message: string, now?: Date): Promise<AuthChallenge>;
}

export interface SessionStore {
  create(wallet: string, requestorId: string, ttlSeconds: number): Promise<string>;
  require(token: string, now?: Date): Promise<AuthSession>;
  revoke(token: string): Promise<void>;
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export class PostgresChallengeStore implements ChallengeStore {
  constructor(private readonly db: Database) {}

  async save(challenge: AuthChallenge) {
    await this.db.query(
      `INSERT INTO auth_challenges (nonce, wallet, message, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [challenge.nonce, challenge.wallet.toLowerCase(), challenge.message, challenge.expiresAt]
    );
  }

  async consume(wallet: string, message: string, now = new Date()) {
    const result = await this.db.query<AuthChallenge & { expires_at: Date; consumed_at: Date | null }>(
      `UPDATE auth_challenges
       SET consumed_at = $3
       WHERE wallet = $1 AND message = $2 AND consumed_at IS NULL AND expires_at > $3
       RETURNING wallet, nonce, message, expires_at, consumed_at`,
      [ethers.getAddress(wallet).toLowerCase(), message, now]
    );
    const row = result.rows[0];
    if (!row) throw new Error("invalid or expired authentication nonce");
    return {
      wallet: ethers.getAddress(row.wallet),
      nonce: row.nonce,
      message: row.message,
      expiresAt: new Date(row.expires_at),
    };
  }
}

export class PostgresSessionStore implements SessionStore {
  constructor(private readonly db: Database) {}

  async create(wallet: string, requestorId: string, ttlSeconds: number) {
    const token = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    await this.db.query(
      `INSERT INTO auth_sessions (token_hash, wallet, requestor_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenHash(token), ethers.getAddress(wallet).toLowerCase(), requestorId.toLowerCase(), now, expiresAt]
    );
    return token;
  }

  async require(token: string, now = new Date()) {
    const result = await this.db.query<any>(
      `SELECT token_hash, wallet, requestor_id, created_at, expires_at
       FROM auth_sessions
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2`,
      [tokenHash(token), now]
    );
    const row = result.rows[0];
    if (!row) throw new Error("unauthenticated");
    return {
      wallet: ethers.getAddress(row.wallet),
      requestorId: row.requestor_id,
      authenticatedAt: new Date(row.created_at).getTime(),
      expiresAt: new Date(row.expires_at).getTime(),
      tokenHash: row.token_hash,
    };
  }

  async revoke(token: string) {
    await this.db.query(`UPDATE auth_sessions SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash(token)]);
  }
}

export class MemoryChallengeStore implements ChallengeStore {
  private challenges = new Map<string, AuthChallenge>();

  async save(challenge: AuthChallenge) {
    this.challenges.set(`${challenge.wallet.toLowerCase()}:${challenge.message}`, challenge);
  }

  async consume(wallet: string, message: string, now = new Date()) {
    const key = `${ethers.getAddress(wallet).toLowerCase()}:${message}`;
    const challenge = this.challenges.get(key);
    if (!challenge || challenge.expiresAt <= now) throw new Error("invalid or expired authentication nonce");
    this.challenges.delete(key);
    return challenge;
  }
}

export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, AuthSession & { revoked?: boolean }>();

  async create(wallet: string, requestorId: string, ttlSeconds: number) {
    const token = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    this.sessions.set(tokenHash(token), {
      wallet: ethers.getAddress(wallet),
      requestorId,
      authenticatedAt: now,
      expiresAt: now + ttlSeconds * 1000,
      tokenHash: tokenHash(token),
    });
    return token;
  }

  async require(token: string, now = new Date()) {
    const session = this.sessions.get(tokenHash(token));
    if (!session || session.revoked || !session.expiresAt || session.expiresAt <= now.getTime()) throw new Error("unauthenticated");
    return session;
  }

  async revoke(token: string) {
    const session = this.sessions.get(tokenHash(token));
    if (session) session.revoked = true;
  }
}

export class WalletAuthService {
  constructor(
    private readonly challenges: ChallengeStore,
    private readonly sessions: SessionStore,
    private readonly options = { challengeTtlSeconds: 300, sessionTtlSeconds: 900 }
  ) {}

  async issueChallenge(wallet: string) {
    const normalized = ethers.getAddress(wallet);
    const nonce = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + this.options.challengeTtlSeconds * 1000);
    const message = `VCEM authentication nonce:${nonce}:expires:${expiresAt.toISOString()}`;
    const challenge = { wallet: normalized, nonce, message, expiresAt };
    await this.challenges.save(challenge);
    return challenge;
  }

  async createSession(wallet: string, message: string, signature: string, requestorId: string) {
    const recovered = ethers.verifyMessage(message, signature);
    if (ethers.getAddress(recovered) !== ethers.getAddress(wallet)) throw new Error("wallet signature mismatch");
    await this.challenges.consume(wallet, message);
    return this.sessions.create(wallet, requestorId, this.options.sessionTtlSeconds);
  }

  requireSession(token: string) {
    return this.sessions.require(token);
  }

  revokeSession(token: string) {
    return this.sessions.revoke(token);
  }
}

export async function verifyWalletChallenge(wallet: string, message: string, signature: string, nonces: ChallengeStore) {
  const recovered = ethers.verifyMessage(message, signature);
  if (ethers.getAddress(recovered) !== ethers.getAddress(wallet)) throw new Error("wallet signature mismatch");
  await nonces.consume(wallet, message);
  return ethers.getAddress(wallet);
}
