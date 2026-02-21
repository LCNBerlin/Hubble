import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { PostCard } from "../../components/PostCard";
import { ProductCard } from "../../components/ProductCard";
import { useAuth } from "../../context/AuthContext";
import type { Post as PostType, Product } from "../../context/ContentContext";
import { useContent } from "../../context/ContentContext";
import { useProfile } from "../../context/ProfileContext";
import { usePostLikes } from "../../hooks/usePostLikes";
import { CREATOR_AVATAR } from "../../lib/constants";
import supabase from "../../lib/supabase";
import { rowToProduct } from "../../lib/supabase-products";
import type { PostRow, ProfileRow } from "../../lib/supabase-profiles";

const POST_GRID_COLUMNS = 4;
const CAROUSEL_THRESHOLD = 4;
const TILE_DESCRIPTION_MAX_CHARS = 50;

function formatMemberSince(createdAt: string): string {
  const d = new Date(createdAt);
  const month = d.toLocaleString("default", { month: "short" });
  const year = d.getFullYear();
  return `Member since ${month} ${year}`;
}

function PostGridTile({
  post,
  onPress,
}: {
  post: PostType;
  onPress: () => void;
}) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const hasMedia = !!post.mediaUri;
  const isPicture = post.type === "picture" && hasMedia;
  const isVideo = post.type === "video" && hasMedia;
  const hasVideoThumbnail = isVideo && !!post.thumbnailUri;
  const isBlogLike = post.type === "blog" || post.type === "audio" || post.type === "polls";
  const hasDescription = !!(post.title || post.body);
  const body = post.body ?? "";
  const showDescriptionOverlay = (isPicture || isVideo) && hasDescription;
  const videoPlayer = useVideoPlayer(
    isVideo && !hasVideoThumbnail && post.mediaUri ? post.mediaUri : null,
    () => {}
  );
  const thumbnailUri = post.thumbnailUri;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className="rounded-xl border border-zinc-700 bg-zinc-800/80 overflow-hidden w-full h-full"
    >
      {isPicture && post.mediaUri ? (
        <View className="w-full h-full">
          <Image
            source={{ uri: post.mediaUri }}
            className="w-full h-full"
            contentFit="cover"
          />
          {showDescriptionOverlay && (
            <View className="absolute bottom-0 left-0 right-0 pt-4 pb-2 px-2">
              {post.title ? (
                <Text className="text-xs font-semibold text-white mb-0.5" numberOfLines={1}>
                  {post.title}
                </Text>
              ) : null}
              {(post.body ?? "").length > 0 ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    if (body.length > TILE_DESCRIPTION_MAX_CHARS) setDescriptionExpanded((prev) => !prev);
                  }}
                >
                  <Text className="text-[10px] text-zinc-200" numberOfLines={descriptionExpanded ? undefined : 2}>
                    {descriptionExpanded || body.length <= TILE_DESCRIPTION_MAX_CHARS
                      ? body
                      : `${body.slice(0, TILE_DESCRIPTION_MAX_CHARS).trim()}...`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      ) : isVideo && (hasVideoThumbnail ? thumbnailUri : post.mediaUri) ? (
        <View className="w-full h-full bg-black">
          {hasVideoThumbnail && thumbnailUri ? (
            <Image
              source={{ uri: thumbnailUri }}
              className="w-full h-full"
              contentFit="cover"
            />
          ) : (
            <VideoView
              player={videoPlayer}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              nativeControls={false}
            />
          )}
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <View className="rounded-full bg-black/50 p-2">
              <Ionicons name="play" size={24} color="#fff" />
            </View>
          </View>
          {showDescriptionOverlay && (
            <View className="absolute bottom-0 left-0 right-0 pt-4 pb-2 px-2" pointerEvents="box-none">
              {post.title ? (
                <Text className="text-xs font-semibold text-white mb-0.5" numberOfLines={1}>
                  {post.title}
                </Text>
              ) : null}
              {(post.body ?? "").length > 0 ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    if (body.length > TILE_DESCRIPTION_MAX_CHARS) setDescriptionExpanded((prev) => !prev);
                  }}
                >
                  <Text className="text-[10px] text-zinc-200" numberOfLines={descriptionExpanded ? undefined : 2}>
                    {descriptionExpanded || body.length <= TILE_DESCRIPTION_MAX_CHARS
                      ? body
                      : `${body.slice(0, TILE_DESCRIPTION_MAX_CHARS).trim()}...`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      ) : post.type === "audio" && thumbnailUri ? (
        <View className="w-full h-full">
          <Image
            source={{ uri: thumbnailUri }}
            className="w-full h-full"
            contentFit="cover"
          />
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <View className="rounded-full bg-black/50 p-2">
              <Ionicons name="musical-notes" size={24} color="#fff" />
            </View>
          </View>
          {(post.title || post.body) && (
            <View className="absolute bottom-0 left-0 right-0 pt-4 pb-2 px-2" pointerEvents="box-none">
              {post.title ? (
                <Text className="text-xs font-semibold text-white mb-0.5" numberOfLines={1}>
                  {post.title}
                </Text>
              ) : null}
              {(post.body ?? "").length > 0 ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    if (body.length > TILE_DESCRIPTION_MAX_CHARS) setDescriptionExpanded((prev) => !prev);
                  }}
                >
                  <Text className="text-[10px] text-zinc-200" numberOfLines={descriptionExpanded ? undefined : 2}>
                    {descriptionExpanded || body.length <= TILE_DESCRIPTION_MAX_CHARS
                      ? body
                      : `${body.slice(0, TILE_DESCRIPTION_MAX_CHARS).trim()}...`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      ) : (
        <View className="w-full h-full bg-zinc-700 items-center justify-center px-2">
          <Ionicons
            name={post.type === "blog" ? "document-text" : post.type === "audio" ? "musical-notes" : "stats-chart"}
            size={32}
            color="#71717a"
          />
          <Text className="text-xs text-zinc-500 mt-1" numberOfLines={1}>
            {post.title || (post.type === "blog" ? "Blog" : post.type === "audio" ? "Audio" : "Polls")}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const TABS = [
  { id: "posts" as const, label: "Posts" },
  { id: "products" as const, label: "Products" },
  { id: "saved" as const, label: "Saved" },
];

const PRODUCT_CAROUSEL_CARD_WIDTH = 200;
type SeeAllProductCategory = "featured" | "digital" | "physical" | "services" | "memberships" | null;

function CreatorProductsSection({
  products,
  updateProduct,
  onSeeAllCategory,
  seeAllProductCategory,
  onCloseSeeAll,
}: {
  products: Product[];
  updateProduct: (id: string, updates: Partial<Product>) => void;
  onSeeAllCategory: (cat: SeeAllProductCategory) => void;
  seeAllProductCategory: SeeAllProductCategory;
  onCloseSeeAll: () => void;
}) {
  const router = useRouter();
  const digitalProducts = products.filter((p) => p.type === "digital");
  const physicalProducts = products.filter((p) => p.type === "physical");
  const pinned = products.filter((p) => p.pinned);
  const services = products.filter((p) => p.type === "services");
  const memberships = products.filter((p) => p.type === "membership");

  const renderProductCarousel = (
    list: Product[],
    sectionTitle: string,
    emptyLabel: string,
    productCategory: SeeAllProductCategory
  ) => {
    if (list.length === 0) {
      return (
        <View key={sectionTitle} className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{sectionTitle}</Text>
          </View>
          <View className="rounded-xl border border-dashed border-zinc-700 py-4">
            <Text className="text-center text-sm text-zinc-500">{emptyLabel}</Text>
          </View>
        </View>
      );
    }
    return (
      <View key={sectionTitle} className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{sectionTitle}</Text>
          <TouchableOpacity onPress={() => onSeeAllCategory(productCategory)} className="py-1 px-2">
            <Text className="text-xs font-medium text-violet-400">See all ({list.length})</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingRight: 16 }}
        >
          {list.map((p) => (
            <View key={p.id} style={{ width: PRODUCT_CAROUSEL_CARD_WIDTH }}>
              <ProductCard
                product={p}
                showCreatorHeader
                onPin={() => updateProduct(p.id, { pinned: !p.pinned })}
                isPinned={p.pinned}
                onCheckout={() => {}}
                onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const seeAllProductData =
    seeAllProductCategory === "featured"
      ? pinned
      : seeAllProductCategory === "digital"
        ? digitalProducts
        : seeAllProductCategory === "physical"
          ? physicalProducts
          : seeAllProductCategory === "services"
            ? services
            : seeAllProductCategory === "memberships"
              ? memberships
              : [];
  const seeAllProductTitle =
    seeAllProductCategory === "featured"
      ? "Featured"
      : seeAllProductCategory === "digital"
        ? "Digital"
        : seeAllProductCategory === "physical"
          ? "Physical"
          : seeAllProductCategory === "services"
            ? "Services"
            : seeAllProductCategory === "memberships"
              ? "Memberships"
              : "";

  return (
    <View className="gap-4">
      <Pressable onPress={() => router.push("/(tabs)/create")} className="flex-row items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-4">
        <Text className="text-base font-medium text-zinc-100">Products</Text>
        <View className="h-8 w-8 items-center justify-center rounded-full bg-zinc-600">
          <Text className="text-lg font-semibold text-zinc-200">+</Text>
        </View>
      </Pressable>

      {pinned.length > 0 && (
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Featured</Text>
            <TouchableOpacity onPress={() => onSeeAllCategory("featured")} className="py-1 px-2">
              <Text className="text-xs font-medium text-violet-400">See all ({pinned.length})</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
            {pinned.map((p) => (
              <View key={p.id} style={{ width: PRODUCT_CAROUSEL_CARD_WIDTH }}>
                <ProductCard
                  product={p}
                  showCreatorHeader
                  onPin={() => updateProduct(p.id, { pinned: !p.pinned })}
                  isPinned
                  onCheckout={() => {}}
                  onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {renderProductCarousel(digitalProducts, "Digital", "No digital products yet.", "digital")}
      {renderProductCarousel(physicalProducts, "Physical", "No physical products yet.", "physical")}
      {renderProductCarousel(services, "Services", "No services yet.", "services")}
      {renderProductCarousel(memberships, "Memberships", "No memberships yet.", "memberships")}

      <Modal visible={!!seeAllProductCategory} transparent animationType="slide">
        <View className="flex-1 bg-black/70 justify-end">
          <Pressable className="flex-1" onPress={onCloseSeeAll} />
          <View className="bg-zinc-900 rounded-t-2xl border-t border-zinc-700 max-h-[85%]">
            <View className="flex-row items-center justify-between border-b border-zinc-700 px-4 py-3">
              <Text className="text-base font-semibold text-zinc-100">{seeAllProductTitle}</Text>
              <TouchableOpacity onPress={onCloseSeeAll} className="p-2">
                <Ionicons name="close" size={24} color="#71717a" />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="gap-3">
                {seeAllProductData.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    showCreatorHeader
                    onPin={() => updateProduct(p.id, { pinned: !p.pinned })}
                    isPinned={p.pinned}
                    onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                    onCheckout={() => {}}
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type PostWithDate = PostType & { createdAt?: string };

export default function CreatorProfileScreen() {
  const { id, postId: postIdParam } = useLocalSearchParams<{ id: string; postId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { height: windowHeight } = useWindowDimensions();
  const { isFollowing, follow, unfollow, setViewedUser } = useProfile();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "products" | "saved">("posts");
  const [seeAllCategory, setSeeAllCategory] = useState<"blogs" | "videos" | "photos" | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostWithDate | null>(null);
  const [focusedPostDetailIndex, setFocusedPostDetailIndex] = useState(0);
  const [seeAllProductCategory, setSeeAllProductCategory] = useState<"featured" | "digital" | "physical" | "services" | "memberships" | null>(null);
  const [creatorProducts, setCreatorProducts] = useState<Product[]>([]);

  const postDetailViewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;
  const onPostDetailViewableItemsChanged = useCallback(
    (info: { viewableItems: Array<{ index: number | null }> }) => {
      const first = info.viewableItems[0];
      const idx = first?.index;
      if (idx != null) setFocusedPostDetailIndex(idx);
    },
    []
  );

  const { updateProduct } = useContent();

  useEffect(() => {
    if (id && user?.id && id !== user.id) setViewedUser(id);
    return () => setViewedUser(null);
  }, [id, user?.id, setViewedUser]);

  const fetchProfileAndPosts = useCallback(async () => {
    if (!supabase || !id) return;
    const [profileRes, postsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).single(),
      supabase.from("posts").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (profileRes.data) setProfile(profileRes.data as ProfileRow);
    else setProfile(null);
    if (postsRes.data) setPosts((postsRes.data as PostRow[]) ?? []);
    else setPosts([]);
  }, [id]);

  const fetchCreatorProducts = useCallback(async () => {
    if (!supabase || !id) return;
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("creator_id", id)
      .order("created_at", { ascending: false });
    if (data) {
      setCreatorProducts(data.map((row: unknown) => rowToProduct(row as Parameters<typeof rowToProduct>[0])));
    } else setCreatorProducts([]);
  }, [id]);

  const load = useCallback(async () => {
    await Promise.all([fetchProfileAndPosts(), fetchCreatorProducts()]);
  }, [fetchProfileAndPosts, fetchCreatorProducts]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleFollow = useCallback(async () => {
    if (!user || !id || followLoading) return;
    setFollowLoading(true);
    if (isFollowing) {
      await unfollow();
      if (profile) setProfile({ ...profile, followers_count: Math.max(0, profile.followers_count - 1) });
    } else {
      await follow();
      if (profile) setProfile({ ...profile, followers_count: profile.followers_count + 1 });
    }
    setFollowLoading(false);
  }, [user?.id, id, isFollowing, follow, unfollow, profile, followLoading]);

  const postIds = posts.map((p) => p.id);
  const { getState: getLikeState, toggleLike } = usePostLikes(postIds);

  const postsAsContent: PostWithDate[] = useMemo(
    () =>
      posts.map((row) => ({
        id: row.id,
        type: row.type as PostType["type"],
        title: row.title ?? "",
        body: row.body ?? undefined,
        mediaUri: row.media_uri ?? undefined,
        createdAt: row.created_at ?? undefined,
        pollOptions: Array.isArray(row.poll_options) ? row.poll_options : undefined,
        thumbnailUri: row.thumbnail_uri ?? undefined,
      })),
    [posts]
  );

  useEffect(() => {
    if (!postIdParam || loading || posts.length === 0) return;
    const post = postsAsContent.find((p) => p.id === postIdParam);
    if (post) setSelectedPost(post);
  }, [postIdParam, loading, posts.length, postsAsContent]);

  const blogs = useMemo(() => postsAsContent.filter((p) => p.type === "blog" || p.type === "audio" || p.type === "polls"), [postsAsContent]);
  const videos = useMemo(() => postsAsContent.filter((p) => p.type === "video"), [postsAsContent]);
  const photos = useMemo(() => postsAsContent.filter((p) => p.type === "picture"), [postsAsContent]);

  const screenWidth = Dimensions.get("window").width;
  const postTileSize = (screenWidth - 16 * 2 - 6 * 3) / POST_GRID_COLUMNS;

  const postDetailScrollList = selectedPost
    ? selectedPost.type === "video"
      ? videos
      : selectedPost.type === "picture"
        ? photos
        : blogs
    : [];
  const postDetailInitialIndex =
    selectedPost && postDetailScrollList.length > 0
      ? Math.max(0, postDetailScrollList.findIndex((p) => p.id === selectedPost.id))
      : 0;

  useEffect(() => {
    if (selectedPost && postDetailScrollList.length > 0) {
      const idx = postDetailScrollList.findIndex((p) => p.id === selectedPost.id);
      if (idx >= 0) setFocusedPostDetailIndex(idx);
    }
  }, [selectedPost?.id, postDetailScrollList.length]);

  const displayNameFallback = profile?.display_name ?? "Creator";
  const usernameFallback = profile?.username ?? "";
  const avatarUriFallback = profile?.avatar_url ?? null;

  const renderPostDetailCard = useCallback(
    (p: PostWithDate, options: { shouldPlayVideo: boolean }) => (
      <PostCard
        key={p.id}
        post={{
          id: p.id,
          type: p.type,
          title: p.title ?? null,
          body: p.body ?? null,
          mediaUri: p.mediaUri ?? null,
          createdAt: p.createdAt ?? undefined,
          pollOptions: p.pollOptions,
        }}
        creator={{ id: id ?? "", displayName: displayNameFallback, username: usernameFallback, avatarUri: avatarUriFallback }}
        onPressCreator={() => {}}
        onLike={() => toggleLike(p.id)}
        isLiked={getLikeState(p.id).isLiked}
        likeCount={getLikeState(p.id).likeCount}
        showSave={false}
        layout="reels"
        fillContainer
        shouldPlayVideo={options.shouldPlayVideo}
      />
    ),
    [id, displayNameFallback, usernameFallback, avatarUriFallback, toggleLike, getLikeState]
  );

  if (!id) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <Text className="text-zinc-500">Invalid creator</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 px-4 py-2 bg-violet-600 rounded-lg">
          <Text className="text-white">Go back</Text>
        </TouchableOpacity>
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

  if (!profile) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center px-4">
        <Text className="text-zinc-500 text-center">Profile not found</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 px-4 py-2 bg-violet-600 rounded-lg">
          <Text className="text-white">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = profile.display_name ?? "Creator";
  const username = profile.username ?? "";
  const avatarUri = profile.avatar_url ?? null;
  const isOwnProfile = user?.id === id;

  const renderCategorySection = (
    data: PostType[],
    emptyLabel: string,
    category: "blogs" | "videos" | "photos",
    sectionTitle: string
  ) => {
    if (data.length === 0) {
      return (
        <View key={sectionTitle} className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{sectionTitle}</Text>
          </View>
          <View className="rounded-xl border border-dashed border-zinc-700 py-4">
            <Text className="text-center text-sm text-zinc-500">{emptyLabel}</Text>
          </View>
        </View>
      );
    }
    const useCarousel = data.length > CAROUSEL_THRESHOLD;
    return (
      <View key={sectionTitle} className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{sectionTitle}</Text>
          <TouchableOpacity onPress={() => setSeeAllCategory(category)} className="py-1 px-2">
            <Text className="text-xs font-medium text-violet-400">See all ({data.length})</Text>
          </TouchableOpacity>
        </View>
        {useCarousel ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 16 }}
          >
            {data.map((item) => (
              <View key={item.id} style={{ width: postTileSize, height: postTileSize }}>
                <PostGridTile post={item} onPress={() => setSelectedPost(item)} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {data.map((item) => (
              <View key={item.id} style={{ width: postTileSize, height: postTileSize }}>
                <PostGridTile post={item} onPress={() => setSelectedPost(item)} />
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const seeAllData = seeAllCategory === "blogs" ? blogs : seeAllCategory === "videos" ? videos : seeAllCategory === "photos" ? photos : [];
  const seeAllTitle = seeAllCategory === "blogs" ? "Blogs" : seeAllCategory === "videos" ? "Videos" : seeAllCategory === "photos" ? "Photos" : "";

  return (
    <View className="flex-1 bg-zinc-950">
      <View className="border-b border-zinc-800 px-4 pb-3 pt-14 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#e4e4e7" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-zinc-100 flex-1" numberOfLines={1}>
          {displayName || username || "Profile"}
        </Text>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View className="rounded-b-2xl overflow-hidden mb-4" style={{ height: 120 }}>
          {profile.banner_url ? (
            <Image
              source={{ uri: profile.banner_url }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : (
            <View className="w-full h-full" style={{ backgroundColor: "rgba(58, 24, 95, 0.92)" }} />
          )}
        </View>
        {/* Purple band: avatar, name, handle, counts */}
        <View
          className="px-4 pt-2 pb-8 -mt-6 mx-4 rounded-2xl overflow-hidden"
          style={{ backgroundColor: "rgba(58, 24, 95, 0.92)" }}
        >
          <View className="items-center">
            <View className="h-20 w-20 overflow-hidden rounded-full border-4 border-white/40 bg-zinc-700">
              <Image
                source={avatarUri ? { uri: avatarUri } : CREATOR_AVATAR}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            </View>
            <Text className="mt-2 text-base font-semibold text-white" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="text-xs text-zinc-300" numberOfLines={1}>
              @{username}
            </Text>
            <View className="mt-2 flex-row gap-4">
              <Text className="text-sm text-zinc-300">
                <Text className="font-semibold text-white">{profile.followers_count}</Text> followers
              </Text>
              <Text className="text-sm text-zinc-300">
                <Text className="font-semibold text-white">{profile.following_count}</Text> following
              </Text>
            </View>
          </View>
        </View>

        <View className="px-4 mt-4">
        {/* Bio card */}
        <View className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-4 mb-3">
          <Text className="text-[10px] text-zinc-500 uppercase tracking-wider">BIO</Text>
          <Text className="text-sm font-medium text-zinc-100 mt-1">Creator • Posts, products & events</Text>
          <Text className="text-xs text-zinc-500 mt-1">{formatMemberSince(profile.created_at)}</Text>
          {profile.bio ? (
            <Text className="text-sm text-zinc-400 mt-2 leading-5" numberOfLines={3}>{profile.bio}</Text>
          ) : null}
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-2 mb-4">
          <TouchableOpacity
            onPress={handleFollow}
            disabled={followLoading || isOwnProfile}
            className={`flex-1 rounded-full py-2.5 ${isFollowing ? "bg-zinc-700" : "bg-violet-600"} active:opacity-80 disabled:opacity-60`}
          >
            <Text className="text-center text-sm font-semibold text-white">
              {isOwnProfile ? "You" : followLoading ? "…" : isFollowing ? "In community" : "Join community"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {}}
            className="rounded-full border border-zinc-600 bg-zinc-800 px-4 py-2.5 active:opacity-80"
          >
            <Text className="text-sm font-medium text-zinc-100">
              {profile.dm_access_enabled && (profile.dm_access_price_cents ?? 0) > 0
                ? `Message — $${((profile.dm_access_price_cents ?? 0) / 100).toFixed(2)}`
                : "Message"}
            </Text>
          </TouchableOpacity>
        </View>
        {profile.dm_access_enabled && (profile.dm_access_price_cents ?? 0) > 0 ? (
          <Text className="text-xs text-zinc-500 mb-4">
            First message requires a one-time payment to start the conversation.
          </Text>
        ) : null}

        {/* Tabs: Posts | Products | Saved */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4 -mx-4 border-b border-zinc-800"
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              className={`py-3 px-4 border-b-2 ${activeTab === tab.id ? "border-violet-500" : "border-transparent"}`}
            >
              <Text
                className={`text-sm font-medium ${activeTab === tab.id ? "text-violet-400" : "text-zinc-500"}`}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Tab content */}
        {activeTab === "posts" && (
          <View className="gap-4">
            {isOwnProfile ? (
              <Pressable onPress={() => router.push("/(tabs)/create")} className="flex-row items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-4">
                <Text className="text-base font-medium text-zinc-100">Posts</Text>
                <View className="h-8 w-8 items-center justify-center rounded-full bg-zinc-600">
                  <Text className="text-lg font-semibold text-zinc-200">+</Text>
                </View>
              </Pressable>
            ) : (
              <View className="flex-row items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-4">
                <Text className="text-base font-medium text-zinc-100">Posts</Text>
              </View>
            )}
            {renderCategorySection(blogs, "No blogs yet.", "blogs", "Blogs")}
            {renderCategorySection(videos, "No videos yet.", "videos", "Videos")}
            {renderCategorySection(photos, "No photos yet.", "photos", "Photos")}
          </View>
        )}

        {activeTab === "products" && (
          <CreatorProductsSection
            products={creatorProducts}
            updateProduct={(productId, updates) => {
              updateProduct(productId, updates);
              setCreatorProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...updates } : p)));
            }}
            onSeeAllCategory={setSeeAllProductCategory}
            seeAllProductCategory={seeAllProductCategory}
            onCloseSeeAll={() => setSeeAllProductCategory(null)}
          />
        )}

        {activeTab === "saved" && (
          <View className="rounded-xl border border-dashed border-zinc-700 py-12">
            <Text className="text-center text-sm text-zinc-500">No saved items.</Text>
          </View>
        )}
        </View>
      </ScrollView>

      {/* See all modal */}
      <Modal visible={!!seeAllCategory} transparent animationType="slide">
        <View className="flex-1 bg-black/70 justify-end">
          <Pressable className="flex-1" onPress={() => setSeeAllCategory(null)} />
          <View className="bg-zinc-900 rounded-t-2xl border-t border-zinc-700 max-h-[85%]">
            <View className="flex-row items-center justify-between border-b border-zinc-700 px-4 py-3">
              <Text className="text-base font-semibold text-zinc-100">{seeAllTitle}</Text>
              <TouchableOpacity onPress={() => setSeeAllCategory(null)} className="p-2">
                <Ionicons name="close" size={24} color="#71717a" />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {seeAllData.map((item) => (
                  <View key={item.id} style={{ width: postTileSize, height: postTileSize }}>
                    <PostGridTile post={item} onPress={() => { setSelectedPost(item); setSeeAllCategory(null); }} />
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Post detail modal: full-screen, swipe through same category (photos/videos/blogs) */}
      <Modal visible={!!selectedPost} transparent animationType="fade">
        <View className="flex-1 bg-black">
          {selectedPost && postDetailScrollList.length > 0 ? (
            <>
              <FlatList
                data={postDetailScrollList}
                keyExtractor={(item) => item.id}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                decelerationRate="fast"
                initialScrollIndex={postDetailInitialIndex}
                initialNumToRender={Math.max(1, postDetailInitialIndex + 1)}
                getItemLayout={(_: unknown, index: number) => ({
                  length: windowHeight,
                  offset: windowHeight * index,
                  index,
                })}
                viewabilityConfig={postDetailViewabilityConfig}
                onViewableItemsChanged={onPostDetailViewableItemsChanged}
                renderItem={({ item, index }) => (
                  <View style={{ height: windowHeight }}>
                    {renderPostDetailCard(item, { shouldPlayVideo: index === focusedPostDetailIndex })}
                  </View>
                )}
              />
              <TouchableOpacity
                onPress={() => setSelectedPost(null)}
                className="absolute right-4 top-14 z-10 rounded-full bg-black/50 p-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </>
          ) : selectedPost ? (
            <>
              <View className="flex-1" pointerEvents="box-none">
                {renderPostDetailCard(selectedPost, { shouldPlayVideo: focusedPostDetailIndex === 0 })}
              </View>
              <TouchableOpacity
                onPress={() => setSelectedPost(null)}
                className="absolute right-4 top-14 z-10 rounded-full bg-black/50 p-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
