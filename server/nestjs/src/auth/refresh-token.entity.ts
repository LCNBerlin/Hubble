import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Profile } from "../profiles/profile.entity";

@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id" })
  userId: string;

  @ManyToOne(() => Profile, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: Profile;

  @Column({ name: "token_hash" })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
