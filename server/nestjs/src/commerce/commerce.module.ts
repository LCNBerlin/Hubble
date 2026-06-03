import { Module } from "@nestjs/common";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { WishlistController } from "./wishlist.controller";
import { WishlistService } from "./wishlist.service";
import { StorageItemsController } from "./storage-items.controller";
import { StorageItemsService } from "./storage-items.service";
import { RevenueSplitsController } from "./revenue-splits.controller";
import { RevenueSplitsService } from "./revenue-splits.service";

@Module({
  controllers: [CartController, WishlistController, StorageItemsController, RevenueSplitsController],
  providers: [CartService, WishlistService, StorageItemsService, RevenueSplitsService],
})
export class CommerceModule {}
