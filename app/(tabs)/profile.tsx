import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { PostCard } from "../../components/PostCard";
import { PostPreviewCard } from "../../components/PostPreviewCard";
import { ProductCard } from "../../components/ProductCard";
import { TipModal } from "../../components/TipModal";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import type { Event, Post, PostType, Product } from "../../context/ContentContext";
import { useContent } from "../../context/ContentContext";
import { useProfile } from "../../context/ProfileContext";
import { usePostCommentCounts } from "../../hooks/usePostCommentCounts";
import { usePostDislikes } from "../../hooks/usePostDislikes";
import { usePostLikes } from "../../hooks/usePostLikes";
import { usePostReposts } from "../../hooks/usePostReposts";
import { CREATOR_AVATAR } from "../../lib/constants";
import { rowToProduct } from "../../lib/supabase-products";
import supabase from "../../lib/supabase";

type ProfileTabId = "posts" | "products" | "events" | "saved";
type ProfilePost = Post & { createdAt?: string };
const POST_PREVIEW_CARD_WIDTH = 140;
const POST_PREVIEW_CARD_HEIGHT = 160;

function formatMemberSince(ts: number): string {
  const d = new Date(ts);
  const month = d.toLocaleString("default", { month: "short" });
  const year = d.getFullYear();
  return `Member since ${month} ${year}`;
}

const PRODUCT_CARD_GAP = 8;
const HORIZONTAL_PADDING = 16;
const TABLET_BREAKPOINT = 768;

function ProfileProductsGrid({
  products,
  onCheckout,
  onDeleteProduct,
  onEditProduct,
  onShowStats,
  loadReviewsForProduct,
}: {
  products: Product[];
  onCheckout?: (product: Product, action: "buy" | "download" | "join" | "book") => void;
  onDeleteProduct?: (productId: string) => void;
  onEditProduct?: (product: Product) => void;
  onShowStats?: (product: Product) => void;
  loadReviewsForProduct?: (productId: string) => Promise<void>;
}) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const isTablet = width >= TABLET_BREAKPOINT;
  const perRow = isTablet ? 4 : 2;
  const cardWidth =
    (width - HORIZONTAL_PADDING * 2 - PRODUCT_CARD_GAP * (perRow - 1)) / perRow;

  useEffect(() => {
    if (loadReviewsForProduct && products.length > 0) {
      products.forEach((p) => loadReviewsForProduct(p.id));
    }
  }, [products, loadReviewsForProduct]);

  return (
    <View className="flex-row flex-wrap" style={{ gap: PRODUCT_CARD_GAP }}>
      {products.map((p) => (
        <View key={p.id} style={{ width: cardWidth }}>
          <ProductCard
            product={p}
            profilePreview
            onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
            onCheckout={onCheckout}
            onDeleteProduct={onDeleteProduct}
            onEditProduct={onEditProduct}
            onShowStats={onShowStats}
          />
        </View>
      ))}
    </View>
  );
}

