import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DataSource } from "typeorm";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private db: DataSource, private notif: NotificationsService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async processCartReminders() {
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 86_400_000).toISOString();
    const carts = await this.db.query(
      `SELECT id, user_id, cart_snapshot FROM abandoned_carts
       WHERE updated_at >= $1 AND updated_at <= $2 AND reminder_sent_at IS NULL`,
      [twentyFourHoursAgo, oneHourAgo]
    );
    for (const cart of carts) {
      if (!cart.user_id) continue;
      await this.notif.insert(cart.user_id, "cart_reminder", undefined, "cart", undefined, { abandoned_cart_id: cart.id });
      await this.db.query(`UPDATE abandoned_carts SET reminder_sent_at = NOW() WHERE id = $1`, [cart.id]);
      const snapshot = Array.isArray(cart.cart_snapshot) ? cart.cart_snapshot : [];
      const productIds = [...new Set(snapshot.map((i: { productId?: string; product_id?: string }) => i.productId || i.product_id).filter(Boolean))];
      if (productIds.length > 0) {
        const products = await this.db.query(`SELECT id, creator_id FROM products WHERE id = ANY($1::uuid[])`, [productIds]);
        const creatorIds = [...new Set(products.map((p: { creator_id: string }) => p.creator_id).filter(Boolean))] as string[];
        for (const creatorId of creatorIds) {
          await this.notif.insert(creatorId, "abandoned_cart_creator", undefined, "cart", cart.id, { product_ids: productIds });
        }
      }
    }
    if (carts.length > 0) this.logger.log(`Cart reminders sent: ${carts.length}`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processAppointmentReminders() {
    const now = new Date().toISOString();
    const in24h = new Date(Date.now() + 86_400_000).toISOString();
    const appointments = await this.db.query(
      `SELECT a.id, a.client_id, a.creator_id, a.scheduled_at FROM appointments a
       WHERE a.scheduled_at >= $1 AND a.scheduled_at <= $2
       AND a.status IN ('pending', 'confirmed')
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.target_type = 'appointment' AND n.target_id = a.id AND n.type = 'appointment_reminder'
       )`,
      [now, in24h]
    );
    for (const apt of appointments) {
      await this.notif.insert(apt.client_id, "appointment_reminder", apt.creator_id, "appointment", apt.id, { scheduled_at: apt.scheduled_at });
    }
    if (appointments.length > 0) this.logger.log(`Appointment reminders sent: ${appointments.length}`);
  }
}
