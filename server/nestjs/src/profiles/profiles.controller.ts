import { Controller, Get, Patch, Post, Delete, Param, Body, Query, UseGuards } from "@nestjs/common";
import { ProfilesService } from "./profiles.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";
import { IsOptional, IsString, IsUrl } from "class-validator";

class UpdateProfileDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsUrl() avatarUrl?: string;
  @IsOptional() @IsUrl() bannerUrl?: string;
}

@Controller("profiles")
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private profiles: ProfilesService) {}

  @Get("me")
  getMe(@CurrentUser() user: JwtUser) {
    return this.profiles.findById(user.sub);
  }

  @Get(":id")
  getProfile(@Param("id") id: string) {
    return this.profiles.findById(id);
  }

  @Get("username/:username")
  getByUsername(@Param("username") username: string) {
    return this.profiles.findByUsername(username);
  }

  @Patch("me")
  updateMe(@CurrentUser() user: JwtUser, @Body() body: UpdateProfileDto) {
    return this.profiles.update(user.sub, body);
  }

  @Post(":id/follow")
  follow(@CurrentUser() user: JwtUser, @Param("id") targetId: string) {
    return this.profiles.follow(user.sub, targetId);
  }

  @Delete(":id/follow")
  unfollow(@CurrentUser() user: JwtUser, @Param("id") targetId: string) {
    return this.profiles.unfollow(user.sub, targetId);
  }

  @Post(":id/block")
  block(@CurrentUser() user: JwtUser, @Param("id") targetId: string) {
    return this.profiles.blockUser(user.sub, targetId);
  }

  @Delete(":id/block")
  unblock(@CurrentUser() user: JwtUser, @Param("id") targetId: string) {
    return this.profiles.unblockUser(user.sub, targetId);
  }

  @Get("me/saved")
  getSaved(@CurrentUser() user: JwtUser) {
    return Promise.all([
      this.profiles.getSavedPostIds(user.sub),
      this.profiles.getSavedProductIds(user.sub),
      this.profiles.getBlockedUserIds(user.sub),
    ]).then(([postIds, productIds, blockedIds]) => ({ postIds, productIds, blockedIds }));
  }

  @Get("me/saved-posts")
  getSavedPosts(@CurrentUser() user: JwtUser) {
    return this.profiles.getSavedPostsFull(user.sub);
  }

  @Get("me/saved-products")
  getSavedProducts(@CurrentUser() user: JwtUser) {
    return this.profiles.getSavedProductsFull(user.sub);
  }

  @Post("me/save-post/:postId")
  toggleSavePost(@CurrentUser() user: JwtUser, @Param("postId") postId: string) {
    return this.profiles.toggleSavePost(user.sub, postId);
  }

  @Post("me/save-product/:productId")
  toggleSaveProduct(@CurrentUser() user: JwtUser, @Param("productId") productId: string) {
    return this.profiles.toggleSaveProduct(user.sub, productId);
  }

  @Patch("me/avatar")
  updateAvatar(@CurrentUser() user: JwtUser, @Body() body: { avatarUrl: string }) {
    return this.profiles.updateAvatar(user.sub, body.avatarUrl).then(() => ({ ok: true }));
  }

  @Get("search")
  search(@Query("q") q: string, @Query("limit") limit = "20") {
    return this.profiles.searchProfiles(q, Number(limit));
  }

  @Get("me/following-ids")
  getFollowingIds(@CurrentUser() user: JwtUser) {
    return this.profiles.getFollowingIds(user.sub);
  }

  @Get("by-ids")
  getByIds(@Query("ids") ids: string) {
    const idList = ids?.split(",").filter(Boolean) ?? [];
    return Promise.all(idList.map((id) => this.profiles.findById(id).catch(() => null)))
      .then((profiles) => profiles.filter(Boolean));
  }

  @Get(":id/follow-status")
  followStatus(@CurrentUser() user: JwtUser, @Param("id") targetId: string) {
    return this.profiles.isFollowing(user.sub, targetId).then((isFollowing) => ({ isFollowing }));
  }
}
