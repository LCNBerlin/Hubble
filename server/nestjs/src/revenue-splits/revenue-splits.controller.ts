import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode } from "@nestjs/common";
import { RevenueSplitsService } from "./revenue-splits.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("revenue-splits")
@UseGuards(JwtAuthGuard)
export class RevenueSplitsController {
  constructor(private splits: RevenueSplitsService) {}

  @Get()
  getForOwner(@Query("ownerId") ownerId: string, @Query("targetType") targetType: string) {
    return this.splits.getForOwner(ownerId, targetType);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: { partnerId: string; targetType: string; targetId: string; splitPercent: number }) {
    return this.splits.create(user.sub, body.partnerId, body.targetType, body.targetId, body.splitPercent);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: { splitPercent: number }) {
    return this.splits.update(id, body.splitPercent);
  }

  @Delete("by-target")
  @HttpCode(204)
  deleteByTarget(@CurrentUser() user: JwtUser, @Query("targetType") targetType: string, @Query("targetId") targetId: string) {
    return this.splits.deleteByTarget(user.sub, targetType, targetId);
  }

  @Delete(":id")
  @HttpCode(204)
  deleteById(@Param("id") id: string) {
    return this.splits.deleteById(id);
  }
}
