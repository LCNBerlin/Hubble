import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode } from "@nestjs/common";
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { PostsService } from "./posts.service";
import { FeedService } from "../feed/feed.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

class AddCommentDto {
  @IsString() @MinLength(1) @MaxLength(5000) body: string;
  @IsOptional() @IsUUID() parentId?: string;
}

@Controller("posts")
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private posts: PostsService, private feed: FeedService) {}

  @Get("search")
  search(@Query("q") q: string, @Query("limit") limit = "20") {
    return this.posts.search(q, Number(limit));
  }

  @Get("by-user/:userId")
  getByUser(@Param("userId") userId: string, @CurrentUser() user: JwtUser) {
    return this.posts.getByUser(userId, user.sub);
  }

  @Get("by-hashtag/:name")
  getByHashtag(@Param("name") name: string, @Query("limit") limit = "50", @Query("offset") offset = "0") {
    return this.posts.getByHashtag(name, Number(limit), Number(offset));
  }

  @Get("engagement")
  getEngagement(@Query("ids") ids: string, @CurrentUser() user: JwtUser) {
    const postIds = ids?.split(",").filter(Boolean) ?? [];
    return Promise.all([
      this.posts.getEngagement(postIds),
      this.posts.getUserEngagement(postIds, user.sub),
    ]).then(([counts, userState]) => ({ counts, userState }));
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.posts.getById(id);
  }

  @Post()
  async create(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    const post = await this.posts.create(user.sub, body);
    await this.feed.invalidateFeedCache(user.sub);
    return post;
  }

  @Patch(":id")
  update(@Param("id") id: string, @CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.posts.update(id, user.sub, body);
  }

  @Delete(":id")
  @HttpCode(204)
  async delete(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    await this.posts.delete(id, user.sub);
    await this.feed.invalidateFeedCache(user.sub);
  }

  @Post(":id/like")
  toggleLike(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.posts.toggleLike(id, user.sub);
  }

  @Post(":id/repost")
  toggleRepost(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.posts.toggleRepost(id, user.sub);
  }

  @Get(":id/comments")
  getComments(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.posts.getComments(id, user.sub);
  }

  @Post(":id/comments")
  addComment(@Param("id") id: string, @CurrentUser() user: JwtUser, @Body() body: AddCommentDto) {
    return this.posts.addComment(id, user.sub, body.body, body.parentId);
  }

  @Post(":id/comments/:commentId/like")
  toggleCommentLike(@Param("commentId") commentId: string, @CurrentUser() user: JwtUser) {
    return this.posts.toggleCommentLike(commentId, user.sub);
  }

  @Post(":id/comments/:commentId/dislike")
  toggleCommentDislike(@Param("commentId") commentId: string, @CurrentUser() user: JwtUser) {
    return this.posts.toggleCommentDislike(commentId, user.sub);
  }

  @Get(":id/hashtags")
  getHashtags(@Param("id") id: string) {
    return this.posts.getHashtags(id);
  }

  @Post(":id/hashtags")
  @HttpCode(204)
  syncHashtags(@Param("id") id: string, @Body() body: { tagNames: string[] }) {
    return this.posts.syncHashtags(id, body.tagNames ?? []);
  }
}
