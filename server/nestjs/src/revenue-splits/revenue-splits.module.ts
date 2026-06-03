import { Module } from "@nestjs/common";
import { RevenueSplitsController } from "./revenue-splits.controller";
import { RevenueSplitsService } from "./revenue-splits.service";

@Module({
  controllers: [RevenueSplitsController],
  providers: [RevenueSplitsService],
})
export class RevenueSplitsModule {}
