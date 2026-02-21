import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Avatar } from "./ui";
import type { Product } from "../context/ContentContext";
import { rowToProduct } from "../lib/supabase-products";
import supabase from "../lib/supabase";
import type { ProfileRow } from "../lib/supabase-profiles";

const CREATOR_CARD_BG = "#2c1810";
const SOCIAL_BUTTON_BG = "#7c3aed";
const EMPTY_CARD_BG = "#3f3f46";
const POST_SNAPSHOT_LIMIT = 8;
const PRODUCT_SNAPSHOT_LIMIT = 5;

/** Renders the first frame of a video as a static snapshot (paused, no controls). */
function VideoSnapshot({ videoUri, style }: { videoUri: string; style: { width: number; height: number } }) {
  const player = useVideoPlayer(videoUri, (p) => {
    p.pause();
    p.currentTime = 0;
  });
  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export function FeedUserCard({
  creatorId,
  profile,
  cardWidth,
  itemHeight,
  onPressCreator,
  onPressPost,
}: {
  creatorId: string;
  profile: ProfileRow | null;
  cardWidth: number;
  itemHeight: number;
  onPressCreator: (userId: string) => void;
  /** When provided, tapping a post slot navigates to that post on the creator's profile. */
  onPressPost?: (creatorId: string, postId: string) => void;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<{ id: string; media_uri: string | null; type: string; title: string | null }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!supabase || !creatorId) return;
    supabase
      .from("posts")
      .select("id, media_uri, type, title")
      .eq("user_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(POST_SNAPSHOT_LIMIT)
      .then(({ data }) => {
        setPosts(
          (data ?? []).map((r: { id: string; media_uri: string | null; type: string; title: string | null }) => ({
            id: r.id,
            media_uri: r.media_uri,
            type: r.type ?? "blog",
            title: r.title ?? null,
          }))
        );
      });
  }, [creatorId]);

  useEffect(() => {
    if (!supabase || !creatorId) return;
    supabase
      .from("products")
      .select("*")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(PRODUCT_SNAPSHOT_LIMIT)
      .then(({ data }) => {
        setProducts((data ?? []).map((row: unknown) => rowToProduct(row as Parameters<typeof rowToProduct>[0])));
      });
  }, [creatorId]);

  const scale = 0.75;
  const padding = 12 * scale;
  const gridGap = 4 * scale;
  const cellsPerRow = 5;
  const rowCellSize = (cardWidth - padding * 2 - gridGap * (cellsPerRow - 1)) / cellsPerRow;
  const postRows = [posts.slice(0, 5), posts.slice(5, 10)];
  const productRow = products.slice(0, 5);

  const postTypeIcon = (type: string) => {
    switch (type) {
      case "video":
        return "videocam-outline";
      case "picture":
        return "image-outline";
      case "audio":
        return "musical-notes-outline";
      case "polls":
        return "stats-chart-outline";
      default:
        return "document-text-outline";
    }
  };

  const renderPostSlot = (
    item: { id: string; media_uri?: string | null; type?: string; title?: string | null } | undefined,
    index: number,
    keyPrefix: string,
    onPress: () => void
  ) => {
    const isEmpty = !item;
    const hasMedia = !isEmpty && !!item?.media_uri;
    const isVideo = !isEmpty && item?.type === "video" && !!item?.media_uri;
    const type = item?.type ?? "blog";
    const titleLine = item?.title?.trim().split(/\n/)[0]?.slice(0, 20) ?? "";
    const cellStyle = { width: rowCellSize, height: rowCellSize };
    return (
      <Pressable
        key={item ? item.id : `${keyPrefix}-empty-${index}`}
        onPress={onPress}
        style={{
          ...cellStyle,
          borderRadius: 8 * scale,
          backgroundColor: isEmpty ? EMPTY_CARD_BG : SOCIAL_BUTTON_BG,
          overflow: "hidden",
        }}
      >
        {isVideo ? (
          <VideoSnapshot videoUri={item!.media_uri!} style={cellStyle} />
        ) : hasMedia ? (
          <Image source={{ uri: item!.media_uri! }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : !isEmpty ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 4 * scale }}>
            <Ionicons name={postTypeIcon(type) as keyof typeof Ionicons.glyphMap} size={Math.round(22 * scale)} color="rgba(255,255,255,0.8)" />
            {titleLine ? (
              <Text numberOfLines={2} style={{ fontSize: 9 * scale, color: "rgba(255,255,255,0.9)", textAlign: "center", marginTop: 2 }}>
                {titleLine}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    );
  };

  const renderProductSlot = (
    item: Product | undefined,
    index: number,
    keyPrefix: string,
    onPress: () => void
  ) => {
    const isEmpty = !item;
    const imageUri = item?.coverUri ?? item?.mediaUri;
    const hasImage = !!imageUri;
    return (
      <Pressable
        key={item ? item.id : `${keyPrefix}-empty-${index}`}
        onPress={onPress}
        style={{
          width: rowCellSize,
          height: rowCellSize,
          borderRadius: 8 * scale,
          backgroundColor: isEmpty ? EMPTY_CARD_BG : SOCIAL_BUTTON_BG,
          overflow: "hidden",
        }}
      >
        {!isEmpty && hasImage ? (
          <Image source={{ uri: imageUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : !isEmpty ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 4 * scale }}>
            <Ionicons name="cube-outline" size={Math.round(22 * scale)} color="rgba(255,255,255,0.8)" />
            <Text numberOfLines={2} style={{ fontSize: 9 * scale, color: "rgba(255,255,255,0.9)", textAlign: "center", marginTop: 2 }}>
              {(item?.title ?? "").slice(0, 20)}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View
      style={{
        width: cardWidth,
        height: itemHeight,
        backgroundColor: CREATOR_CARD_BG,
        borderRadius: 12 * scale,
        overflow: "hidden",
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: "#a78bfa", fontSize: 12 * scale, fontWeight: "700", marginBottom: 8 * scale, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Profile Snapshot
        </Text>
        <Pressable onPress={() => onPressCreator(creatorId)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 * scale }}>
          <Avatar uri={profile?.avatar_url ?? null} size={Math.round(40 * scale)} />
          <View style={{ marginLeft: 10 * scale, flex: 1 }}>
            <Text style={{ color: "#fff", fontSize: 14 * scale, fontWeight: "600" }} numberOfLines={1}>
              {profile?.display_name ?? "Creator"}
            </Text>
            <Text style={{ color: "#a78bfa", fontSize: 11 * scale }} numberOfLines={1}>
              @{profile?.username ?? ""}
            </Text>
          </View>
        </Pressable>

        <Text style={{ color: "#a78bfa", fontSize: 11 * scale, fontWeight: "600", marginBottom: 4 * scale }}>Posts</Text>
        {postRows.map((row, rowIndex) => (
          <View key={`posts-${rowIndex}`} style={{ flexDirection: "row", gap: gridGap, marginBottom: rowIndex < postRows.length - 1 ? gridGap : 10 * scale }}>
            {Array.from({ length: cellsPerRow }, (_, colIndex) => {
              const post = row[colIndex];
              return renderPostSlot(
                post,
                colIndex,
                `posts-${rowIndex}`,
                () => (post && onPressPost ? onPressPost(creatorId, post.id) : onPressCreator(creatorId))
              );
            })}
          </View>
        ))}

        <Text style={{ color: "#a78bfa", fontSize: 11 * scale, fontWeight: "600", marginBottom: 4 * scale }}>Products</Text>
        <View style={{ flexDirection: "row", gap: gridGap }}>
          {Array.from({ length: cellsPerRow }, (_, colIndex) => {
            const product = productRow[colIndex];
            return renderProductSlot(
              product,
              colIndex,
              "products",
              () => product && router.push({ pathname: "/product/[id]", params: { id: product.id } })
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
