import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Avatar, EmptyState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useNotificationsContext } from "../../context/NotificationsContext";
import { formatTimeAgo } from "../../lib/formatTimeAgo";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  type NotificationWithActor,
  type NotificationType,
} from "../../lib/notifications";

function getMessage(n: NotificationWithActor): string {
  const who = n.actor?.display_name || n.actor?.username || (n.actor_id ? "Someone" : null);
  const name = who ?? "Reminder";
  switch (n.type as NotificationType) {
    case "like":
      return `${name} liked your post`;
    case "comment":
      return `${name} commented on your post`;
    case "comment_reply":
      return `${name} replied to your comment`;
    case "comment_like":
      return `${name} liked your comment`;
    case "follow":
      return `${name} followed you`;
    case "repost":
      return `${name} reposted your post`;
    case "save_post":
      return `${name} saved your post`;
    case "mention":
      return `${name} mentioned you`;
    case "product_sale":
      return `New sale from ${name}`;
    case "product_review":
      return `${name} left a review on your product`;
    case "order_shipped":
      return "Your order has shipped";
    case "tracking_updated":
      return "Your order tracking was updated";
    case "delivery_confirmed":
      return `${name} confirmed delivery`;
    case "order_refunded":
      return "Your order was refunded";
    case "order_disputed":
      return "Your order was disputed";
    case "tip_received":
      return who ? `You received a tip from ${name}` : "You received a tip";
    case "cart_reminder":
      return "You left items in your cart";
    case "abandoned_cart_creator":
      return "Someone had your product in their cart";
    case "booking":
      return `${name} booked an appointment`;
    case "appointment_reminder":
      return who ? `Reminder: appointment with ${name}` : "Appointment reminder";
    default:
      return "New activity";
  }
}

function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationWithActor;
  onPress: () => void;
}) {
  const avatarUri = item.actor?.avatar_url ?? null;
  const isUnread = !item.read_at;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`flex-row items-center gap-3 border-b border-zinc-800 px-4 py-3 ${isUnread ? "bg-zinc-800/50" : ""}`}
    >
      <Avatar uri={avatarUri} size={44} />
      <View className="flex-1 min-w-0">
        <Text className="text-zinc-100 text-sm" numberOfLines={2}>
          {getMessage(item)}
        </Text>
        <Text className="text-zinc-500 text-xs mt-0.5">{formatTimeAgo(item.created_at)}</Text>
      </View>
      {isUnread && (
        <View className="w-2 h-2 rounded-full bg-violet-500" />
      )}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { refresh: refreshUnread } = useNotificationsContext();
  const [list, setList] = useState<NotificationWithActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) {
      setList([]);
      setLoading(false);
      return;
    }
    const data = await getNotifications(user.id);
    setList(data);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeToNotifications(user.id, load);
    return unsubscribe;
  }, [user?.id, load]);

  // Refetch when user opens the Notifications tab so new DB rows show up
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        load();
        refreshUnread();
      }
    }, [user?.id, load, refreshUnread])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    refreshUnread();
  }, [load, refreshUnread]);

  const handleMarkAllRead = useCallback(async () => {
    if (!user?.id) return;
    await markAllNotificationsRead(user.id);
    await load();
    refreshUnread();
  }, [user?.id, load, refreshUnread]);

  const handlePress = useCallback(
    async (item: NotificationWithActor) => {
      if (!user?.id) return;
      await markNotificationRead(item.id, user.id);
      refreshUnread();
      setList((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n))
      );

      const postId = item.target_type === "post" ? item.target_id : (item.metadata as { post_id?: string } | null)?.post_id;
      const creatorId = item.target_user_id ?? item.actor_id;

      switch (item.type) {
        case "follow":
          if (item.actor_id) router.push({ pathname: "/creator/[id]", params: { id: item.actor_id } });
          return;
        case "comment_reply":
        case "comment_like":
        case "comment":
        case "like":
        case "repost":
        case "save_post":
        case "mention":
          if (item.target_type === "post" && item.target_id && creatorId) {
            router.push({ pathname: "/creator/[id]", params: { id: creatorId, postId: item.target_id } });
          } else if (postId && creatorId) {
            router.push({ pathname: "/creator/[id]", params: { id: creatorId, postId } });
          } else if (item.actor_id) {
            router.push({ pathname: "/creator/[id]", params: { id: item.actor_id } });
          }
          return;
        case "product_sale":
        case "product_review":
        case "delivery_confirmed":
        case "order_refunded":
        case "order_disputed":
          router.push("/orders");
          return;
        case "order_shipped":
        case "tracking_updated":
          router.push("/orders");
          return;
        case "tip_received":
          if (postId && creatorId) router.push({ pathname: "/creator/[id]", params: { id: creatorId, postId } });
          else if (creatorId) router.push({ pathname: "/creator/[id]", params: { id: creatorId } });
          return;
        case "cart_reminder":
          router.push("/(tabs)/cart");
          return;
        case "abandoned_cart_creator":
          router.push("/(tabs)/marketplace");
          return;
        case "booking":
        case "appointment_reminder":
          router.push("/orders");
          return;
        default:
          if (item.target_type === "post" && item.target_id && creatorId) {
            router.push({ pathname: "/creator/[id]", params: { id: creatorId, postId: item.target_id } });
          }
      }
    },
    [user?.id, router, refreshUnread]
  );

  if (!user) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <Text className="text-zinc-500">Sign in to see notifications.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
        <Text className="text-lg font-semibold text-zinc-100">Notifications</Text>
        {list.some((n) => !n.read_at) && (
          <TouchableOpacity onPress={handleMarkAllRead} className="py-1 px-3">
            <Text className="text-sm text-violet-400 font-medium">Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      {list.length === 0 ? (
        <View className="flex-1 justify-center px-8">
          <EmptyState
            icon="notifications-outline"
            message="No notifications yet"
            detail="Likes, comments, orders, tips, and more will show here."
          />
          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-6 self-center rounded-xl bg-zinc-700 px-6 py-3"
          >
            <Text className="text-zinc-200 font-medium">Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationRow item={item} onPress={() => handlePress(item)} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#a78bfa"
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}
