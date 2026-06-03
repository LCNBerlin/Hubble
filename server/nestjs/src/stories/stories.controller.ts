import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { StoriesService } from "./stories.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";

@Controller("stories")
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private stories: StoriesService) {}

  @Get("by-user/:userId")
  getByUser(@Param("userId") userId: string) {
    return this.stories.getByUser(userId);
  }
}
