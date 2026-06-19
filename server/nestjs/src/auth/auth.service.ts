import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { RefreshToken } from "./refresh-token.entity";
import { Profile } from "../profiles/profile.entity";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Profile) private profiles: Repository<Profile>,
    @InjectRepository(RefreshToken) private refreshTokens: Repository<RefreshToken>,
    private jwt: JwtService,
    private config: ConfigService
  ) {}

  async register(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const existing = await this.profiles.findOne({ where: { email } });
    if (existing) throw new ConflictException("Email already in use");

    const passwordHash = await bcrypt.hash(password, 12);
    const profile = this.profiles.create({
      id: uuidv4(),
      email,
      passwordHash,
      username: email.split("@")[0] + "_" + Math.floor(Math.random() * 9999),
    });
    await this.profiles.save(profile);
    return this.issueTokens(profile.id, email);
  }

  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const profile = await this.profiles.findOne({ where: { email } });
    if (!profile?.passwordHash) throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(password, profile.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    return this.issueTokens(profile.id, email);
  }

  async refresh(rawToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const [tokenId, rawSecret] = rawToken.split(":");
    if (!tokenId || !rawSecret) throw new UnauthorizedException("Invalid or expired refresh token");

    const stored = await this.refreshTokens.findOne({ where: { id: tokenId } });
    if (!stored || stored.expiresAt < new Date()) throw new UnauthorizedException("Invalid or expired refresh token");

    const valid = await bcrypt.compare(rawSecret, stored.tokenHash);
    if (!valid) throw new UnauthorizedException("Invalid or expired refresh token");

    const profile = await this.profiles.findOne({ where: { id: stored.userId } });
    if (!profile) throw new NotFoundException("User not found");

    await this.refreshTokens.delete({ id: stored.id });
    return this.issueTokens(profile.id, profile.email);
  }

  async logout(userId: string): Promise<void> {
    await this.refreshTokens.delete({ userId });
  }

  private async issueTokens(userId: string, email: string) {
    const accessToken = this.jwt.sign({ sub: userId, email });

    const rawSecret = uuidv4();
    const tokenHash = await bcrypt.hash(rawSecret, 10);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const saved = await this.refreshTokens.save(
      this.refreshTokens.create({ userId, tokenHash, expiresAt })
    );

    return { accessToken, refreshToken: `${saved.id}:${rawSecret}` };
  }
}
