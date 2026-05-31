import { Module } from "@nestjs/common";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { WishlistController } from "./wishlist.controller";
import { WishlistService } from "./wishlist.service";
import { StorageItemsController } from "./storage-items.controller";
import { StorageItemsService } from "./storage-items.service";

@Module({
  controllers: [CartController, WishlistController, StorageItemsController],
  providers: [CartService, WishlistService, StorageItemsService],
})
export class CommerceModule {}
