import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class EventsService {
  constructor(private db: DataSource) {}

  async getForUser(userId: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT id, title, description, date, created_at FROM events WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
  }

  async create(userId: string, data: { title: string; description?: string; date: number }): Promise<unknown> {
    const rows = await this.db.query(
      `INSERT INTO events (user_id, title, description, date) VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, data.title, data.description ?? null, data.date]
    );
    return rows[0];
  }
}
