import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import type { PriceTier, ProductType, ServiceSlot } from "../../context/ContentContext";
import { useContent } from "../../context/ContentContext";
import { useProfile } from "../../context/ProfileContext";
import { createRevenueSplit, getProfileIdByUsername, getRevenueSplitsForOwner } from "../../lib/revenue-splits";
import { productToRow, rowToProduct } from "../../lib/supabase-products";
import supabase from "../../lib/supabase";

const PRODUCT_CATEGORIES = [
  "Art",
  "Clothing & Apparel",
  "Digital",
  "Electronics",
  "Events",
  "Music",
  "Services",
  "Physical Goods",
  "Custom",
];
const MAX_CATEGORIES = 3;

async function pickImage(): Promise<{ uri: string } | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  return { uri: result.assets[0].uri };
}

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { updateProduct, deleteProduct } = useContent();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<{
    id: string;
    type: ProductType;
    title: string;
    description?: string;
    price?: string;
    mediaUri?: string;
    coverUri?: string;
    interval?: string;
    priceTiers?: PriceTier[];
    serviceSlots?: ServiceSlot[];
    eventDate?: number;
    eventTime?: string;
    categories?: string[];
    tags?: string[];
    creatorId?: string;
  } | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string | null>(null);
  const [interval, setInterval] = useState<"monthly" | "yearly" | "">("");
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  const [serviceSlots, setServiceSlots] = useState<ServiceSlot[]>([]);
  const [eventDateInput, setEventDateInput] = useState("");
  const [eventTimeInput, setEventTimeInput] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [revenueSplits, setRevenueSplits] = useState<{ partnerUsername: string; splitPercent: string }[]>([]);

  const fetchProduct = useCallback(async () => {
    if (!supabase || !id || !user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
    if (error || !data) {
      setProduct(null);
      setLoading(false);
      return;
    }
    const row = data as Record<string, unknown>;
    if (row.creator_id !== user.id) {
      setProduct(null);
      setLoading(false);
      return;
    }
    const p = rowToProduct(row as Parameters<typeof rowToProduct>[0]);
    setProduct(p);
    setTitle(p.title ?? "");
    setDescription(p.description ?? "");
    setPrice(p.price ?? "");
    setMediaUri(p.mediaUri ?? null);
    setCoverImageUri(p.coverUri ?? null);
    setInterval(
      p.interval === "monthly" ? "monthly" : p.interval === "yearly" ? "yearly" : ""
    );
    setPriceTiers(Array.isArray(p.priceTiers) ? p.priceTiers : []);
    setServiceSlots(Array.isArray(p.serviceSlots) ? p.serviceSlots : []);
    setEventDateInput(
      p.eventDate ? new Date(p.eventDate).toISOString().slice(0, 10) : ""
    );
    setEventTimeInput(p.eventTime ?? "");
    setCategories(Array.isArray(p.categories) ? p.categories : []);
    setTags(Array.isArray(p.tags) ? p.tags : []);
    setMediaMimeType(p.mediaMimeType ?? null);
    const allSplits = await getRevenueSplitsForOwner(user.id, "product");
    const forThis = (allSplits ?? []).filter((s) => s.target_id === p.id);
    setRevenueSplits(
      forThis.map((s) => ({
        partnerUsername: (s.partner as { username?: string })?.username ?? "",
        splitPercent: String(s.split_percent),
      }))
    );
    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const { profile, saveTagsToProfile } = useProfile();
  const savedTags = profile.categoryTags ?? [];

  const addTag = (raw: string) => {
    const t = raw.replace(/^#/, "").replace(/[^a-zA-Z0-9_-]/g, " ").trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
  };
  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag));

  const addTier = () =>
    setPriceTiers((prev) => [...prev, { name: "", price: "" }]);
  const updateTier = (i: number, field: "name" | "price" | "description", value: string) =>
    setPriceTiers((prev) =>
      prev.map((t, j) => (j === i ? { ...t, [field]: value } : t))
    );
  const removeTier = (i: number) =>
    setPriceTiers((prev) => prev.filter((_, j) => j !== i));

  const addServiceSlot = () =>
    setServiceSlots((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        startTime: "09:00",
        endTime: "10:00",
        available: true,
      },
    ]);
  const updateSlot = (i: number, field: keyof ServiceSlot, value: string | boolean) =>
    setServiceSlots((prev) =>
      prev.map((s, j) => (j === i ? { ...s, [field]: value } : s))
    );
  const removeSlot = (i: number) =>
    setServiceSlots((prev) => prev.filter((_, j) => j !== i));

  const addRevenueSplit = () =>
    setRevenueSplits((prev) => [...prev, { partnerUsername: "", splitPercent: "" }]);
  const updateRevenueSplit = (i: number, field: "partnerUsername" | "splitPercent", value: string) =>
    setRevenueSplits((prev) =>
      prev.map((s, j) =>
        j === i
          ? { ...s, [field]: field === "splitPercent" ? value.replace(/\D/g, "").slice(0, 2) : value }
          : s
      )
    );
  const removeRevenueSplit = (i: number) =>
    setRevenueSplits((prev) => prev.filter((_, j) => j !== i));
  const totalSplitPercent = revenueSplits.reduce((sum, s) => sum + (parseInt(s.splitPercent, 10) || 0), 0);

  const handleSave = async () => {
    if (!product || !user?.id || !supabase) return;
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a product title.");
      return;
    }
    const isDigital = product.type === "digital";
    if (isDigital && !coverImageUri) {
      Alert.alert("Cover art required", "Please add cover art for digital products.");
      return;
    }
    if (isDigital && !mediaUri) {
      Alert.alert("File required", "Please set the digital file for delivery.");
      return;
    }
    setSaving(true);
    let eventDate: number | undefined;
    if (product.type === "event" && eventDateInput.trim()) {
      const ts = new Date(eventDateInput.trim()).getTime();
      if (!isNaN(ts)) eventDate = ts;
    }
    const finalCategories = categories.filter((c) => c !== "Custom").slice(0, MAX_CATEGORIES);
    const payload = {
      ...product,
      title: title.trim(),
      description: description.trim() || undefined,
      price: price.trim() || undefined,
      mediaUri: mediaUri ?? undefined,
      coverUri: isDigital ? (coverImageUri ?? undefined) : undefined,
      mediaMimeType: mediaMimeType ?? product.mediaMimeType ?? undefined,
      interval: product.type === "membership" && interval ? interval : undefined,
      priceTiers: priceTiers.length > 0 ? priceTiers : undefined,
      serviceSlots: serviceSlots.length > 0 ? serviceSlots : undefined,
      eventDate,
      eventTime: product.type === "event" && eventTimeInput.trim() ? eventTimeInput.trim() : undefined,
      categories: finalCategories.length > 0 ? finalCategories : undefined,
      tags: tags.length > 0 ? tags : undefined,
    };
    const row = productToRow(payload, user.id);
    const { error } = await supabase
      .from("products")
      .update(row)
      .eq("id", product.id)
      .eq("creator_id", user.id);
    if (error) {
      setSaving(false);
      Alert.alert("Error", error.message || "Could not update product.");
      return;
    }
    const parsedSplits = revenueSplits
      .map((s) => ({
        partnerUsername: s.partnerUsername.trim(),
        splitPercent: parseInt(s.splitPercent, 10) || 0,
      }))
      .filter((s) => s.partnerUsername && s.splitPercent >= 1 && s.splitPercent <= 99);
    if (parsedSplits.length > 0 && parsedSplits.reduce((sum, s) => sum + s.splitPercent, 0) > 99) {
      setSaving(false);
      Alert.alert("Invalid splits", "Total partner share cannot exceed 99%.");
      return;
    }
    await supabase
      .from("revenue_splits")
      .delete()
      .eq("owner_id", user.id)
      .eq("target_type", "product")
      .eq("target_id", product.id);
    for (const s of parsedSplits) {
      const partnerId = await getProfileIdByUsername(s.partnerUsername);
      if (partnerId) {
        await createRevenueSplit({
          ownerId: user.id,
          partnerId,
          targetType: "product",
          targetId: product.id,
          splitPercent: s.splitPercent,
        });
      }
    }
    updateProduct(product.id, {
      title: payload.title,
      description: payload.description,
      price: payload.price,
      mediaUri: payload.mediaUri,
      coverUri: payload.coverUri,
      mediaMimeType: payload.mediaMimeType,
      interval: payload.interval,
      priceTiers: payload.priceTiers,
      serviceSlots: payload.serviceSlots,
      eventDate: payload.eventDate,
      eventTime: payload.eventTime,
      categories: payload.categories,
      tags: payload.tags,
    });
    setSaving(false);
    router.back();
  };

  const handleDelete = () => {
    if (!product || !user?.id || !supabase) return;
    Alert.alert("Delete product?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("products")
            .delete()
            .eq("id", product.id)
            .eq("creator_id", user.id);
          if (error) {
            Alert.alert("Error", "Could not delete product.");
            return;
          }
          deleteProduct(product.id);
          router.replace("/(tabs)/profile");
        },
      },
    ]);
  };

  const handleUploadDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setMediaUri(asset.uri);
        if (asset.mimeType) setMediaMimeType(asset.mimeType);
      }
    } catch {
      Alert.alert("Error", "Could not open file.");
    }
  };

  const handleUploadCoverImage = async () => {
    const result = await pickImage();
    if (result) setCoverImageUri(result.uri);
  };

  const handleUploadImage = async () => {
    const result = await pickImage();
    if (result) setMediaUri(result.uri);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Edit product" }} />
        <View className="flex-1 bg-zinc-950 items-center justify-center">
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Stack.Screen options={{ title: "Edit product" }} />
        <View className="flex-1 bg-zinc-950 items-center justify-center px-4">
          <Text className="text-zinc-400 text-center">Product not found or you can’t edit it.</Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-4 rounded-xl bg-zinc-700 px-4 py-2">
            <Text className="text-zinc-100">Go back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const isDigital = product.type === "digital";
  const isPhysical = product.type === "physical";
  const isMembership = product.type === "membership";
  const isServices = product.type === "services";
  const isEvent = product.type === "event";
  const isNft = product.type === "nft";
  const isLive = product.type === "live";
  const typeLabel: Record<string, string> = {
    digital: "Digital",
    physical: "Physical",
    membership: "Membership",
    services: "Services",
    event: "Event",
    nft: "NFT",
    live: "Live",
  };

  return (
    <>
      <Stack.Screen options={{ title: `Edit ${typeLabel[product.type] ?? product.type}` }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-zinc-950"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="mb-1 text-sm text-zinc-400">Type (read-only)</Text>
          <Text className="mb-4 text-zinc-300">{typeLabel[product.type] ?? product.type}</Text>

          <Text className="mb-1 text-sm text-zinc-400">Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Product name"
            placeholderTextColor="#71717a"
            className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
          />

          {isDigital && (
            <>
              <Text className="mb-1 text-sm text-zinc-400">Cover art (required)</Text>
              <View className="mb-4 rounded-xl border-2 border-dashed border-zinc-600 overflow-hidden bg-zinc-800/50">
                {coverImageUri ? (
                  <>
                    <View className="aspect-video w-full bg-zinc-800">
                      <Image source={{ uri: coverImageUri }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                    </View>
                    <View className="flex-row justify-center gap-3 border-t border-zinc-700/50 py-3 px-4">
                      <TouchableOpacity onPress={() => setCoverImageUri(null)} className="rounded-lg bg-zinc-700 px-3 py-1.5">
                        <Text className="text-sm text-zinc-300">Clear</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleUploadCoverImage} className="rounded-lg bg-amber-600/80 px-3 py-1.5">
                        <Text className="text-sm text-white">Change</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity onPress={handleUploadCoverImage} className="flex-row items-center justify-center gap-2 py-6">
                    <Ionicons name="image-outline" size={28} color="#71717a" />
                    <Text className="text-zinc-500">Tap to upload cover art</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text className="mb-1 text-sm text-zinc-400">Digital file</Text>
              <View className="mb-4 rounded-xl border-2 border-dashed border-zinc-600 py-6 bg-zinc-800/50">
                <TouchableOpacity onPress={handleUploadDocument} className="flex-row items-center justify-center gap-2">
                  <Ionicons name="cloud-upload-outline" size={28} color={mediaUri ? "#f59e0b" : "#71717a"} />
                  <Text className={mediaUri ? "font-medium text-amber-400" : "text-zinc-500"}>
                    {mediaUri ? "File selected" : "Tap to change file"}
                  </Text>
                </TouchableOpacity>
                {mediaUri && (
                  <TouchableOpacity onPress={() => setMediaUri(null)} className="mt-3 items-center">
                    <Text className="text-sm text-zinc-400">Clear file</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {(isPhysical || isNft || isLive) && (
            <>
              <Text className="mb-1 text-sm text-zinc-400">Product photo</Text>
              <View className="mb-4 rounded-xl border-2 border-dashed border-zinc-600 overflow-hidden bg-zinc-800/50">
                {mediaUri ? (
                  <>
                    <View className="aspect-video w-full bg-zinc-800">
                      <Image source={{ uri: mediaUri }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                    </View>
                    <View className="flex-row justify-center gap-3 border-t border-zinc-700/50 py-3 px-4">
                      <TouchableOpacity onPress={() => setMediaUri(null)} className="rounded-lg bg-zinc-700 px-3 py-1.5">
                        <Text className="text-sm text-zinc-300">Clear</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleUploadImage} className="rounded-lg bg-amber-600/80 px-3 py-1.5">
                        <Text className="text-sm text-white">Change</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity onPress={handleUploadImage} className="flex-row items-center justify-center gap-2 py-6">
                    <Ionicons name="image-outline" size={28} color="#71717a" />
                    <Text className="text-zinc-500">Tap to upload photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          <Text className="mb-1 text-sm text-zinc-400">Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your product..."
            placeholderTextColor="#71717a"
            multiline
            numberOfLines={3}
            className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
            style={{ minHeight: 80, textAlignVertical: "top" }}
          />

          <Text className="mb-1 text-sm text-zinc-400">Categories (max {MAX_CATEGORIES})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2" contentContainerStyle={{ gap: 8 }}>
            {PRODUCT_CATEGORIES.map((cat) => {
              const selected = categories.includes(cat);
              const atMax = categories.length >= MAX_CATEGORIES && !selected;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    if (selected) setCategories((prev) => prev.filter((c) => c !== cat));
                    else if (!atMax) setCategories((prev) => [...prev, cat].slice(0, MAX_CATEGORIES));
                  }}
                  className={`rounded-full border px-4 py-2 ${selected ? "border-amber-500 bg-amber-500/20" : atMax ? "border-zinc-700 bg-zinc-800/50 opacity-60" : "border-zinc-600 bg-zinc-800"}`}
                >
                  <Text className={selected ? "text-amber-400 font-medium" : "text-zinc-400"}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {categories.includes("Custom") && (
            <View className="mb-3 flex-row items-center gap-2">
              <TextInput
                value={customCategory}
                onChangeText={setCustomCategory}
                placeholder="Category name"
                placeholderTextColor="#71717a"
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-100"
              />
              <TouchableOpacity
                onPress={() => {
                  const v = customCategory.trim();
                  if (v && categories.length < MAX_CATEGORIES && !categories.includes(v)) {
                    setCategories((prev) => [...prev.filter((c) => c !== "Custom"), v].slice(0, MAX_CATEGORIES));
                    setCustomCategory("");
                  }
                }}
                className="rounded-full bg-amber-600 px-4 py-2"
              >
                <Text className="text-sm font-semibold text-white">Add</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text className="mb-1 text-sm text-zinc-400">Tags</Text>
          <View className="mb-2 flex-row flex-wrap items-center gap-2">
            {savedTags.length > 0 && (
              <>
                <Text className="text-xs text-zinc-500">Saved:</Text>
                {savedTags
                  .filter((t) => !tags.includes(t))
                  .map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => addTag(tag)}
                      className="rounded-full bg-zinc-700 px-3 py-1.5"
                    >
                      <Text className="text-xs text-zinc-300">{tag}</Text>
                    </TouchableOpacity>
                  ))}
              </>
            )}
            <TouchableOpacity
              onPress={() => tags.length > 0 && saveTagsToProfile(tags)}
              disabled={tags.length === 0}
              className="rounded-full border border-violet-500/50 px-3 py-1.5"
            >
              <Text className="text-xs text-violet-400">Save tags</Text>
            </TouchableOpacity>
          </View>
          <View className="mb-4 flex-row flex-wrap gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2">
            {tags.map((tag) => (
              <View key={tag} className="flex-row items-center gap-1 rounded-full bg-amber-600/20 border border-amber-500/50 px-3 py-1.5">
                <Text className="text-sm text-amber-300">{tag}</Text>
                <TouchableOpacity onPress={() => removeTag(tag)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#f59e0b" />
                </TouchableOpacity>
              </View>
            ))}
            <View className="flex-1 flex-row items-center gap-2 min-w-[100px]">
              <TextInput
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add tag..."
                placeholderTextColor="#71717a"
                className="flex-1 py-1.5 text-sm text-zinc-100"
                onSubmitEditing={() => { if (tagInput.trim()) addTag(tagInput.trim()); }}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={() => { if (tagInput.trim()) addTag(tagInput.trim()); setTagInput(""); }}
                className="rounded-full bg-amber-600 px-3 py-1.5"
              >
                <Text className="text-xs font-semibold text-white">Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm text-zinc-400">Revenue share</Text>
              <TouchableOpacity
                onPress={addRevenueSplit}
                disabled={totalSplitPercent >= 99}
                className="rounded-lg bg-zinc-700 px-3 py-1.5"
              >
                <Text className="text-sm text-violet-400">+ Add partner</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-zinc-500 mb-2">
              Split profits with partners by username. Total partner share up to 99%. You keep the remainder.
            </Text>
            {revenueSplits.map((split, i) => (
              <View key={i} className="mb-3 flex-row gap-2 items-center rounded-xl border border-zinc-700 bg-zinc-800/80 p-3">
                <TextInput
                  value={split.partnerUsername}
                  onChangeText={(v) => updateRevenueSplit(i, "partnerUsername", v)}
                  placeholder="@username"
                  placeholderTextColor="#71717a"
                  className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                  autoCapitalize="none"
                />
                <TextInput
                  value={split.splitPercent}
                  onChangeText={(v) => updateRevenueSplit(i, "splitPercent", v)}
                  placeholder="%"
                  placeholderTextColor="#71717a"
                  keyboardType="number-pad"
                  className="w-14 rounded-lg bg-zinc-800 px-2 py-2 text-sm text-zinc-100 text-center"
                />
                <TouchableOpacity onPress={() => removeRevenueSplit(i)}>
                  <Ionicons name="close-circle" size={22} color="#71717a" />
                </TouchableOpacity>
              </View>
            ))}
            {totalSplitPercent > 0 && (
              <Text className="text-xs text-zinc-500">
                Partner total: {totalSplitPercent}% · You keep: {100 - totalSplitPercent}%
              </Text>
            )}
          </View>

          <Text className="mb-1 text-sm text-zinc-400">Price</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="e.g. $20"
            placeholderTextColor="#71717a"
            className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
          />

          {isMembership && (
            <>
              <Text className="mb-1 text-sm text-zinc-400">Billing interval</Text>
              <View className="mb-4 flex-row gap-2">
                {(["monthly", "yearly"] as const).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setInterval(interval === opt ? "" : opt)}
                    className={`flex-1 rounded-xl border px-4 py-3 ${interval === opt ? "border-amber-500 bg-amber-500/20" : "border-zinc-700 bg-zinc-800"}`}
                  >
                    <Text className={`text-center font-medium ${interval === opt ? "text-amber-400" : "text-zinc-400"}`}>{opt === "monthly" ? "Monthly" : "Yearly"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {isEvent && (
            <>
              <Text className="mb-1 text-sm text-zinc-400">Event date</Text>
              <TextInput
                value={eventDateInput}
                onChangeText={setEventDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#71717a"
                className="mb-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
              />
              <Text className="mb-1 text-sm text-zinc-400">Event time</Text>
              <TextInput
                value={eventTimeInput}
                onChangeText={setEventTimeInput}
                placeholder="e.g. 7:00 PM"
                placeholderTextColor="#71717a"
                className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
              />
            </>
          )}

          {isServices && (
            <>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm text-zinc-400">Time slots</Text>
                <TouchableOpacity onPress={addServiceSlot} className="rounded-lg bg-zinc-700 px-3 py-1.5">
                  <Text className="text-sm text-violet-400">+ Add slot</Text>
                </TouchableOpacity>
              </View>
              {serviceSlots.map((slot, i) => (
                <View key={slot.id} className="mb-3 rounded-xl border border-zinc-700 bg-zinc-800/80 p-3">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-xs text-zinc-500">Slot {i + 1}</Text>
                    <TouchableOpacity onPress={() => removeSlot(i)}>
                      <Ionicons name="close-circle" size={20} color="#71717a" />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    value={slot.date}
                    onChangeText={(v) => updateSlot(i, "date", v)}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#71717a"
                    className="mb-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                  />
                  <View className="flex-row gap-2">
                    <TextInput
                      value={slot.startTime}
                      onChangeText={(v) => updateSlot(i, "startTime", v)}
                      placeholder="09:00"
                      placeholderTextColor="#71717a"
                      className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                    />
                    <TextInput
                      value={slot.endTime}
                      onChangeText={(v) => updateSlot(i, "endTime", v)}
                      placeholder="10:00"
                      placeholderTextColor="#71717a"
                      className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
                    />
                  </View>
                </View>
              ))}
              {serviceSlots.length === 0 && <Text className="text-xs text-zinc-500 mb-4">Add time slots for booking.</Text>}
            </>
          )}

          <View className="flex-row items-center justify-between mb-2 mt-2">
            <Text className="text-sm text-zinc-400">Tiered pricing</Text>
            <TouchableOpacity onPress={addTier} className="rounded-lg bg-zinc-700 px-3 py-1.5">
              <Text className="text-sm text-violet-400">+ Add tier</Text>
            </TouchableOpacity>
          </View>
          {priceTiers.map((tier, i) => (
            <View key={i} className="mb-3 rounded-xl border border-zinc-700 bg-zinc-800/80 p-3">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-xs text-zinc-500">Tier {i + 1}</Text>
                <TouchableOpacity onPress={() => removeTier(i)}>
                  <Ionicons name="close-circle" size={20} color="#71717a" />
                </TouchableOpacity>
              </View>
              <TextInput
                value={tier.name}
                onChangeText={(v) => updateTier(i, "name", v)}
                placeholder="e.g. Basic, Pro"
                placeholderTextColor="#71717a"
                className="mb-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              />
              <TextInput
                value={tier.price}
                onChangeText={(v) => updateTier(i, "price", v)}
                placeholder="Price"
                placeholderTextColor="#71717a"
                className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              />
            </View>
          ))}

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl bg-violet-600 py-3 mt-4 disabled:opacity-50"
          >
            <Text className="text-center font-semibold text-white">{saving ? "Saving…" : "Save changes"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDelete}
            className="mt-4 rounded-xl border border-red-500/50 py-3"
          >
            <Text className="text-center font-medium text-red-400">Delete product</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
