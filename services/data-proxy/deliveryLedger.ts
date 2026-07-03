import { Database } from "../storage/postgres";

export type DeliveryOutcome = "released" | "denied";

export type DeliveryLedgerRecord = {
  requestId: string;
  participantId: string;
  requestorId: string;
  dataHash: string;
  authorizationTxHash: string;
  releaseResult: DeliveryOutcome;
  errorCode?: string;
  deliveredAt?: Date;
};

export interface AsyncDeliveryLedger {
  has(requestId: string): Promise<boolean>;
  record(record: DeliveryLedgerRecord): Promise<void>;
}

export class PostgresDeliveryLedger implements AsyncDeliveryLedger {
  constructor(private readonly db: Database) {}

  async has(requestId: string) {
    const result = await this.db.query(`SELECT 1 FROM delivery_ledger WHERE request_id = $1`, [requestId.toLowerCase()]);
    return (result.rowCount ?? 0) > 0;
  }

  async record(record: DeliveryLedgerRecord) {
    try {
      await this.db.query(
        `INSERT INTO delivery_ledger
          (request_id, participant_id, requestor_id, data_hash, authorization_tx_hash, release_result, error_code, delivered_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()))`,
        [
          record.requestId.toLowerCase(),
          record.participantId.toLowerCase(),
          record.requestorId.toLowerCase(),
          record.dataHash.toLowerCase(),
          record.authorizationTxHash.toLowerCase(),
          record.releaseResult,
          record.errorCode ?? null,
          record.deliveredAt ?? null,
        ]
      );
    } catch (err: any) {
      if (err?.code === "23505") throw new Error("request ID has already been delivered");
      throw err;
    }
  }
}

export class MemoryDeliveryLedger implements AsyncDeliveryLedger {
  private records = new Map<string, DeliveryLedgerRecord>();

  async has(requestId: string) {
    return this.records.has(requestId.toLowerCase());
  }

  async record(record: DeliveryLedgerRecord) {
    const key = record.requestId.toLowerCase();
    if (this.records.has(key)) throw new Error("request ID has already been delivered");
    this.records.set(key, { ...record, requestId: key, deliveredAt: record.deliveredAt ?? new Date() });
  }

  all() {
    return [...this.records.values()];
  }
}
