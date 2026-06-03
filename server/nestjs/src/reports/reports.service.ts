import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class ReportsService {
  constructor(private db: DataSource) {}

  async create(reporterId: string, reportedId: string, reason: string): Promise<void> {
    await this.db.query(
      `INSERT INTO reports (reporter_id, reported_id, reason) VALUES ($1, $2, $3)`,
      [reporterId, reportedId, reason]
    );
  }
}
