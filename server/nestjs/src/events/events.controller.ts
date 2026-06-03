import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { EventsService } from "./events.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("events")
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private events: EventsService) {}

  @Get()
  getMyEvents(@CurrentUser() user: JwtUser) {
    return this.events.getForUser(user.sub);
  }

  @Post()
  create(
    @CurrentUser() user: JwtUser,
    @Body() body: { title: string; description?: string; date: number }
  ) {
    return this.events.create(user.sub, body);
  }
}
