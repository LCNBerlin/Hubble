import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class ProductsService {
  constructor(private db: DataSource) {}

  async getByCreator(creatorId: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT p.*, pr.username, pr.display_name, pr.avatar_url, pr.verified_tier
       FROM products p JOIN profiles pr ON pr.id = p.creator_id
       WHERE p.creator_id = $1 ORDER BY p.created_at DESC`,
      [creatorId]
    );
  }

  async getById(productId: string): Promise<unknown> {
    const rows = await this.db.query(
      `SELECT p.*, pr.username, pr.display_name, pr.avatar_url, pr.verified_tier
       FROM products p JOIN profiles pr ON pr.id = p.creator_id WHERE p.id = $1`,
      [productId]
    );
    if (!rows[0]) throw new NotFoundException("Product not found");
    return rows[0];
  }

  async create(creatorId: string, data: Record<string, unknown>): Promise<unknown> {
    const rows = await this.db.query(
      `INSERT INTO products (creator_id, title, description, price_cents, product_type, media_url, thumbnail_url, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [creatorId, data.title, data.description, data.priceCents ?? 0, data.productType ?? "digital", data.mediaUrl || null, data.thumbnailUrl || null, data.isPublished ?? true]
    );
    return rows[0];
  }

  async update(productId: string, creatorId: string, data: Record<string, unknown>): Promise<unknown> {
    const product = await this.db.query(`SELECT creator_id FROM products WHERE id = $1`, [productId]);
    if (!product[0]) throw new NotFoundException("Product not found");
    if (product[0].creator_id !== creatorId) throw new ForbiddenException("Not your product");
    const rows = await this.db.query(
      `UPDATE products SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        price_cents = COALESCE($3, price_cents),
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [data.title ?? null, data.description ?? null, data.priceCents ?? null, productId]
    );
    return rows[0];
  }

  async delete(productId: string, creatorId: string): Promise<void> {
    const product = await this.db.query(`SELECT creator_id FROM products WHERE id = $1`, [productId]);
    if (!product[0]) throw new NotFoundException("Product not found");
    if (product[0].creator_id !== creatorId) throw new ForbiddenException("Not your product");
    await this.db.query(`DELETE FROM products WHERE id = $1`, [productId]);
  }

  async getReviews(productId: string): Promise<unknown[]> {
    return this.db.query(
      `SELECT r.*, pr.username, pr.display_name, pr.avatar_url
       FROM product_reviews r JOIN profiles pr ON pr.id = r.user_id
       WHERE r.product_id = $1 ORDER BY r.created_at DESC`,
      [productId]
    );
  }

  async addReview(productId: string, userId: string, rating: number, body?: string): Promise<unknown> {
    const rows = await this.db.query(
      `INSERT INTO product_reviews (product_id, user_id, rating, body) VALUES ($1, $2, $3, $4) RETURNING *`,
      [productId, userId, rating, body ?? null]
    );
    return rows[0];
  }

  async search(query: string, limit = 20): Promise<unknown[]> {
    return this.db.query(
      `SELECT p.*, pr.username, pr.display_name, pr.avatar_url,
        ts_rank(to_tsvector('english', COALESCE(p.title,'') || ' ' || COALESCE(p.description,'')),
                plainto_tsquery('english', $1)) AS rank
       FROM products p JOIN profiles pr ON pr.id = p.creator_id
       WHERE to_tsvector('english', COALESCE(p.title,'') || ' ' || COALESCE(p.description,''))
             @@ plainto_tsquery('english', $1)
       AND p.is_published = true
       ORDER BY rank DESC LIMIT $2`,
      [query, limit]
    );
  }
}
