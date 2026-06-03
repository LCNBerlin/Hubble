import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Profile } from "./profile.entity";

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile) private profiles: Repository<Profile>,
    private dataSource: DataSource
  ) {}

  async findById(id: string): Promise<unknown> {
    const rows = await this.dataSource.query(`SELECT * FROM profiles WHERE id = $1`, [id]);
    if (!rows[0]) throw new NotFoundException("Profile not found");
    return rows[0];
  }

  async findByUsername(username: string): Promise<unknown> {
    const rows = await this.dataSource.query(`SELECT * FROM profiles WHERE username = $1`, [username]);
    if (!rows[0]) throw new NotFoundException("Profile not found");
    return rows[0];
  }

  async update(id: string, data: Partial<Profile>): Promise<unknown> {
    await this.profiles.update(id, { ...data, updatedAt: new Date() });
    return this.findById(id);
  }

  async follow(followerId: string, followingId: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [followerId, followingId]
    );
    await this.dataSource.query(
      `UPDATE profiles SET followers_count = followers_count + 1 WHERE id = $1`,
      [followingId]
    );
    await this.dataSource.query(
      `UPDATE profiles SET following_count = following_count + 1 WHERE id = $1`,
      [followerId]
    );
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const result = await this.dataSource.query(
      `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );
    if (result[1] > 0) {
      await this.dataSource.query(
        `UPDATE profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = $1`,
        [followingId]
      );
      await this.dataSource.query(
        `UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = $1`,
        [followerId]
      );
    }
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );
    return rows.length > 0;
  }

  async getFollowerIds(userId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT follower_id FROM follows WHERE following_id = $1`,
      [userId]
    );
    return rows.map((r: { follower_id: string }) => r.follower_id);
  }

  async getFollowingIds(userId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT following_id FROM follows WHERE follower_id = $1`,
      [userId]
    );
    return rows.map((r: { following_id: string }) => r.following_id);
  }

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [blockerId, blockedId]
    );
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId]
    );
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT blocked_id FROM blocked_users WHERE blocker_id = $1`,
      [userId]
    );
    return rows.map((r: { blocked_id: string }) => r.blocked_id);
  }

  async getSavedPostIds(userId: string): Promise<string[]> {
    const rows = await this.dataSource.query(`SELECT post_id FROM saved_posts WHERE user_id = $1`, [userId]);
    return rows.map((r: { post_id: string }) => r.post_id);
  }

  async getSavedProductIds(userId: string): Promise<string[]> {
    const rows = await this.dataSource.query(`SELECT product_id FROM saved_products WHERE user_id = $1`, [userId]);
    return rows.map((r: { product_id: string }) => r.product_id);
  }

  async getSavedPosts(userId: string): Promise<unknown[]> {
    return this.dataSource.query(
      `SELECT p.id, p.type, p.title, p.body, p.media_uri, p.thumbnail_uri
       FROM saved_posts sp
       JOIN posts p ON p.id = sp.post_id
       WHERE sp.user_id = $1
       ORDER BY sp.created_at DESC`,
      [userId]
    );
  }

  async getSavedProducts(userId: string): Promise<unknown[]> {
    return this.dataSource.query(
      `SELECT p.*
       FROM saved_products sp
       JOIN products p ON p.id = sp.product_id
       WHERE sp.user_id = $1
       ORDER BY sp.created_at DESC`,
      [userId]
    );
  }

  async toggleSavePost(userId: string, postId: string): Promise<{ saved: boolean }> {
    const existing = await this.dataSource.query(`SELECT 1 FROM saved_posts WHERE user_id = $1 AND post_id = $2`, [userId, postId]);
    if (existing[0]) {
      await this.dataSource.query(`DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2`, [userId, postId]);
      return { saved: false };
    }
    await this.dataSource.query(`INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, postId]);
    return { saved: true };
  }

  async toggleSaveProduct(userId: string, productId: string): Promise<{ saved: boolean }> {
    const existing = await this.dataSource.query(`SELECT 1 FROM saved_products WHERE user_id = $1 AND product_id = $2`, [userId, productId]);
    if (existing[0]) {
      await this.dataSource.query(`DELETE FROM saved_products WHERE user_id = $1 AND product_id = $2`, [userId, productId]);
      return { saved: false };
    }
    await this.dataSource.query(`INSERT INTO saved_products (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, productId]);
    return { saved: true };
  }

  async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    await this.dataSource.query(`UPDATE profiles SET avatar_url = $1, updated_at = NOW() WHERE id = $2`, [avatarUrl, userId]);
  }

  async searchProfiles(query: string, limit = 20): Promise<unknown[]> {
    return this.dataSource.query(
      `SELECT id, username, display_name, avatar_url, verified_tier, followers_count
       FROM profiles
       WHERE username ILIKE $1 OR display_name ILIKE $1
       ORDER BY followers_count DESC LIMIT $2`,
      [`%${query}%`, limit]
    );
  }
}
