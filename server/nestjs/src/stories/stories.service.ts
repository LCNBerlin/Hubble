import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class StoriesService {
  constructor(private db: DataSource) {}

  async getByUser(userId: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT id, media_uri, type, created_at
       FROM stories
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at ASC`,
      [userId]
    );
  }

  async create(userId: string, data: { mediaUri: string; type?: string }): Promise<unknown> {
    const rows = await this.db.query(
      `INSERT INTO stories (user_id, media_uri, type) VALUES ($1, $2, $3) RETURNING *`,
      [userId, data.mediaUri, data.type ?? "image"]
    );
    return rows[0];
  }
}
