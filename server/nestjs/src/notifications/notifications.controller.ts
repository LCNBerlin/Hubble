import { Controller, Get, Post, Patch, Body, Headers, Query, UseGuards, HttpCode, UnauthorizedException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  getNotifications(
    @CurrentUser() user: JwtUser,
    @Query("since") since?: string,
    @Query("unreadOnly") unreadOnly?: string
  ) {
    return this.notifications.getForUser(user.sub, since, unreadOnly === "true");
  }

  @Get("unread-count")
  getUnreadCount(@CurrentUser() user: JwtUser) {
    return this.notifications.getUnreadCount(user.sub).then((count) => ({ count }));
  }

  @Patch("read")
  @HttpCode(204)
  markRead(@CurrentUser() user: JwtUser, @Body() body: { ids: string[] }) {
    return this.notifications.markRead(user.sub, body.ids);
  }

  @Patch("read-all")
  @HttpCode(204)
  markAllRead(@CurrentUser() user: JwtUser) {
    return this.notifications.markAllRead(user.sub);
  }

  @Post("push-token")
  @HttpCode(204)
  upsertPushToken(@CurrentUser() user: JwtUser, @Body() body: { token: string }) {
    return this.notifications.upsertPushToken(user.sub, body.token);
  }

  @Public()
  @Post("webhook/notification-created")
  async webhookNotificationCreated(
    @Headers("x-webhook-secret") secret: string,
    @Body() body: { type: string; table: string; record: { id: string; recipient_id: string; type: string } }
  ) {
    const expected = process.env.WEBHOOK_SECRET;
    if (!expected || secret !== expected) throw new UnauthorizedException("Invalid webhook secret");
    const { type, table, record } = body || {};
    if (type !== "INSERT" || table !== "notifications" || !record?.recipient_id) return { ok: false };
    await this.notifications.sendPush(record.recipient_id, record.type, record.id);
    return { ok: true };
  }
}
