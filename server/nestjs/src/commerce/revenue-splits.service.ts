import { Injectable, ForbiddenException } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class RevenueSplitsService {
  constructor(private db: DataSource) {}

  async getByOwner(ownerId: string, targetType: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT rs.*, jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name) AS partner
       FROM revenue_splits rs
       JOIN profiles p ON p.id = rs.partner_id
       WHERE rs.owner_id = $1 AND rs.target_type = $2
       ORDER BY rs.created_at`,
      [ownerId, targetType]
    );
  }

  async create(ownerId: string, data: { partnerId: string; targetType: string; targetId: string; splitPercent: number }): Promise<unknown> {
    const rows = await this.db.query(
      `INSERT INTO revenue_splits (owner_id, partner_id, target_type, target_id, split_percent)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [ownerId, data.partnerId, data.targetType, data.targetId, data.splitPercent]
    );
    return rows[0];
  }

  async update(splitId: string, ownerId: string, splitPercent: number): Promise<unknown> {
    const rows = await this.db.query(
      `UPDATE revenue_splits SET split_percent = $1 WHERE id = $2 AND owner_id = $3 RETURNING *`,
      [splitPercent, splitId, ownerId]
    );
    return rows[0];
  }

  async delete(splitId: string, ownerId: string): Promise<void> {
    const rows = await this.db.query(`SELECT owner_id FROM revenue_splits WHERE id = $1`, [splitId]);
    if (rows[0] && rows[0].owner_id !== ownerId) throw new ForbiddenException("Not your split");
    await this.db.query(`DELETE FROM revenue_splits WHERE id = $1 AND owner_id = $2`, [splitId, ownerId]);
  }

  async deleteByTarget(ownerId: string, targetType: string, targetId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM revenue_splits WHERE owner_id = $1 AND target_type = $2 AND target_id = $3`,
      [ownerId, targetType, targetId]
    );
  }
}
