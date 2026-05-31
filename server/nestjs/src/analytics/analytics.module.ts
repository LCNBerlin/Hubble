import { Module } from "@nestjs/common";
import { EngagementController } from "./engagement.controller";
import { EngagementService } from "./engagement.service";
import { IncomeController } from "./income.controller";
import { IncomeService } from "./income.service";

@Module({
  controllers: [EngagementController, IncomeController],
  providers: [EngagementService, IncomeService],
})
export class AnalyticsModule {}
