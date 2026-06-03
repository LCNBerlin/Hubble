import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode } from "@nestjs/common";
import { RevenueSplitsService } from "./revenue-splits.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("revenue-splits")
@UseGuards(JwtAuthGuard)
export class RevenueSplitsController {
  constructor(private svc: RevenueSplitsService) {}

  @Get()
  getByOwner(@CurrentUser() user: JwtUser, @Query("targetType") targetType: string) {
    return this.svc.getByOwner(user.sub, targetType ?? "product");
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: { partnerId: string; targetType: string; targetId: string; splitPercent: number }) {
    return this.svc.create(user.sub, body);
  }

  @Delete("by-target")
  @HttpCode(204)
  deleteByTarget(
    @CurrentUser() user: JwtUser,
    @Query("targetType") targetType: string,
    @Query("targetId") targetId: string
  ) {
    return this.svc.deleteByTarget(user.sub, targetType, targetId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @CurrentUser() user: JwtUser, @Body() body: { splitPercent: number }) {
    return this.svc.update(id, user.sub, body.splitPercent);
  }

  @Delete(":id")
  @HttpCode(204)
  delete(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.svc.delete(id, user.sub);
  }
}
