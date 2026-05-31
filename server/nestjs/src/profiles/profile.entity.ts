import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("profiles")
export class Profile {
  @PrimaryColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: "password_hash", nullable: true, type: "varchar" })
  passwordHash: string | null;

  @Column({ unique: true, nullable: true, type: "varchar" })
  username: string | null;

  @Column({ name: "display_name", nullable: true, type: "varchar" })
  displayName: string | null;

  @Column({ name: "avatar_url", nullable: true, type: "varchar" })
  avatarUrl: string | null;

  @Column({ name: "banner_url", nullable: true, type: "varchar" })
  bannerUrl: string | null;

  @Column({ nullable: true, type: "text" })
  bio: string | null;

  @Column({ name: "followers_count", default: 0 })
  followersCount: number;

  @Column({ name: "following_count", default: 0 })
  followingCount: number;

  @Column({ name: "is_verified", default: false })
  isVerified: boolean;

  @Column({ name: "verified_tier", nullable: true, type: "varchar" })
  verifiedTier: string | null;

  @Column({ name: "stripe_connect_account_id", nullable: true, type: "varchar" })
  stripeConnectAccountId: string | null;

  @Column({ name: "reputation_score", type: "decimal", default: 0, nullable: true })
  reputationScore: number | null;

  @Column({ type: "simple-array", nullable: true })
  links: string[] | null;

  @Column({ nullable: true, type: "varchar" })
  location: string | null;

  @Column({ type: "decimal", nullable: true })
  lat: number | null;

  @Column({ type: "decimal", nullable: true })
  lng: number | null;

  @Column({ name: "category_tags", type: "simple-array", nullable: true })
  categoryTags: string[] | null;

  @Column({ name: "wallet_address", nullable: true, type: "varchar" })
  walletAddress: string | null;

  @Column({ name: "ens_name", nullable: true, type: "varchar" })
  ensName: string | null;

  @Column({ name: "on_chain_visible", default: false })
  onChainVisible: boolean;

  @Column({ name: "staking_badge", default: false })
  stakingBadge: boolean;

  @Column({ name: "governance_badge", default: false })
  governanceBadge: boolean;

  @Column({ name: "brand_statement", nullable: true, type: "text" })
  brandStatement: string | null;

  @Column({ name: "niche_classification", nullable: true, type: "varchar" })
  nicheClassification: string | null;

  @Column({ name: "value_proposition", nullable: true, type: "text" })
  valueProposition: string | null;

  @Column({ name: "affiliate_code", nullable: true, unique: true, type: "varchar" })
  affiliateCode: string | null;

  @Column({ name: "dm_access_enabled", default: false })
  dmAccessEnabled: boolean;

  @Column({ name: "dm_access_price_cents", default: 0 })
  dmAccessPriceCents: number;

  @Column({ name: "staking_url", nullable: true, type: "varchar" })
  stakingUrl: string | null;

  @Column({ name: "governance_url", nullable: true, type: "varchar" })
  governanceUrl: string | null;

  @Column({ name: "equity_pool_label", nullable: true, type: "varchar" })
  equityPoolLabel: string | null;

  @Column({ name: "equity_pool_url", nullable: true, type: "varchar" })
  equityPoolUrl: string | null;

  @Column({ name: "see_more_topics", type: "simple-array", nullable: true })
  seeMoreTopics: string[] | null;

  @Column({ name: "see_less_topics", type: "simple-array", nullable: true })
  seeLessTopics: string[] | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
