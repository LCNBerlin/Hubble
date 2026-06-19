import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { IsNumber, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { EventsService } from "./events.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

class CreateEventDto {
  @IsString() @MinLength(1) @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsNumber() date: number;
}

@Controller("events")
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private events: EventsService) {}

  @Get()
  getMyEvents(@CurrentUser() user: JwtUser) {
    return this.events.getForUser(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: CreateEventDto) {
    return this.events.create(user.sub, body);
  }
}
