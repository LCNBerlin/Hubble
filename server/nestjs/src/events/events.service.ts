import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class EventsService {
  constructor(private db: DataSource) {}

  async create(userId: string, data: { title: string; description?: string | null; date: number }): Promise<unknown> {
    const rows = await this.db.query(
      `INSERT INTO events (user_id, title, description, date) VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, data.title, data.description ?? null, new Date(data.date).toISOString()]
    );
    return rows[0];
  }
}
