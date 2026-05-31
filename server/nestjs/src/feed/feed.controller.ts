import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { FeedService } from "./feed.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("feed")
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private feed: FeedService) {}

  @Get()
  getRanked(
    @CurrentUser() user: JwtUser,
    @Query("limit") limit = "50",
    @Query("offset") offset = "0"
  ) {
    return this.feed.getRankedFeed(user.sub, Number(limit), Number(offset));
  }

  @Get("trending/posts")
  getTrendingPosts(
    @Query("hours") hours = "24",
    @Query("limit") limit = "50"
  ) {
    return this.feed.getTrendingPostIds(Number(hours), Number(limit));
  }

  @Get("trending/hashtags")
  getTrendingHashtags(
    @Query("days") days = "7",
    @Query("limit") limit = "20"
  ) {
    return this.feed.getTrendingHashtags(Number(days), Number(limit));
  }
}
