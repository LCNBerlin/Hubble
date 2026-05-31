import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class WishlistService {
  constructor(private db: DataSource) {}

  async getWishlist(userId: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT p.* FROM wishlist w JOIN products p ON p.id = w.product_id WHERE w.user_id = $1`,
      [userId]
    );
  }

  async addToWishlist(userId: string, productId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, productId]
    );
  }

  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    await this.db.query(`DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2`, [userId, productId]);
  }
}
