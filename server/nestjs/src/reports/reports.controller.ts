import { Controller, Post, Body, UseGuards, HttpCode } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Post()
  @HttpCode(204)
  create(
    @CurrentUser() user: JwtUser,
    @Body() body: { reportedId: string; reason: string }
  ) {
    return this.reports.create(user.sub, body.reportedId, body.reason);
  }
}
