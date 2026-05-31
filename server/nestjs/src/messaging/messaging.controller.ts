import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, HttpCode } from "@nestjs/common";
import { MessagingService } from "./messaging.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser, JwtUser } from "../common/decorators/current-user.decorator";

@Controller("messaging")
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private messaging: MessagingService) {}

  @Get("conversations")
  getConversations(@CurrentUser() user: JwtUser) {
    return this.messaging.getConversations(user.sub);
  }

  @Post("conversations")
  createConversation(@CurrentUser() user: JwtUser, @Body() body: { peerId: string }) {
    return this.messaging.createConversation(user.sub, body.peerId);
  }

  @Get("conversations/:id/messages")
  getMessages(
    @Param("id") id: string,
    @CurrentUser() user: JwtUser,
    @Query("since") since?: string,
    @Query("limit") limit = "50"
  ) {
    return this.messaging.getMessages(id, user.sub, since, Number(limit));
  }

  @Post("conversations/:id/messages")
  sendMessage(@Param("id") id: string, @CurrentUser() user: JwtUser, @Body() body: { body: string; mediaUrl?: string }) {
    return this.messaging.sendMessage(id, user.sub, body.body, body.mediaUrl);
  }

  @Patch("conversations/:id/archive")
  @HttpCode(204)
  archive(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.messaging.archiveConversation(id, user.sub);
  }

  @Patch("conversations/:id/read")
  @HttpCode(204)
  markRead(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.messaging.markRead(id, user.sub);
  }

  @Get("conversations/:id/peer")
  getPeer(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.messaging.getPeer(id, user.sub);
  }

  @Patch("conversations/:id/participant")
  @HttpCode(204)
  updateParticipant(@Param("id") id: string, @CurrentUser() user: JwtUser, @Body() body: { pinned?: boolean; muted?: boolean; archived?: boolean }) {
    return this.messaging.updateParticipant(id, user.sub, body);
  }

  @Get("reactions")
  getReactions(@Query("ids") ids: string) {
    return this.messaging.getReactions(ids?.split(",").filter(Boolean) ?? []);
  }

  @Post("messages/:id/reactions")
  @HttpCode(204)
  toggleReaction(@Param("id") id: string, @CurrentUser() user: JwtUser, @Body() body: { emoji: string }) {
    return this.messaging.toggleReaction(id, user.sub, body.emoji);
  }

  @Get("conversations/:id/crm")
  getCRM(@Param("id") id: string, @CurrentUser() user: JwtUser) {
    return this.messaging.getCRMData(id, user.sub);
  }
}
