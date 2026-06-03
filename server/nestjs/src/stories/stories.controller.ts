import { Controller, Get, Post, Param, Body, UseGuards, HttpCode } from "@nestjs/common";
import { StoriesService } from "./stories.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("stories")
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private stories: StoriesService) {}

  @Get("by-user/:userId")
  getByUser(@Param("userId") userId: string) {
    return this.stories.getByUser(userId);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: JwtUser, @Body() body: { mediaUri: string; type?: string }) {
    return this.stories.create(user.sub, body);
  }
}
