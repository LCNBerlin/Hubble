import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class RevenueSplitsService {
  constructor(private db: DataSource) {}

  async getForOwner(ownerId: string, targetType: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT rs.*, pr.id AS partner_id, pr.username, pr.display_name
       FROM revenue_splits rs JOIN profiles pr ON pr.id = rs.partner_id
       WHERE rs.owner_id = $1 AND rs.target_type = $2`,
      [ownerId, targetType]
    );
  }

  async create(ownerId: string, partnerId: string, targetType: string, targetId: string, splitPercent: number): Promise<unknown> {
    const rows = await this.db.query(
      `INSERT INTO revenue_splits (owner_id, partner_id, target_type, target_id, split_percent)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING *`,
      [ownerId, partnerId, targetType, targetId, splitPercent]
    );
    return rows[0];
  }

  async update(splitId: string, splitPercent: number): Promise<unknown> {
    const rows = await this.db.query(
      `UPDATE revenue_splits SET split_percent = $1 WHERE id = $2 RETURNING *`,
      [splitPercent, splitId]
    );
    return rows[0];
  }

  async deleteById(splitId: string): Promise<void> {
    await this.db.query(`DELETE FROM revenue_splits WHERE id = $1`, [splitId]);
  }

  async deleteByTarget(ownerId: string, targetType: string, targetId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM revenue_splits WHERE owner_id = $1 AND target_type = $2 AND target_id = $3`,
      [ownerId, targetType, targetId]
    );
  }
}
