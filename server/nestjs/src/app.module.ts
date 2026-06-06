import { Module, Controller, Get } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { DatabaseModule } from "./common/database/database.module";
import { Public } from "./common/decorators/public.decorator";

@Controller("health")
class HealthController {
  @Public()
  @Get()
  check() {
    return { status: "ok" };
  }
}
import { RedisModule } from "./common/redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { StorageModule } from "./storage/storage.module";
import { FeedModule } from "./feed/feed.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { PaymentsModule } from "./payments/payments.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { CronModule } from "./cron/cron.module";
import { PostsModule } from "./posts/posts.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { MessagingModule } from "./messaging/messaging.module";
import { ProductsModule } from "./products/products.module";
import { OrdersModule } from "./orders/orders.module";
import { CommerceModule } from "./commerce/commerce.module";
import { EventsModule } from "./events/events.module";
import { ReportsModule } from "./reports/reports.module";
import { StoriesModule } from "./stories/stories.module";

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    DatabaseModule,
    RedisModule,
    AuthModule,
    StorageModule,
    FeedModule,
    AnalyticsModule,
    PaymentsModule,
    NotificationsModule,
    CronModule,
    PostsModule,
    ProfilesModule,
    MessagingModule,
    ProductsModule,
    OrdersModule,
    CommerceModule,
    EventsModule,
    ReportsModule,
    StoriesModule,
  ],
})
export class AppModule {}
