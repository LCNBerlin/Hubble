import { Global, Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createKeyv } from "@keyv/redis";
import { RedisService } from "./redis.service";

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get<string>("REDIS_URL");
        if (!redisUrl) {
          console.warn("[Redis] REDIS_URL not set — caching disabled, using in-memory fallback");
          return { ttl: 30_000 };
        }
        return {
          stores: [createKeyv(redisUrl)],
          ttl: 30_000,
        };
      },
    }),
  ],
  providers: [RedisService],
  exports: [RedisService, CacheModule],
})
export class RedisModule {}
