import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode } from "@nestjs/common";
import { PostsService } from "./posts.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("posts")
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private posts: PostsService) {}

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
  create(@CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.posts.create(user.sub, body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @CurrentUser() user: JwtUser, @Body() body: Record<string, unknown>) {
    return this.posts.update(id, user.sub, body);
  }

  @Delete(":id")
  @HttpCode(204)
  delete(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.posts.delete(id, user.sub);
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
  getComments(@Param("id") id: string) {
    return this.posts.getComments(id);
  }

  @Post(":id/comments")
  addComment(@Param("id") id: string, @CurrentUser() user: JwtUser, @Body() body: { body: string; parentId?: string }) {
    return this.posts.addComment(id, user.sub, body.body, body.parentId);
  }
}
