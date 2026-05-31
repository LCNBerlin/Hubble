import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { StorageItemsService } from "./storage-items.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("storage")
@UseGuards(JwtAuthGuard)
export class StorageItemsController {
  constructor(private storage: StorageItemsService) {}

  @Get("items")
  getItems(@CurrentUser() user: JwtUser, @Query("view") view = "all") {
    return this.storage.getStorageItems(user.sub, view);
  }
}
