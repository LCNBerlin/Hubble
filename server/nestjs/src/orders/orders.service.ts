import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class OrdersService {
  constructor(private db: DataSource) {}

  async getForBuyer(userId: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT o.*,
        json_agg(json_build_object(
          'id', oi.id, 'order_id', oi.order_id, 'product_id', oi.product_id,
          'creator_id', oi.creator_id, 'title', oi.title, 'price_cents', oi.price_cents,
          'quantity', oi.quantity, 'line_total_cents', oi.line_total_cents
        )) AS order_items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.buyer_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [userId]
    );
  }

  async getPayoutsForCreator(creatorId: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT * FROM creator_payouts WHERE creator_id = $1 ORDER BY created_at DESC`,
      [creatorId]
    );
  }
}
