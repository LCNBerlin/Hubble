import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class StorageItemsService {
  constructor(private db: DataSource) {}

  async getStorageItems(userId: string, view: string): Promise<unknown[]> {
    const items: unknown[] = [];

    if (view === "products" || view === "all") {
      const purchases = await this.db.query(
        `SELECT oi.id, oi.product_id, oi.title, oi.order_id,
          p.type, p.category, p.categories, p.cover_uri, p.media_uri
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN products p ON p.id = oi.product_id
         WHERE o.buyer_id = $1`,
        [userId]
      );
      items.push(...purchases.map((r: Record<string, unknown>) => ({ ...r, kind: "purchase" })));

      const created = await this.db.query(
        `SELECT id, title, type, category, categories, cover_uri, media_uri FROM products WHERE creator_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      items.push(...created.map((r: Record<string, unknown>) => ({ ...r, kind: "created_product" })));
    }

    if (view === "posts" || view === "all") {
      const posts = await this.db.query(
        `SELECT id, title, post_type AS type, media_uri, thumbnail_uri FROM posts WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );
      items.push(...posts.map((r: Record<string, unknown>) => ({ ...r, kind: "post" })));
    }

    return items;
  }
}