function ProfileTabContent({
  tabId,
  posts,
  postsLoading,
  creator,
  products,
  productsLoading,
  events,
  eventsLoading,
  onViewImage,
  savedPostIds = [],
  savedProductIds = [],
  savedProducts,
  savedProductsLoading = false,
  toggleSavePost,
  toggleSaveProduct,
  updateProduct,
  onDeleteProduct,
  onEditProduct,
  onShowStats,
  loadReviewsForProduct,
  onRequestTip,
  onCheckout,
  getLikeState,
  toggleLike,
  getDislikeState,
  toggleDislike,
  getRepostState,
  toggleRepost,
  savedPosts = [],
  savedPostsLoading = false,
  getCommentCount,
  onCommentAdded,
  postUserId,
  onDeletePost,
}: {
  tabId: ProfileTabId;
  posts: Post[];
  postsLoading?: boolean;
  creator?: { id: string; displayName: string; username: string; avatarUri: string | null };
  products: Product[];
  productsLoading?: boolean;
  events: Event[];
  eventsLoading?: boolean;
  onViewImage: (uri: string) => void;
  savedPostIds?: string[];
  savedProductIds?: string[];
  savedProducts?: Product[];
  savedProductsLoading?: boolean;
  toggleSavePost: (id: string) => void;
  toggleSaveProduct: (id: string) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  onDeleteProduct?: (productId: string) => void;
  onEditProduct?: (product: Product) => void;
  onShowStats?: (product: Product) => void;
  loadReviewsForProduct?: (productId: string) => Promise<void>;
  onRequestTip?: (postTitle?: string) => void;
  onCheckout?: (product: Product, action: "buy" | "download" | "join" | "book") => void;
  getLikeState?: (postId: string) => { isLiked: boolean; likeCount: number };
  toggleLike?: (postId: string) => void;
  getDislikeState?: (postId: string) => { isDisliked: boolean; dislikeCount: number };
  toggleDislike?: (postId: string) => void;
  getRepostState?: (postId: string) => { isReposted: boolean; repostCount: number };
  toggleRepost?: (postId: string) => void;
  savedPosts?: Post[];
  savedPostsLoading?: boolean;
  getCommentCount?: (postId: string) => number;
  onCommentAdded?: () => void;
  postUserId?: string;
  onDeletePost?: (postId: string) => void;
}) {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [focusedPostDetailIndex, setFocusedPostDetailIndex] = useState(0);
  type SeeAllCategory = "blogs" | "videos" | "photos" | null;
  const [seeAllCategory, setSeeAllCategory] = useState<SeeAllCategory>(null);
  type SeeAllProductCategory = "featured" | "digital" | "physical" | "services" | "memberships" | null;
  const [seeAllProductCategory, setSeeAllProductCategory] = useState<SeeAllProductCategory>(null);
  const safeSavedPostIds = savedPostIds ?? [];

  useEffect(() => {
    if (!selectedPost) return;
    if (tabId === "posts") {
      const videos = posts.filter((p) => p.type === "video");
      const photos = posts.filter((p) => p.type === "picture");
      const blogs = posts.filter((p) => p.type === "blog" || p.type === "audio" || p.type === "polls");
      const list =
        selectedPost.type === "video"
          ? videos
          : selectedPost.type === "picture"
            ? photos
            : blogs;
      const idx = list.findIndex((p) => p.id === selectedPost.id);
      if (idx >= 0) setFocusedPostDetailIndex(idx);
    } else if (tabId === "saved") {
      const savedVideos = (savedPosts ?? []).filter((p) => p.type === "video");
      const savedPhotos = (savedPosts ?? []).filter((p) => p.type === "picture");
      const savedBlogs = (savedPosts ?? []).filter((p) => p.type === "blog" || p.type === "audio" || p.type === "polls");
      const list =
        selectedPost.type === "video"
          ? savedVideos
          : selectedPost.type === "picture"
            ? savedPhotos
            : savedBlogs;
      const idx = list.findIndex((p) => p.id === selectedPost.id);
      if (idx >= 0) setFocusedPostDetailIndex(idx);
    }
  }, [selectedPost, tabId, posts, savedPosts]);

  const postDetailViewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;
  const onPostDetailViewableItemsChanged = useCallback(
    (info: { viewableItems: Array<{ index: number | null }> }) => {
      const first = info.viewableItems[0];
      const idx = first?.index;
      if (idx != null) setFocusedPostDetailIndex(idx);
    },
    []
  );

  const safeSavedProductIds = savedProductIds ?? [];
  const likeState = getLikeState ? (id: string) => getLikeState(id) : () => ({ isLiked: false, likeCount: 0 });
  const dislikeState = getDislikeState ? (id: string) => getDislikeState(id) : () => ({ isDisliked: false, dislikeCount: 0 });
  const repostState = getRepostState ? (id: string) => getRepostState(id) : () => ({ isReposted: false, repostCount: 0 });

  const renderPostCard = useCallback(
    (p: Post & { createdAt?: string }, options?: { containMedia?: boolean; hideRightLabel?: boolean; noCreator?: boolean; useReelsLayout?: boolean; shouldPlayVideo?: boolean }) => {
      const { isLiked, likeCount } = likeState(p.id);
      const { isDisliked, dislikeCount } = dislikeState(p.id);
      const { isReposted, repostCount } = repostState(p.id);
      const showCreator = !options?.noCreator && creator;
      return (
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
          creator={showCreator ? creator : undefined}
          onPressCreator={showCreator ? () => router.push({ pathname: "/creator/[id]", params: { id: creator!.id } }) : undefined}
          onSave={() => toggleSavePost(p.id)}
          isSaved={safeSavedPostIds.includes(p.id)}
          onLike={toggleLike ? () => toggleLike(p.id) : undefined}
          onDislike={toggleDislike ? () => toggleDislike(p.id) : undefined}
          onShare={() => Share.share({ message: p.title }).catch(() => {})}
          onRepost={toggleRepost ? () => toggleRepost(p.id) : undefined}
          onTip={onRequestTip ? () => onRequestTip(p.title) : undefined}
          isLiked={isLiked}
          likeCount={likeCount}
          isDisliked={isDisliked}
          dislikeCount={dislikeCount}
          isReposted={isReposted}
          repostCount={repostCount}
          showTip={!!onRequestTip}
          containMedia={options?.containMedia}
          hideRightLabel={options?.hideRightLabel}
          layout={options?.useReelsLayout ? "reels" : undefined}
          fillContainer={options?.useReelsLayout ?? false}
          shouldPlayVideo={options?.shouldPlayVideo ?? false}
          postUserId={postUserId}
          onDeletePost={onDeletePost}
          onPressHashtag={(tag) => router.push({ pathname: "/tag/[name]", params: { name: tag } })}
          commentCount={getCommentCount?.(p.id) ?? 0}
          onCommentAdded={onCommentAdded}
        />
      );
    },
    [creator, safeSavedPostIds, toggleSavePost, onRequestTip, likeState, toggleLike, toggleDislike, dislikeState, toggleRepost, repostState, getCommentCount, onCommentAdded, postUserId, onDeletePost, router]
  );

  if (tabId === "posts") {
    if (postsLoading) {
      return (
        <View className="py-12 items-center">
          <Text className="text-zinc-500">Loading posts…</Text>
        </View>
      );
    }
    const blogs = posts.filter((p) => p.type === "blog" || p.type === "audio" || p.type === "polls");
    const videos = posts.filter((p) => p.type === "video");
    const photos = posts.filter((p) => p.type === "picture");

    const renderCategorySection = (
      data: Post[],
      emptyLabel: string,
      category: SeeAllCategory,
      sectionTitle: string
    ) => {
      if (data.length === 0) {
        return (
          <View key={sectionTitle} className="gap-2">
            <Text className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{sectionTitle}</Text>
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
            <TouchableOpacity onPress={() => category && setSeeAllCategory(category)} className="py-1 px-2">
              <Text className="text-xs font-medium text-violet-400">See all ({data.length})</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: 16 }}
          >
            {data.map((item) => (
              <PostPreviewCard
                key={item.id}
                post={item}
                onPress={() => setSelectedPost(item)}
                cardWidth={POST_PREVIEW_CARD_WIDTH}
                cardHeight={POST_PREVIEW_CARD_HEIGHT}
              />
            ))}
          </ScrollView>
        </View>
      );
    };

    const seeAllData = seeAllCategory === "blogs" ? blogs : seeAllCategory === "videos" ? videos : seeAllCategory === "photos" ? photos : [];
    const seeAllTitle = seeAllCategory === "blogs" ? "Blogs" : seeAllCategory === "videos" ? "Videos" : seeAllCategory === "photos" ? "Photos" : "";

    const postDetailScrollList = selectedPost
      ? selectedPost.type === "video"
        ? videos
        : selectedPost.type === "picture"
          ? photos
          : blogs
      : [];
    const postDetailInitialIndex = selectedPost && postDetailScrollList.length > 0
      ? Math.max(0, postDetailScrollList.findIndex((p) => p.id === selectedPost.id))
      : 0;

    return (
      <>
        <View className="gap-4">
          <Pressable onPress={() => router.push("/(tabs)/create")} className="flex-row items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-4">
            <Text className="text-base font-medium text-zinc-100">Posts</Text>
            <View className="h-8 w-8 items-center justify-center rounded-full bg-zinc-600">
              <Text className="text-lg font-semibold text-zinc-200">+</Text>
            </View>
          </Pressable>

          {renderCategorySection(blogs, "No blogs yet.", "blogs", "Blogs")}
          {renderCategorySection(videos, "No videos yet.", "videos", "Videos")}
          {renderCategorySection(photos, "No photos yet.", "photos", "Photos")}
        </View>

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
                horizontal
                contentContainerStyle={{ padding: 16, gap: 10, paddingRight: 32 }}
                showsHorizontalScrollIndicator={false}
              >
                {seeAllData.map((item) => (
                  <PostPreviewCard
                    key={item.id}
                    post={item}
                    onPress={() => { setSelectedPost(item); setSeeAllCategory(null); }}
                    cardWidth={POST_PREVIEW_CARD_WIDTH}
                    cardHeight={POST_PREVIEW_CARD_HEIGHT}
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

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
                      {renderPostCard(item, { useReelsLayout: true, shouldPlayVideo: index === focusedPostDetailIndex })}
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
                  {renderPostCard(selectedPost, { useReelsLayout: true, shouldPlayVideo: focusedPostDetailIndex === 0 })}
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
      </>
    );
  }

  if (tabId === "products") {
    if (productsLoading) {
      return (
        <View className="py-12 items-center">
          <Text className="text-zinc-500">Loading products…</Text>
        </View>
      );
    }
    return (
      <View className="gap-4">
        <Pressable onPress={() => router.push("/(tabs)/create")} className="flex-row items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-4">
          <Text className="text-base font-medium text-zinc-100">Products</Text>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-zinc-600">
            <Text className="text-lg font-semibold text-zinc-200">+</Text>
          </View>
        </Pressable>
        {products.length === 0 ? (
          <View className="rounded-xl border border-dashed border-zinc-700 py-12">
            <Text className="text-center text-sm text-zinc-500">No products yet.</Text>
          </View>
        ) : (
          <ProfileProductsGrid
            products={products}
            onCheckout={onCheckout}
            onDeleteProduct={onDeleteProduct}
            onEditProduct={onEditProduct}
            onShowStats={onShowStats}
            loadReviewsForProduct={loadReviewsForProduct}
          />
        )}
      </View>
    );
  }

  if (tabId === "events") {
    if (eventsLoading) {
      return (
        <View className="py-12 items-center">
          <Text className="text-zinc-500">Loading events…</Text>
        </View>
      );
    }
    return (
      <View className="gap-4">
        <Pressable onPress={() => router.push("/(tabs)/create")} className="flex-row items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-4">
          <Text className="text-base font-medium text-zinc-100">Events</Text>
          <View className="h-8 w-8 items-center justify-center rounded-full bg-zinc-600">
            <Text className="text-lg font-semibold text-zinc-200">+</Text>
          </View>
        </Pressable>
        {events.length === 0 ? (
          <View className="rounded-xl border border-dashed border-zinc-700 py-12">
            <Text className="text-center text-sm text-zinc-500">No events yet.</Text>
          </View>
        ) : (
          <View className="gap-2">
            {events.map((e) => (
              <View key={e.id} className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3">
                <Text className="text-base font-medium text-zinc-100">{e.title}</Text>
                {e.description ? <Text className="text-sm text-zinc-400 mt-1">{e.description}</Text> : null}
                <Text className="text-xs text-zinc-500 mt-1">{new Date(e.date).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  // Saved tab — grid layout with previews (Blogs, Videos, Photos) like Posts tab
  if (savedPostsLoading || savedProductsLoading) {
    return (
      <View className="py-12 items-center">
        <Text className="text-zinc-500">Loading saved…</Text>
      </View>
    );
  }
  const hasSavedPosts = (savedPosts?.length ?? 0) > 0;
  const hasSavedProducts = (savedProducts?.length ?? 0) > 0;
  if (!hasSavedPosts && !hasSavedProducts) {
    return (
      <View className="rounded-xl border border-dashed border-zinc-700 py-12">
        <Text className="text-center text-sm text-zinc-500">No saved posts or products.</Text>
      </View>
    );
  }

  const savedBlogs = (savedPosts ?? []).filter((p) => p.type === "blog" || p.type === "audio" || p.type === "polls");
  const savedVideos = (savedPosts ?? []).filter((p) => p.type === "video");
  const savedPhotos = (savedPosts ?? []).filter((p) => p.type === "picture");

  const renderSavedCategorySection = (
    data: Post[],
    emptyLabel: string,
    category: SeeAllCategory,
    sectionTitle: string
  ) => {
    if (data.length === 0) {
      return (
        <View key={sectionTitle} className="gap-2">
          <Text className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{sectionTitle}</Text>
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
          <TouchableOpacity onPress={() => category && setSeeAllCategory(category)} className="py-1 px-2">
            <Text className="text-xs font-medium text-violet-400">See all ({data.length})</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 16 }}
        >
          {data.map((item) => (
            <PostPreviewCard
              key={item.id}
              post={item}
              onPress={() => setSelectedPost(item)}
              cardWidth={POST_PREVIEW_CARD_WIDTH}
              cardHeight={POST_PREVIEW_CARD_HEIGHT}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  const savedSeeAllData = seeAllCategory === "blogs" ? savedBlogs : seeAllCategory === "videos" ? savedVideos : seeAllCategory === "photos" ? savedPhotos : [];
  const savedSeeAllTitle = seeAllCategory === "blogs" ? "Saved – Blogs" : seeAllCategory === "videos" ? "Saved – Videos" : seeAllCategory === "photos" ? "Saved – Photos" : "";

  const savedPostDetailScrollList = selectedPost
    ? selectedPost.type === "video"
      ? savedVideos
      : selectedPost.type === "picture"
        ? savedPhotos
        : savedBlogs
    : [];
  const savedPostDetailInitialIndex = selectedPost && savedPostDetailScrollList.length > 0
    ? Math.max(0, savedPostDetailScrollList.findIndex((p) => p.id === selectedPost.id))
    : 0;

  return (
    <>
      <View className="gap-6">
        {hasSavedPosts && (
          <View className="gap-4">
            {renderSavedCategorySection(savedBlogs, "No saved blogs.", "blogs", "Blogs")}
            {renderSavedCategorySection(savedVideos, "No saved videos.", "videos", "Videos")}
            {renderSavedCategorySection(savedPhotos, "No saved photos.", "photos", "Photos")}
          </View>
        )}
        {hasSavedProducts && (
          <View className="gap-2">
            <Text className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Saved products</Text>
            <View className="gap-3">
              {savedProducts!.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  showCreatorHeader
                  onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                  onCheckout={onCheckout}
                />
              ))}
            </View>
          </View>
        )}
      </View>

      <Modal visible={!!seeAllCategory} transparent animationType="slide">
        <View className="flex-1 bg-black/70 justify-end">
          <Pressable className="flex-1" onPress={() => setSeeAllCategory(null)} />
          <View className="bg-zinc-900 rounded-t-2xl border-t border-zinc-700 max-h-[85%]">
            <View className="flex-row items-center justify-between border-b border-zinc-700 px-4 py-3">
              <Text className="text-base font-semibold text-zinc-100">{savedSeeAllTitle}</Text>
              <TouchableOpacity onPress={() => setSeeAllCategory(null)} className="p-2">
                <Ionicons name="close" size={24} color="#71717a" />
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              contentContainerStyle={{ padding: 16, gap: 10, paddingRight: 32 }}
              showsHorizontalScrollIndicator={false}
            >
              {savedSeeAllData.map((item) => (
                <PostPreviewCard
                  key={item.id}
                  post={item}
                  onPress={() => { setSelectedPost(item); setSeeAllCategory(null); }}
                  cardWidth={POST_PREVIEW_CARD_WIDTH}
                  cardHeight={POST_PREVIEW_CARD_HEIGHT}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selectedPost} transparent animationType="fade">
        <View className="flex-1 bg-black">
          {selectedPost && savedPostDetailScrollList.length > 0 ? (
            <>
              <FlatList
                data={savedPostDetailScrollList}
                keyExtractor={(item) => item.id}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                decelerationRate="fast"
                initialScrollIndex={savedPostDetailInitialIndex}
                initialNumToRender={Math.max(1, savedPostDetailInitialIndex + 1)}
                getItemLayout={(_: unknown, index: number) => ({
                  length: windowHeight,
                  offset: windowHeight * index,
                  index,
                })}
                viewabilityConfig={postDetailViewabilityConfig}
                onViewableItemsChanged={onPostDetailViewableItemsChanged}
                renderItem={({ item, index }) => (
                  <View style={{ height: windowHeight }}>
                    {renderPostCard(item, { useReelsLayout: true, shouldPlayVideo: index === focusedPostDetailIndex })}
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
                {renderPostCard(selectedPost, { useReelsLayout: true, shouldPlayVideo: focusedPostDetailIndex === 0 })}
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
    </>
  );
}

export default function ProfileScreen() {
  const { updateProduct, deleteProduct, loadReviewsForProduct } = useContent();
  const { removeFromCart } = useCart();
  const { profile, savedPostIds, savedProductIds, toggleSavePost, toggleSaveProduct, profileLoadDone, refetchProfile } = useProfile();
  const { signOut, user } = useAuth();
  const router = useRouter();
  const [myPosts, setMyPosts] = useState<ProfilePost[]>([]);
  const [myPostsLoading, setMyPostsLoading] = useState(true);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [myProductsLoading, setMyProductsLoading] = useState(true);
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [myEventsLoading, setMyEventsLoading] = useState(true);
  const [fullscreenImageUri, setFullscreenImageUri] = useState<string | null>(null);
  const [tipModalVisible, setTipModalVisible] = useState(false);
  const [tipForPostTitle, setTipForPostTitle] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<ProfileTabId>("posts");
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedPostsLoading, setSavedPostsLoading] = useState(false);
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);
  const [savedProductsLoading, setSavedProductsLoading] = useState(false);

  const fetchMyPosts = useCallback(async () => {
    if (!supabase || !user?.id) {
      setMyPosts([]);
      setMyPostsLoading(false);
      return;
    }
    setMyPostsLoading(true);
    try {
      const { data } = await supabase
        .from("posts")
        .select("id, type, title, body, media_uri, thumbnail_uri, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        setMyPosts(
          data.map((row: { id: string; type: string; title: string | null; body: string | null; media_uri: string | null; thumbnail_uri?: string | null; created_at?: string }) => ({
            id: row.id,
            type: row.type as PostType,
            title: row.title ?? "",
            body: row.body ?? undefined,
            mediaUri: row.media_uri ?? undefined,
            thumbnailUri: row.thumbnail_uri ?? undefined,
            ...(row.created_at != null && { createdAt: row.created_at }),
          }))
        );
      } else setMyPosts([]);
    } catch {
      setMyPosts([]);
    } finally {
      setMyPostsLoading(false);
    }
  }, [user?.id]);

  const fetchMyProducts = useCallback(async () => {
    if (!supabase || !user?.id) {
      setMyProducts([]);
      setMyProductsLoading(false);
      return;
    }
    setMyProductsLoading(true);
    try {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        setMyProducts(data.map((row: unknown) => rowToProduct(row as Parameters<typeof rowToProduct>[0])));
      } else setMyProducts([]);
    } catch {
      setMyProducts([]);
    } finally {
      setMyProductsLoading(false);
    }
  }, [user?.id]);

  const fetchMyEvents = useCallback(async () => {
    if (!supabase || !user?.id) {
      setMyEvents([]);
      setMyEventsLoading(false);
      return;
    }
    setMyEventsLoading(true);
    try {
      const { data } = await supabase
        .from("events")
        .select("id, title, description, date, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        setMyEvents(
          (data as { id: string; title: string; description: string | null; date: number; created_at: string }[]).map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description ?? undefined,
            date: row.date,
            createdAt: new Date(row.created_at).getTime(),
          }))
        );
      } else setMyEvents([]);
    } catch {
      setMyEvents([]);
    } finally {
      setMyEventsLoading(false);
    }
  }, [user?.id]);

  const fetchSavedPosts = useCallback(async () => {
    if (!supabase || !user?.id) {
      setSavedPosts([]);
      setSavedPostsLoading(false);
      return;
    }
    setSavedPostsLoading(true);
    try {
      const { data: savedRows } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id);
      const postIds = (savedRows ?? []).map((r: { post_id: string }) => r.post_id);
      if (postIds.length === 0) {
        setSavedPosts([]);
        setSavedPostsLoading(false);
        return;
      }
      const { data: postsData } = await supabase.from("posts").select("id, type, title, body, media_uri, thumbnail_uri").in("id", postIds);
      if (postsData) {
        const byId = new Map((postsData as { id: string }[]).map((r) => [r.id, r]));
        setSavedPosts(
          postIds
            .filter((id) => byId.has(id))
            .map((id) => {
              const row = byId.get(id) as { id: string; type: string; title: string | null; body: string | null; media_uri: string | null; thumbnail_uri?: string | null };
              return {
                id: row.id,
                type: row.type as PostType,
                title: row.title ?? "",
                body: row.body ?? undefined,
                mediaUri: row.media_uri ?? undefined,
                thumbnailUri: row.thumbnail_uri ?? undefined,
              };
            })
        );
      } else setSavedPosts([]);
    } catch {
      setSavedPosts([]);
    } finally {
      setSavedPostsLoading(false);
    }
  }, [user?.id]);

  const fetchSavedProducts = useCallback(async () => {
    if (!supabase || !user?.id) {
      setSavedProducts([]);
      setSavedProductsLoading(false);
      return;
    }
    setSavedProductsLoading(true);
    try {
      const { data: savedRows } = await supabase.from("saved_products").select("product_id").eq("user_id", user.id);
      const productIds = (savedRows ?? []).map((r: { product_id: string }) => r.product_id);
      if (productIds.length === 0) {
        setSavedProducts([]);
        setSavedProductsLoading(false);
        return;
      }
      const { data: productsData } = await supabase.from("products").select("*").in("id", productIds);
      if (productsData) {
        setSavedProducts(productsData.map((row: unknown) => rowToProduct(row as Parameters<typeof rowToProduct>[0])));
      } else setSavedProducts([]);
    } catch {
      setSavedProducts([]);
    } finally {
      setSavedProductsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        refetchProfile();
        fetchMyPosts();
        fetchMyProducts();
        fetchMyEvents();
        fetchSavedPosts();
        fetchSavedProducts();
      }
    }, [user?.id, refetchProfile, fetchMyPosts, fetchMyProducts, fetchMyEvents, fetchSavedPosts, fetchSavedProducts])
  );

  const postIds = useMemo(
    () => [...new Set([...myPosts.map((p) => p.id), ...(savedPosts?.map((p) => p.id) ?? [])])],
    [myPosts, savedPosts]
  );
  const { getState: getLikeState, toggleLike } = usePostLikes(postIds);
  const { getState: getDislikeState, toggleDislike } = usePostDislikes(postIds);
  const { getState: getRepostState, toggleRepost } = usePostReposts(postIds);
  const { getCommentCount, refresh: refreshCommentCounts } = usePostCommentCounts(postIds);

  const handleDeletePost = useCallback(
    async (postId: string) => {
      if (!supabase) return;
      await supabase.from("posts").delete().eq("id", postId).eq("user_id", user?.id);
      setMyPosts((prev) => prev.filter((p) => p.id !== postId));
    },
    [user?.id]
  );

  const handleDeleteProduct = useCallback(
    async (productId: string) => {
      Alert.alert("Delete product", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!supabase) return;
            await supabase.from("products").delete().eq("id", productId).eq("creator_id", user?.id);
            deleteProduct(productId);
            setMyProducts((prev) => prev.filter((p) => p.id !== productId));
          },
        },
      ]);
    },
    [user?.id, deleteProduct]
  );

  const handleRequestTip = useCallback((postTitle?: string) => {
    setTipForPostTitle(postTitle);
    setTipModalVisible(true);
  }, []);

  const SUB_TABS: { id: ProfileTabId; label: string }[] = [
    { id: "posts", label: "Posts" },
    { id: "products", label: "Products" },
    { id: "saved", label: "Saved" },
  ];

  if (!user) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center px-4">
        <Text className="text-zinc-400 mb-4">Sign in to view your profile.</Text>
        <TouchableOpacity onPress={() => router.replace("/(auth)")} className="rounded-xl bg-violet-600 px-6 py-3">
          <Text className="text-white font-medium">Sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const avatarSource = profile.avatarUri ? { uri: profile.avatarUri } : CREATOR_AVATAR;
  const displayName = profileLoadDone ? profile.displayName || "Creator" : "…";
  const username = profileLoadDone ? profile.username || "user" : "…";
  const postsCount = myPosts.length;
  const followersCount = profile.followersCount ?? 0;
  const followingCount = profile.followingCount ?? 0;

  return (
    <View className="flex-1 bg-zinc-950">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Purple banner with avatar and name */}
        <View className="pt-14 pb-0" style={{ backgroundColor: "rgba(58, 24, 95, 0.92)" }}>
          <View className="px-4 pt-6 pb-8 flex-row items-center">
            <View className="h-20 w-20 rounded-full overflow-hidden bg-zinc-700 border-2 border-white/30">
              <Image source={avatarSource} className="h-full w-full" contentFit="cover" />
            </View>
            <View className="ml-4 flex-1 min-w-0">
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="text-lg font-semibold text-white" numberOfLines={1}>
                  {displayName}
                </Text>
                <Ionicons name="checkmark-circle" size={18} color="#a78bfa" />
              </View>
              <Text className="text-sm text-zinc-300 mt-0.5" numberOfLines={1}>
                @{username}
              </Text>
              <View className="flex-row items-center gap-2 mt-2">
                <View className="rounded px-2 py-0.5 bg-zinc-600/80">
                  <Text className="text-xs font-medium text-zinc-200">Rep {profile.reputationScore ?? 0}</Text>
                </View>
                <View className="rounded px-2 py-0.5 bg-violet-600/80">
                  <Text className="text-xs font-medium text-white">Lvl {profile.level ?? 0}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Rounded card: actions + stats + BIO */}
        <View className="px-4 -mt-4">
          <View className="rounded-2xl border border-zinc-700 bg-zinc-800/95 overflow-hidden">
            <View className="flex-row flex-wrap gap-2 p-4">
              <TouchableOpacity
                onPress={() => router.push("/edit-profile")}
                className="rounded-lg bg-zinc-600 px-4 py-2.5"
              >
                <Text className="text-sm font-medium text-white">Edit profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => signOut().then(() => router.replace("/(auth)"))}
                className="rounded-lg bg-red-600/90 px-4 py-2.5"
              >
                <Text className="text-sm font-medium text-white">Sign out</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRequestTip()}
                className="rounded-lg bg-amber-500 px-4 py-2.5"
              >
                <Text className="text-sm font-medium text-white">Tip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Share.share({ message: `Check out ${displayName} (@${username}) on Hubble` }).catch(() => {})}
                className="rounded-lg bg-zinc-600 w-10 h-10 items-center justify-center"
              >
                <Ionicons name="share-outline" size={20} color="#e4e4e7" />
              </TouchableOpacity>
            </View>
            <View className="flex-row border-t border-zinc-700 px-4 py-3">
              <View className="flex-1 items-center">
                <Text className="text-base font-semibold text-white">{postsCount}</Text>
                <Text className="text-xs text-zinc-400">Posts</Text>
              </View>
              <View className="flex-1 items-center border-l border-r border-zinc-700">
                <Text className="text-base font-semibold text-white">{followersCount}</Text>
                <Text className="text-xs text-zinc-400">Followers</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-base font-semibold text-white">{followingCount}</Text>
                <Text className="text-xs text-zinc-400">Following</Text>
              </View>
            </View>
            <View className="px-4 pb-4 pt-2 border-t border-zinc-700">
              <Text className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">BIO</Text>
              <Text className="text-sm text-zinc-300 mt-1">{profile.bio || "Creator • Posts, products & events"}</Text>
              <Text className="text-xs text-zinc-500 mt-1">{formatMemberSince(profile.memberSince)}</Text>
            </View>
          </View>
        </View>

        {/* Tabs: Posts | Products | Saved */}
        <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="border-b border-zinc-800 mt-4"
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              {SUB_TABS.map((tab) => (
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

            <View className="px-4 pt-4">
          <ProfileTabContent
            tabId={activeTab}
            posts={myPosts}
            postsLoading={myPostsLoading}
            creator={user && profileLoadDone ? { id: user.id, displayName: profile.displayName ?? "", username: profile.username ?? "", avatarUri: profile.avatarUri ?? null } : undefined}
            products={myProducts}
            productsLoading={myProductsLoading}
            events={myEvents}
            eventsLoading={myEventsLoading}
            onViewImage={setFullscreenImageUri}
            savedPostIds={savedPostIds}
            savedProductIds={savedProductIds}
            savedProducts={savedProducts}
            savedProductsLoading={savedProductsLoading}
            toggleSavePost={toggleSavePost}
            toggleSaveProduct={toggleSaveProduct}
            updateProduct={updateProduct}
            onRequestTip={handleRequestTip}
            onCheckout={() => {}}
            getLikeState={getLikeState}
            toggleLike={toggleLike}
            getDislikeState={getDislikeState}
            toggleDislike={toggleDislike}
            getRepostState={getRepostState}
            toggleRepost={toggleRepost}
            savedPosts={savedPosts}
            savedPostsLoading={savedPostsLoading}
            getCommentCount={getCommentCount}
            onCommentAdded={refreshCommentCounts}
            postUserId={user?.id}
            onDeletePost={handleDeletePost}
            onDeleteProduct={handleDeleteProduct}
            onEditProduct={(prod) => router.push({ pathname: "/edit-product/[id]", params: { id: prod.id } })}
            onShowStats={() => router.push("/insights/income")}
            loadReviewsForProduct={loadReviewsForProduct}
          />
            </View>
      </ScrollView>

      <TipModal
        visible={tipModalVisible}
        forPostTitle={tipForPostTitle}
        onClose={() => {
          setTipModalVisible(false);
          setTipForPostTitle(undefined);
        }}
      />

      <Modal visible={!!fullscreenImageUri} transparent animationType="fade">
        <Pressable className="flex-1 bg-black/90 justify-center" onPress={() => setFullscreenImageUri(null)}>
          {fullscreenImageUri ? (
            <Image source={{ uri: fullscreenImageUri }} className="w-full aspect-square" contentFit="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
