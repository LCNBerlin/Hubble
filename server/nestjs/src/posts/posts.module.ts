import { Module } from "@nestjs/common";
import { PostsController } from "./posts.controller";
import { PostsService } from "./posts.service";
import { FeedModule } from "../feed/feed.module";

@Module({
  imports: [FeedModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
