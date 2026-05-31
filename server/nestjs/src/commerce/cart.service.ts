import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class CartService {
  constructor(private db: DataSource) {}

  async getCart(userId: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT ci.product_id, ci.quantity, ci.selected_tier_index, p.*
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = $1`,
      [userId]
    );
  }

  async upsertItem(userId: string, productId: string, quantity: number, selectedTierIndex = 0): Promise<void> {
    await this.db.query(
      `INSERT INTO cart_items (user_id, product_id, quantity, selected_tier_index)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = $3, selected_tier_index = $4, updated_at = NOW()`,
      [userId, productId, quantity, selectedTierIndex]
    );
  }

  async removeItem(userId: string, productId: string): Promise<void> {
    await this.db.query(`DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2`, [userId, productId]);
  }

  async clearCart(userId: string): Promise<void> {
    await this.db.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
  }
}
