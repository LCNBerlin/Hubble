import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useNavigation } from "expo-router";
import { useEffect, useLayoutEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { SchedulePicker } from "../../components/SchedulePicker";
import { useAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import type {
    PostType,
    PriceTier,
    ProductType,
    ServiceSlot,
} from "../../context/ContentContext";
import { useContent } from "../../context/ContentContext";
import { getHashtagsFromPostContent, syncPostHashtags } from "../../lib/hashtags";
import {
  Accuracy as LocationAccuracy,
  getCurrentPositionAsync,
  requestForegroundPermissionsAsync,
} from "../../lib/location";
import { uploadPostMedia } from "../../lib/postUpload";
import { createRevenueSplit, getProfileIdByUsername } from "../../lib/revenue-splits";
import supabase from "../../lib/supabase";
import { productToRow, rowToProduct } from "../../lib/supabase-products";

const POST_OPTIONS: { id: PostType; label: string; icon: string; disabled?: boolean }[] = [
  { id: "blog", label: "Blog", icon: "document-text-outline" },
  { id: "picture", label: "Picture", icon: "image-outline" },
  { id: "audio", label: "Audio", icon: "musical-notes-outline" },
  { id: "video", label: "Video", icon: "videocam-outline" },
  { id: "polls", label: "Polls", icon: "stats-chart-outline" },
];

const PRODUCT_OPTIONS: { id: ProductType; label: string; icon: string }[] = [
  { id: "digital", label: "Digital (instant delivery)", icon: "cloud-download-outline" },
  { id: "physical", label: "Physical Products", icon: "cube-outline" },
  { id: "services", label: "Service Bookings", icon: "calendar-outline" },
  { id: "membership", label: "Membership / Subscription", icon: "people-outline" },
  { id: "nft", label: "NFT Listings", icon: "diamond-outline" },
  { id: "live", label: "Live Shopping", icon: "videocam-outline" },
  { id: "event", label: "Ticketed Events", icon: "ticket-outline" },
];

type CategoryModalType = "post" | "product" | "event" | null;

function OptionsModal({
  visible,
  title,
  options,
  onClose,
  onSelectPost,
  onSelectProduct,
}: {
  visible: boolean;
  title: string;
  options: { id: string; label: string; icon: string; disabled?: boolean }[];
  onClose: () => void;
  onSelectPost?: (type: PostType) => void;
  onSelectProduct?: (type: ProductType) => void;
}) {
  const isPost = !!onSelectPost;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-center bg-black/60 px-6" onPress={onClose}>
        <Pressable
          className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-zinc-100">{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-zinc-700"
            >
              <Ionicons name="close" size={20} color="#a1a1aa" />
            </TouchableOpacity>
          </View>
          <View className="gap-2">
            {options.map((opt) => {
              const disabled = "disabled" in opt && opt.disabled;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => {
                    if (disabled) return;
                    onClose();
                    if (isPost) onSelectPost?.(opt.id as PostType);
                    else onSelectProduct?.(opt.id as ProductType);
                  }}
                  disabled={disabled}
                  className={`flex-row items-center gap-3 rounded-xl border px-4 py-3 ${
                    disabled
                      ? "border-zinc-800 bg-zinc-800/50 opacity-60"
                      : "border-zinc-700/80 bg-zinc-800/80 active:opacity-80"
                  }`}
                >
                  <Ionicons
                    name={opt.icon as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color={disabled ? "#52525b" : "#a78bfa"}
                  />
                  <Text
                    className={`flex-1 text-base ${disabled ? "text-zinc-500" : "text-zinc-100"}`}
                  >
                    {opt.label}
                  </Text>
                  {!disabled && (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#71717a"
                      style={{ marginLeft: "auto" }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

async function pickImageFromLibrary(): Promise<{ uri: string; mimeType?: string | null } | null> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Photo access",
        "Photo library access was denied. You can enable it in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, mimeType: asset.mimeType ?? null };
  } catch {
    Alert.alert("Error", "Couldn't open the photo library. Please try again.");
    return null;
  }
}

async function pickImageFromFiles(): Promise<{ uri: string; mimeType?: string | null } | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "image/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, mimeType: asset.mimeType ?? null };
  } catch {
    Alert.alert("Error", "Couldn't open the file. Please try again.");
    return null;
  }
}

async function pickImageFromCamera(): Promise<{ uri: string; mimeType?: string | null } | null> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera access",
        "Camera access was denied. You can enable it in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, mimeType: asset.mimeType ?? null };
  } catch {
    Alert.alert("Error", "Couldn't open the camera. Please try again.");
    return null;
  }
}

async function pickImage(): Promise<{ uri: string; mimeType?: string | null } | null> {
  return pickImageFromLibrary();
}

async function pickVideoFromLibrary(): Promise<{ uri: string; mimeType?: string | null } | null> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Photo access",
        "Photo library access is needed to pick a video. You can enable it in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      videoMaxDuration: undefined,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, mimeType: asset.mimeType ?? null };
  } catch {
    Alert.alert("Error", "Couldn't open the video library. Please try again.");
    return null;
  }
}

async function pickVideoFromFiles(): Promise<{ uri: string; mimeType?: string | null } | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "video/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, mimeType: asset.mimeType ?? null };
  } catch {
    Alert.alert("Error", "Couldn't open the file. Please try again.");
    return null;
  }
}

async function pickVideoFromCamera(): Promise<{ uri: string; mimeType?: string | null } | null> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera access",
        "Camera access was denied. You can enable it in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      videoMaxDuration: undefined,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, mimeType: asset.mimeType ?? null };
  } catch {
    Alert.alert("Error", "Couldn't open the camera. Please try again.");
    return null;
  }
}

async function pickAudio(): Promise<{ uri: string; mimeType?: string | null } | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, mimeType: asset.mimeType ?? null };
  } catch {
    Alert.alert("Error", "Couldn't open the file. Please try again.");
    return null;
  }
}

async function pickVideo(): Promise<{ uri: string; mimeType?: string | null } | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "video/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, mimeType: asset.mimeType ?? null };
  } catch {
    Alert.alert("Error", "Couldn't open the file. Please try again.");
    return null;
  }
}

function CreatePostModal({
  visible,
  type,
  typeLabel,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  type: PostType;
  typeLabel: string;
  onClose: () => void;
  onSubmit: (data: {
    title?: string;
    body: string;
    mediaUri?: string;
    mediaMimeType?: string | null;
    thumbnailUri?: string;
    lat?: number;
    lng?: number;
    place_name?: string;
    hashtags?: string[];
    scheduledAt?: number;
    pollOptions?: string[];
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; place_name?: string } | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const createVideoPlayer = useVideoPlayer(
    type === "video" && mediaUri ? mediaUri : null,
    (p) => {
      p.muted = true;
    }
  );

  const { profile, saveTagsToProfile } = useProfile();
  const savedHashtags = profile.categoryTags ?? [];

  const normalizeTag = (raw: string) => raw.replace(/^#/, "").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase().trim();
  const addHashtag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag) return;
    setHashtags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    setHashtagInput("");
  };
  const removeHashtag = (tag: string) => setHashtags((prev) => prev.filter((t) => t !== tag));

  const needsUpload = type === "picture" || type === "audio" || type === "video";
  const isPoll = type === "polls";

  const addPollOption = () => {
    if (pollOptions.length < 10) setPollOptions((prev) => [...prev, ""]);
  };
  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) setPollOptions((prev) => prev.filter((_, i) => i !== index));
  };
  const setPollOptionAt = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const handleUpload = async () => {
    if (type === "picture") {
      Alert.alert("Add photo", "Choose a source", [
        { text: "Cancel", style: "cancel" },
        { text: "Camera", onPress: async () => {
          const result = await pickImageFromCamera();
          if (result) {
            setMediaUri(result.uri);
            setMediaMimeType(result.mimeType ?? null);
          }
        } },
        { text: "Photo library", onPress: async () => {
          const result = await pickImageFromLibrary();
          if (result) {
            setMediaUri(result.uri);
            setMediaMimeType(result.mimeType ?? null);
          }
        } },
        { text: "Browse files", onPress: async () => {
          const result = await pickImageFromFiles();
          if (result) {
            setMediaUri(result.uri);
            setMediaMimeType(result.mimeType ?? null);
          }
        } },
      ]);
    } else if (type === "video") {
      Alert.alert("Add video", "Choose a source", [
        { text: "Cancel", style: "cancel" },
        { text: "Camera", onPress: async () => {
          const result = await pickVideoFromCamera();
          if (result) {
            setMediaUri(result.uri);
            setMediaMimeType(result.mimeType ?? null);
          }
        } },
        { text: "Video library", onPress: async () => {
          const result = await pickVideoFromLibrary();
          if (result) {
            setMediaUri(result.uri);
            setMediaMimeType(result.mimeType ?? null);
          }
        } },
        { text: "Browse files", onPress: async () => {
          const result = await pickVideoFromFiles();
          if (result) {
            setMediaUri(result.uri);
            setMediaMimeType(result.mimeType ?? null);
          }
        } },
      ]);
    } else if (type === "audio") {
      const result = await pickAudio();
      if (result) {
        setMediaUri(result.uri);
        setMediaMimeType(result.mimeType ?? null);
      }
    }
  };

  const handleAddLocation = async () => {
    try {
      const perm = await requestForegroundPermissionsAsync();
      if (!perm) {
        Alert.alert("Location", "Location is not available on this device.");
        return;
      }
      if (perm.status !== "granted") {
        Alert.alert(
          "Location",
          "Location permission was denied. You can enable it in Settings.",
          [{ text: "OK" }]
        );
        return;
      }
      const loc = await getCurrentPositionAsync({ accuracy: LocationAccuracy.Balanced });
      if (!loc) {
        Alert.alert("Location", "Could not get your location. Please try again.");
        return;
      }
      setLocation({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        place_name: "Current location",
      });
    } catch {
      Alert.alert("Location", "Could not get your location. Please try again.");
    }
  };

  const handleSubmit = () => {
    if (hashtagInput.trim()) addHashtag(hashtagInput.trim());
    if (isPoll) {
      const question = (title.trim() || body.trim()).trim();
      const options = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (!question) {
        Alert.alert("Missing question", "Enter your poll question.");
        return;
      }
      if (options.length < 2) {
        Alert.alert("Need at least 2 options", "Add at least two choices for your poll.");
        return;
      }
      onSubmit({
        title: question,
        body: "",
        pollOptions: options,
        hashtags: hashtags.length > 0 ? hashtags : undefined,
        scheduledAt: scheduleEnabled ? scheduledAt.getTime() : undefined,
      });
      setPollOptions(["", ""]);
    } else if (needsUpload && (!title.trim() || !mediaUri)) {
      return;
    } else {
      onSubmit({
        title: title.trim() || undefined,
        body: body.trim(),
        mediaUri: mediaUri ?? undefined,
        mediaMimeType: mediaMimeType ?? undefined,
        thumbnailUri: (type === "video" || type === "audio") && thumbnailUri ? thumbnailUri : undefined,
        lat: location?.lat,
        lng: location?.lng,
        place_name: location?.place_name,
        hashtags: hashtags.length > 0 ? hashtags : undefined,
        scheduledAt: scheduleEnabled ? scheduledAt.getTime() : undefined,
      });
    }
    setTitle("");
    setBody("");
    setMediaUri(null);
    setMediaMimeType(null);
    setThumbnailUri(null);
    setLocation(null);
    setHashtags([]);
    setHashtagInput("");
    setScheduleEnabled(false);
    onClose();
  };

  const handlePickThumbnail = async () => {
    const result = await pickImageFromLibrary();
    if (result) setThumbnailUri(result.uri);
  };

  useEffect(() => {
    if (!visible) {
      setTitle("");
      setBody("");
      setMediaUri(null);
      setMediaMimeType(null);
      setThumbnailUri(null);
      setLocation(null);
      setHashtags([]);
      setHashtagInput("");
      setPollOptions(["", ""]);
      setScheduleEnabled(false);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <Pressable className="flex-1 justify-center bg-black/60 px-4" onPress={onClose}>
          <Pressable
            className="max-h-[80%] rounded-2xl border border-zinc-700 bg-zinc-900 p-5"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-zinc-100">
                New {typeLabel}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                className="h-8 w-8 items-center justify-center rounded-full bg-zinc-700"
              >
                <Ionicons name="close" size={20} color="#a1a1aa" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {type === "blog" && (
                <>
                  <Text className="mb-1 text-sm text-zinc-400">Title (optional)</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Give it a title"
                    placeholderTextColor="#71717a"
                    className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
                  />
                  <Text className="mb-1 text-sm text-zinc-400">Description (optional)</Text>
                  <TextInput
                    value={body}
                    onChangeText={setBody}
                    placeholder="Add a short description..."
                    placeholderTextColor="#71717a"
                    multiline
                    numberOfLines={3}
                    className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
                    style={{ minHeight: 80, textAlignVertical: "top" }}
                  />
                </>
              )}
              {isPoll && (
                <>
                  <Text className="mb-1 text-sm text-zinc-400">Poll question</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="What do you want to ask?"
                    placeholderTextColor="#71717a"
                    className="mb-3 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
                  />
                  <Text className="mb-1 text-sm text-zinc-400">Options (min 2, max 10)</Text>
                  {pollOptions.map((opt, index) => (
                    <View key={index} className="mb-2 flex-row items-center gap-2">
                      <TextInput
                        value={opt}
                        onChangeText={(t) => setPollOptionAt(index, t)}
                        placeholder={`Option ${index + 1}`}
                        placeholderTextColor="#71717a"
                        className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-base text-zinc-100"
                      />
                      <TouchableOpacity
                        onPress={() => removePollOption(index)}
                        disabled={pollOptions.length <= 2}
                        className="h-10 w-10 items-center justify-center rounded-full bg-zinc-700"
                      >
                        <Ionicons name="remove" size={22} color={pollOptions.length <= 2 ? "#52525b" : "#e4e4e7"} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {pollOptions.length < 10 && (
                    <TouchableOpacity
                      onPress={addPollOption}
                      className="mb-4 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-600 py-2.5"
                    >
                      <Ionicons name="add-circle-outline" size={22} color="#a78bfa" />
                      <Text className="text-violet-400">Add option</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
              {(type === "picture" || type === "audio" || type === "video") && (
                <>
                  <Text className="mb-1 text-sm text-zinc-400">Title</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Give it a title"
                    placeholderTextColor="#71717a"
                    className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
                  />
                  <Text className="mb-1 text-sm text-zinc-400">Description</Text>
                  <TextInput
                    value={body}
                    onChangeText={setBody}
                    placeholder="Add a description (optional)"
                    placeholderTextColor="#71717a"
                    multiline
                    numberOfLines={3}
                    className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
                    style={{ minHeight: 80, textAlignVertical: "top" }}
                  />
                  <Text className="mb-1 text-sm text-zinc-400">
                    {type === "picture" ? "Image" : type === "audio" ? "Audio" : "Video"}
                  </Text>
                  <View
                    className={`mb-4 rounded-xl border-2 border-dashed overflow-hidden ${
                      mediaUri ? "border-violet-500 bg-violet-500/10" : "border-zinc-600 bg-zinc-800/50"
                    }`}
                  >
                    {mediaUri ? (
                      <>
                        {type === "picture" && (
                          <View className="aspect-video w-full bg-zinc-800">
                            <Image
                              source={{ uri: mediaUri }}
                              style={{ width: "100%", height: "100%" }}
                              contentFit="contain"
                            />
                          </View>
                        )}
                        {type === "video" && (
                          <View className="aspect-video w-full bg-zinc-800">
                            <VideoView
                              player={createVideoPlayer}
                              style={{ width: "100%", height: "100%" }}
                              contentFit="contain"
                              nativeControls
                            />
                          </View>
                        )}
                        {type === "audio" && (
                          <View className="flex-row items-center justify-center gap-2 py-6">
                            <Ionicons name="musical-notes" size={32} color="#a78bfa" />
                            <Text className="font-medium text-violet-400">Audio file selected</Text>
                          </View>
                        )}
                        <View className="flex-row justify-center gap-3 border-t border-zinc-700/50 py-3 px-4">
                          <TouchableOpacity
                            onPress={() => setMediaUri(null)}
                            className="rounded-lg bg-zinc-700 px-3 py-1.5 active:opacity-80"
                          >
                            <Text className="text-sm text-zinc-300">Clear</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleUpload}
                            className="rounded-lg bg-violet-600/80 px-3 py-1.5 active:opacity-80"
                          >
                            <Text className="text-sm text-white">Change file</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={handleUpload}
                        className="flex-row items-center justify-center gap-2 py-6"
                      >
                        <Ionicons
                          name={
                            type === "picture"
                              ? "image-outline"
                              : type === "audio"
                                ? "musical-notes-outline"
                                : "videocam-outline"
                          }
                          size={28}
                          color="#71717a"
                        />
                        <Text className="text-zinc-500">Tap to upload</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {(type === "video" || type === "audio") && (
                    <View className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3">
                      <Text className="mb-2 text-sm text-zinc-400">Thumbnail (optional)</Text>
                      <Text className="mb-2 text-xs text-zinc-500">Shown in Creator Studio grid and profile.</Text>
                      {thumbnailUri ? (
                        <View className="flex-row items-center gap-2">
                          <Image
                            source={{ uri: thumbnailUri }}
                            style={{ width: 64, height: 36, borderRadius: 6 }}
                            contentFit="cover"
                          />
                          <TouchableOpacity
                            onPress={() => setThumbnailUri(null)}
                            className="rounded-lg bg-zinc-700 px-2 py-1.5"
                          >
                            <Text className="text-xs text-zinc-300">Clear</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handlePickThumbnail}
                            className="rounded-lg bg-violet-600/80 px-2 py-1.5"
                          >
                            <Text className="text-xs text-white">Change</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={handlePickThumbnail}
                          className="flex-row items-center gap-2 rounded-lg border border-dashed border-zinc-600 py-2.5 px-3 self-start"
                        >
                          <Ionicons name="image-outline" size={18} color="#71717a" />
                          <Text className="text-sm text-zinc-400">Pick thumbnail image</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              )}
              <Text className="mb-1 text-sm text-zinc-400">Hashtags</Text>
              <View className="mb-2 flex-row flex-wrap items-center gap-2">
                {savedHashtags.length > 0 && (
                  <>
                    <Text className="text-xs text-zinc-500">Saved:</Text>
                    {savedHashtags
                      .filter((t) => !hashtags.includes(t))
                      .map((tag) => (
                        <TouchableOpacity
                          key={tag}
                          onPress={() => addHashtag(tag)}
                          className="rounded-full bg-zinc-700 px-3 py-1.5"
                        >
                          <Text className="text-xs text-zinc-300">#{tag}</Text>
                        </TouchableOpacity>
                      ))}
                  </>
                )}
                <TouchableOpacity
                  onPress={() => hashtags.length > 0 && saveTagsToProfile(hashtags)}
                  disabled={hashtags.length === 0}
                  className="rounded-full border border-violet-500/50 px-3 py-1.5"
                >
                  <Text className="text-xs text-violet-400">Save hashtags</Text>
                </TouchableOpacity>
              </View>
              <View className="mb-3 flex-row flex-wrap gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2">
                {hashtags.map((tag) => (
                  <View
                    key={tag}
                    className="flex-row items-center gap-1 rounded-full bg-violet-600/30 border border-violet-500/50 px-3 py-1.5"
                  >
                    <Text className="text-sm text-violet-300">#{tag}</Text>
                    <TouchableOpacity
                      onPress={() => removeHashtag(tag)}
                      hitSlop={8}
                      className="pl-0.5"
                    >
                      <Ionicons name="close-circle" size={18} color="#a78bfa" />
                    </TouchableOpacity>
                  </View>
                ))}
                <View className="flex-1 flex-row items-center gap-2 min-w-[120px]">
                  <TextInput
                    value={hashtagInput}
                    onChangeText={setHashtagInput}
                    placeholder="Add hashtag..."
                    placeholderTextColor="#71717a"
                    className="flex-1 py-1.5 text-sm text-zinc-100"
                    onSubmitEditing={() => {
                      if (hashtagInput.trim()) addHashtag(hashtagInput.trim());
                    }}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    onPress={() => addHashtag(hashtagInput.trim())}
                    className="rounded-full bg-violet-600 px-3 py-1.5"
                  >
                    <Text className="text-xs font-semibold text-white">Add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleAddLocation}
                className="mb-3 flex-row items-center justify-center gap-2 rounded-xl border border-zinc-600 py-2.5 active:opacity-80"
              >
                <Ionicons name="location-outline" size={20} color="#a78bfa" />
                <Text className="text-violet-400">
                  {location ? "Location added" : "Add location"}
                </Text>
              </TouchableOpacity>
              <SchedulePicker
                enabled={scheduleEnabled}
                onEnabledChange={setScheduleEnabled}
                value={scheduledAt}
                onChange={setScheduledAt}
                label="Schedule post"
              />
              <TouchableOpacity
                onPress={handleSubmit}
                className="rounded-xl bg-violet-600 py-3 active:opacity-90"
              >
                <Text className="text-center font-semibold text-white">
                  {scheduleEnabled ? "Schedule post" : "Create post"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

async function pickDocument(): Promise<string | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    return result.assets[0].uri;
  } catch {
    Alert.alert("Error", "Couldn't open the file. Please try again.");
    return null;
  }
}

function CreateProductModal({
  visible,
  type,
  typeLabel,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  type: ProductType;
  typeLabel: string;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    price: string;
    mediaUri?: string;
    coverUri?: string;
    mediaMimeType?: string;
    interval?: string;
    priceTiers?: PriceTier[];
    serviceSlots?: ServiceSlot[];
    eventDate?: number;
    eventTime?: string;
    categories?: string[];
    tags?: string[];
    goLiveAt?: number;
    revenueSplits?: { partnerUsername: string; splitPercent: number }[];
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [digitalFileMimeType, setDigitalFileMimeType] = useState<string | null>(null);
  const isVideoFile = digitalFileMimeType != null && digitalFileMimeType.startsWith("video/");
  const [interval, setInterval] = useState<"monthly" | "yearly" | "">("");
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  const [serviceSlots, setServiceSlots] = useState<ServiceSlot[]>([]);
  const [eventDateInput, setEventDateInput] = useState("");
  const [eventTimeInput, setEventTimeInput] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [customCategory, setCustomCategory] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const MAX_CATEGORIES = 3;
  const [tagInput, setTagInput] = useState("");
  const [revenueSplits, setRevenueSplits] = useState<{ partnerUsername: string; splitPercent: string }[]>([]);
  const [goLiveEnabled, setGoLiveEnabled] = useState(false);
  const [goLiveAt, setGoLiveAt] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  });

  const { profile, saveTagsToProfile } = useProfile();
  const savedTags = profile.categoryTags ?? [];

  const isDigital = type === "digital";
  const isPhysical = type === "physical";
  const isMembership = type === "membership";
  const isServices = type === "services";
  const isEvent = type === "event";
  const isNft = type === "nft";
  const isLive = type === "live";
  const showMediaUpload = isDigital || isPhysical || isNft || isLive;
  const useImageUpload = isPhysical || isNft || isLive;
  const useDocumentUpload = isDigital;

  const handleUploadDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setDigitalFileMimeType(asset.mimeType ?? null);
    } catch {
      Alert.alert("Error", "Couldn't open the file. Please try again.");
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

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a product title.");
      return;
    }
    if (isDigital && !coverImageUri) {
      Alert.alert("Cover art required", "Please add cover art for your digital product.");
      return;
    }
    if (isDigital && !mediaUri) {
      Alert.alert("File required", "Please upload the digital file for delivery.");
      return;
    }
    if (isNft && !mediaUri) return;
    let eventDate: number | undefined;
    if (isEvent && eventDateInput.trim()) {
      const ts = new Date(eventDateInput.trim()).getTime();
      if (!isNaN(ts)) eventDate = ts;
    }
    const splitResult = parseRevenueSplits(revenueSplits);
    if (!splitResult.valid) {
      Alert.alert("Invalid splits", "Total partner share cannot exceed 99%.");
      return;
    }
    const parsedSplits = splitResult.splits;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      price: price.trim(),
      mediaUri: mediaUri ?? undefined,
      interval: isMembership && interval ? interval : undefined,
      priceTiers: priceTiers.length > 0 ? priceTiers : undefined,
      serviceSlots: serviceSlots.length > 0 ? serviceSlots : undefined,
      eventDate,
      eventTime: isEvent && eventTimeInput.trim() ? eventTimeInput.trim() : undefined,
      categories: categories.length > 0 ? categories.filter((c) => c !== "Custom").slice(0, MAX_CATEGORIES) : undefined,
      tags: tags.length > 0 ? tags : undefined,
      coverUri: isDigital ? (coverImageUri ?? undefined) : undefined,
      mediaMimeType: isDigital ? (digitalFileMimeType ?? undefined) : undefined,
      goLiveAt: goLiveEnabled ? goLiveAt.getTime() : undefined,
      revenueSplits: parsedSplits.length > 0 ? parsedSplits : undefined,
    });
    setTitle("");
    setDescription("");
    setPrice("");
    setMediaUri(null);
    setCoverImageUri(null);
    setDigitalFileMimeType(null);
    setInterval("");
    setPriceTiers([]);
    setServiceSlots([]);
    setEventDateInput("");
    setEventTimeInput("");
    setCategories([]);
    setCustomCategory("");
    setTags([]);
    setTagInput("");
    setGoLiveEnabled(false);
    onClose();
  };

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
      prev.map((s, j) => {
        if (j !== i) return s;
        const nextValue = field === "splitPercent" ? value.replace(/\D/g, "").slice(0, 2) : value;
        return { ...s, [field]: nextValue };
      })
    );
  const removeRevenueSplit = (i: number) =>
    setRevenueSplits((prev) => prev.filter((_, j) => j !== i));
  const totalSplitPercent = revenueSplits.reduce((sum, s) => sum + (parseInt(s.splitPercent, 10) || 0), 0);

  function parseRevenueSplits(
    raw: { partnerUsername: string; splitPercent: string }[]
  ): { valid: true; splits: { partnerUsername: string; splitPercent: number }[] } | { valid: false } {
    const splits: { partnerUsername: string; splitPercent: number }[] = [];
    for (let idx = 0; idx < raw.length; idx++) {
      const s = raw[idx];
      const pct = parseInt(s.splitPercent, 10) || 0;
      const username = s.partnerUsername.trim();
      if (username && pct >= 1 && pct <= 99) {
        splits.push({ partnerUsername: username, splitPercent: pct });
      }
    }
    if (splits.length > 0) {
      const total = splits.reduce((sum, x) => sum + x.splitPercent, 0);
      if (total > 99) return { valid: false };
      return { valid: true, splits };
    }
    return { valid: true, splits: [] };
  }

  useEffect(() => {
    if (!visible) {
      setTitle("");
      setDescription("");
      setPrice("");
      setMediaUri(null);
      setInterval("");
      setPriceTiers([]);
      setServiceSlots([]);
      setEventDateInput("");
      setEventTimeInput("");
      setCategories([]);
      setCustomCategory("");
      setTags([]);
      setTagInput("");
      setRevenueSplits([]);
      setCoverImageUri(null);
      setDigitalFileMimeType(null);
      setGoLiveEnabled(false);
    }
  }, [visible]);

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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <Pressable className="flex-1 justify-center bg-black/60 px-4" onPress={onClose}>
          <Pressable
            className="max-h-[80%] rounded-2xl border border-zinc-700 bg-zinc-900 p-5"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-zinc-100">
                New {typeLabel}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                className="h-8 w-8 items-center justify-center rounded-full bg-zinc-700"
              >
                <Ionicons name="close" size={20} color="#a1a1aa" />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text className="mb-1 text-sm text-zinc-400">Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={
                  type === "services"
                    ? "e.g. 1:1 Consulting, Logo Design"
                    : type === "membership"
                      ? "e.g. Pro Member, VIP Access"
                      : "Product name"
                }
                placeholderTextColor="#71717a"
                className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
              />

              {isDigital && (
                <>
                  <Text className="mb-1 text-sm text-zinc-400">
                    {isVideoFile ? "Thumbnail (choose an image for the video preview)" : "Cover art (required)"}
                  </Text>
                  <View
                    className={`mb-4 rounded-xl border-2 border-dashed overflow-hidden ${
                      coverImageUri ? "border-amber-500 bg-amber-500/10" : "border-zinc-600 bg-zinc-800/50"
                    }`}
                  >
                    {coverImageUri ? (
                      <>
                        <View className="aspect-video w-full bg-zinc-800">
                          <Image
                            source={{ uri: coverImageUri }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="contain"
                          />
                        </View>
                        <View className="flex-row justify-center gap-3 border-t border-zinc-700/50 py-3 px-4">
                          <TouchableOpacity
                            onPress={() => setCoverImageUri(null)}
                            className="rounded-lg bg-zinc-700 px-3 py-1.5 active:opacity-80"
                          >
                            <Text className="text-sm text-zinc-300">Clear</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleUploadCoverImage}
                            className="rounded-lg bg-amber-600/80 px-3 py-1.5 active:opacity-80"
                          >
                            <Text className="text-sm text-white">Change photo</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={handleUploadCoverImage}
                        className="flex-row items-center justify-center gap-2 py-6"
                      >
                        <Ionicons name="image-outline" size={28} color="#71717a" />
                        <Text className="text-zinc-500">
                          {isVideoFile ? "Tap to choose thumbnail" : "Tap to upload cover art"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text className="mb-1 text-sm text-zinc-400">Digital file (instant delivery)</Text>
                  <View
                    className={`mb-4 rounded-xl border-2 border-dashed py-6 ${
                      mediaUri ? "border-amber-500 bg-amber-500/10" : "border-zinc-600 bg-zinc-800/50"
                    }`}
                  >
                    <TouchableOpacity
                      onPress={handleUploadDocument}
                      className="flex-row items-center justify-center gap-2"
                    >
                      <Ionicons
                        name={digitalFileMimeType?.startsWith("audio/") ? "musical-notes-outline" : "cloud-upload-outline"}
                        size={28}
                        color={mediaUri ? "#f59e0b" : "#71717a"}
                      />
                      <Text
                        className={
                          mediaUri ? "font-medium text-amber-400" : "text-zinc-500"
                        }
                      >
                        {mediaUri
                          ? digitalFileMimeType?.startsWith("audio/")
                            ? "Audio selected"
                            : "File selected"
                          : "Tap to upload file"}
                      </Text>
                    </TouchableOpacity>
                    {mediaUri && (
                      <View className="mt-3 flex-row justify-center gap-3 px-4">
                        <TouchableOpacity
                          onPress={() => { setMediaUri(null); setDigitalFileMimeType(null); }}
                          className="rounded-lg bg-zinc-700 px-3 py-1.5 active:opacity-80"
                        >
                          <Text className="text-sm text-zinc-300">Clear</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleUploadDocument}
                          className="rounded-lg bg-amber-600/80 px-3 py-1.5 active:opacity-80"
                        >
                          <Text className="text-sm text-white">Change file</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </>
              )}

              {(isPhysical || isLive || isNft) && (
                <>
                  <Text className="mb-1 text-sm text-zinc-400">
                    {isLive ? "Cover image (optional)" : isNft ? "NFT image / asset" : "Product photo (optional)"}
                  </Text>
                  <View
                    className={`mb-4 rounded-xl border-2 border-dashed overflow-hidden ${
                      mediaUri ? "border-amber-500 bg-amber-500/10" : "border-zinc-600 bg-zinc-800/50"
                    }`}
                  >
                    {mediaUri ? (
                      <>
                        <View className="aspect-video w-full bg-zinc-800">
                          <Image
                            source={{ uri: mediaUri }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="contain"
                          />
                        </View>
                        <View className="flex-row justify-center gap-3 border-t border-zinc-700/50 py-3 px-4">
                          <TouchableOpacity
                            onPress={() => setMediaUri(null)}
                            className="rounded-lg bg-zinc-700 px-3 py-1.5 active:opacity-80"
                          >
                            <Text className="text-sm text-zinc-300">Clear</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={handleUploadImage}
                            className="rounded-lg bg-amber-600/80 px-3 py-1.5 active:opacity-80"
                          >
                            <Text className="text-sm text-white">Change photo</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={handleUploadImage}
                        className="flex-row items-center justify-center gap-2 py-6"
                      >
                        <Ionicons name="image-outline" size={28} color="#71717a" />
                        <Text className="text-zinc-500">Tap to upload photo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              {isMembership && (
                <>
                  <Text className="mb-1 text-sm text-zinc-400">Billing interval</Text>
                  <View className="mb-4 flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => setInterval("monthly")}
                      className={`flex-1 rounded-xl border px-4 py-3 ${
                        interval === "monthly"
                          ? "border-amber-500 bg-amber-500/20"
                          : "border-zinc-700 bg-zinc-800"
                      }`}
                    >
                      <Text
                        className={`text-center font-medium ${
                          interval === "monthly" ? "text-amber-400" : "text-zinc-400"
                        }`}
                      >
                        Monthly
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setInterval("yearly")}
                      className={`flex-1 rounded-xl border px-4 py-3 ${
                        interval === "yearly"
                          ? "border-amber-500 bg-amber-500/20"
                          : "border-zinc-700 bg-zinc-800"
                      }`}
                    >
                      <Text
                        className={`text-center font-medium ${
                          interval === "yearly" ? "text-amber-400" : "text-zinc-400"
                        }`}
                      >
                        Yearly
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <Text className="mb-1 text-sm text-zinc-400">
                {type === "services" ? "What you offer (optional)" : "Description (optional)"}
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={
                  type === "services"
                    ? "Describe your service..."
                    : "Describe your product..."
                }
                placeholderTextColor="#71717a"
                multiline
                numberOfLines={3}
                className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
                style={{ minHeight: 80, textAlignVertical: "top" }}
              />

              <Text className="mb-1 text-sm text-zinc-400">Categories (optional, max {MAX_CATEGORIES})</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-2"
                contentContainerStyle={{ gap: 8 }}
              >
                {PRODUCT_CATEGORIES.map((cat) => {
                  const selected = categories.includes(cat);
                  const atMax = categories.length >= MAX_CATEGORIES && !selected;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => {
                        if (selected) {
                          setCategories((prev) => prev.filter((c) => c !== cat));
                        } else if (!atMax) {
                          setCategories((prev) => [...prev, cat].slice(0, MAX_CATEGORIES));
                        }
                      }}
                      className={`rounded-full border px-4 py-2 ${
                        selected ? "border-amber-500 bg-amber-500/20" : atMax ? "border-zinc-700 bg-zinc-800/50 opacity-60" : "border-zinc-600 bg-zinc-800"
                      }`}
                    >
                      <Text className={selected ? "text-amber-400 font-medium" : "text-zinc-400"}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {categories.includes("Custom") && (
                <View className="mb-3 flex-row items-center gap-2">
                  <TextInput
                    value={customCategory}
                    onChangeText={setCustomCategory}
                    placeholder="Enter category name"
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
              {categories.length > 0 && (
                <Text className="mb-3 text-xs text-zinc-500">
                  Selected: {categories.join(", ")}
                </Text>
              )}

              <Text className="mb-1 text-sm text-zinc-400">Tags (optional)</Text>
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
                  <View
                    key={tag}
                    className="flex-row items-center gap-1 rounded-full bg-amber-600/20 border border-amber-500/50 px-3 py-1.5"
                  >
                    <Text className="text-sm text-amber-300">{tag}</Text>
                    <TouchableOpacity
                      onPress={() => removeTag(tag)}
                      hitSlop={8}
                      className="pl-0.5"
                    >
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
                    onSubmitEditing={() => {
                      if (tagInput.trim()) addTag(tagInput.trim());
                    }}
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

              <Text className="mb-1 text-sm text-zinc-400">Price (optional)</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="e.g. $20, 0.5 ETH"
                placeholderTextColor="#71717a"
                className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
              />

              {isEvent && (
                <>
                  <Text className="mb-1 text-sm text-zinc-400">Event date</Text>
                  <TextInput
                    value={eventDateInput}
                    onChangeText={setEventDateInput}
                    placeholder="e.g. Dec 25, 2025"
                    placeholderTextColor="#71717a"
                    className="mb-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
                  />
                  <Text className="mb-1 text-sm text-zinc-400">Event time (optional)</Text>
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
                    <Text className="text-sm text-zinc-400">Time slots (calendar)</Text>
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
                  {serviceSlots.length === 0 && (
                    <Text className="text-xs text-zinc-500 mb-4">Add time slots for booking.</Text>
                  )}
                </>
              )}

              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm text-zinc-400">Tiered pricing (optional)</Text>
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

              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm text-zinc-400">Revenue share (optional)</Text>
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

              <SchedulePicker
                enabled={goLiveEnabled}
                onEnabledChange={setGoLiveEnabled}
                value={goLiveAt}
                onChange={setGoLiveAt}
                label="Schedule to go live"
              />
              <TouchableOpacity
                onPress={handleSubmit}
                className="rounded-xl bg-amber-600 py-3 active:opacity-90 mt-2"
              >
                <Text className="text-center font-semibold text-white">
                  {goLiveEnabled ? "Schedule product" : "Create product"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CreateEventModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; date: number }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(19, 0, 0, 0);
    return d;
  });

  useEffect(() => {
    if (!visible) {
      setTitle("");
      setDescription("");
      setDateInput("");
      setScheduleEnabled(false);
    }
  }, [visible]);

  const handleSubmit = () => {
    const t = title.trim();
    if (!t) return;
    const dateTs = scheduleEnabled
      ? scheduledAt.getTime()
      : (dateInput.trim() ? new Date(dateInput.trim()).getTime() : Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (isNaN(dateTs)) return;
    onSubmit({ title: t, description: description.trim(), date: dateTs });
    onClose();
  };

  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose}>
          <Pressable
            className="rounded-t-2xl border-t border-zinc-700 bg-zinc-900 p-5 pb-8"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-zinc-100">New event</Text>
              <TouchableOpacity onPress={onClose} className="p-2">
                <Ionicons name="close" size={24} color="#a1a1aa" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text className="text-sm text-zinc-400 mb-1">Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Event name"
                placeholderTextColor="#71717a"
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-zinc-100 text-base mb-4"
              />
              <Text className="text-sm text-zinc-400 mb-1">Description (optional)</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Details..."
                placeholderTextColor="#71717a"
                multiline
                numberOfLines={2}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-zinc-100 text-base mb-4"
              />
              <SchedulePicker
                enabled={scheduleEnabled}
                onEnabledChange={setScheduleEnabled}
                value={scheduledAt}
                onChange={setScheduledAt}
                label="Schedule event"
              />
              {!scheduleEnabled && (
                <>
                  <Text className="text-sm text-zinc-400 mb-1">Date (e.g. Dec 25, 2025 or leave empty for next week)</Text>
                  <TextInput
                    value={dateInput}
                    onChangeText={setDateInput}
                    placeholder="Optional"
                    placeholderTextColor="#71717a"
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-zinc-100 text-base mb-4"
                  />
                </>
              )}
              <TouchableOpacity onPress={handleSubmit} className="rounded-xl bg-cyan-600 py-3 items-center active:opacity-90">
                <Text className="text-base font-semibold text-white">
                  {scheduleEnabled ? "Schedule event" : "Create event"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const POST_TYPE_LABELS: Record<PostType, string> = {
  blog: "Blog",
  picture: "Picture",
  audio: "Audio",
  video: "Video",
  polls: "Polls",
};

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  digital: "Digital Product",
  physical: "Physical Product",
  membership: "Membership",
  services: "Service",
  nft: "NFT",
  live: "Live Shopping",
  event: "Ticketed Event",
};

export default function CreateScreen() {
  const navigation = useNavigation();
  const { addPost, addProduct, addProductFromServer, addEvent } = useContent();
  const { user } = useAuth();
  const router = useRouter();
  const [categoryModal, setCategoryModal] = useState<CategoryModalType>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Creator Studio", tabBarLabel: "Creator Studio" });
  }, [navigation]);
  const [createPostType, setCreatePostType] = useState<PostType | null>(null);
  const [createProductType, setCreateProductType] = useState<ProductType | null>(
    null
  );
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const gridPadding = 16;
  const gridGap = 12;
  const gridWidth = screenWidth - gridPadding * 2;
  const numColumns = 4;
  const cellWidth = (gridWidth - gridGap * (numColumns - 1)) / numColumns;

  const openCategoryModal = (type: CategoryModalType) => setCategoryModal(type);
  const closeCategoryModal = () => setCategoryModal(null);

  const handleSelectPost = (type: PostType) => setCreatePostType(type);
  const handleSelectProduct = (type: ProductType) => setCreateProductType(type);

  const handleSubmitEvent = async (data: { title: string; description: string; date: number }) => {
    if (user?.id && supabase) {
      await supabase.from("events").insert({
        user_id: user.id,
        title: data.title,
        description: data.description || null,
        date: data.date,
      });
    }
    addEvent({ title: data.title, description: data.description || undefined, date: data.date });
    setCategoryModal(null);
    Alert.alert("Event created", "View it on your profile.", [
      { text: "OK", onPress: () => router.replace("/(tabs)/profile") },
    ]);
  };

  const handleSubmitPost = async (data: {
    title?: string;
    body: string;
    mediaUri?: string;
    mediaMimeType?: string | null;
    thumbnailUri?: string;
    lat?: number;
    lng?: number;
    place_name?: string;
    hashtags?: string[];
    scheduledAt?: number;
    pollOptions?: string[];
  }) => {
    if (!createPostType) return;
    const title = data.title?.trim() || null;
    const body = data.body?.trim() || undefined;
    const pollOpts = data.pollOptions?.filter(Boolean) ?? undefined;
    let mediaUrl: string | null = null;
    const needsMediaUpload =
      data.mediaUri &&
      (createPostType === "picture" || createPostType === "video" || createPostType === "audio");
    if (user && needsMediaUpload && data.mediaUri) {
      try {
        mediaUrl = await uploadPostMedia(user.id, data.mediaUri, createPostType, data.mediaMimeType ?? undefined);
      } catch (uploadErr) {
        const message = uploadErr instanceof Error ? uploadErr.message : "Media upload failed.";
        Alert.alert("Upload failed", message);
        return;
      }
    } else if (data.mediaUri && data.mediaUri.startsWith("http")) {
      mediaUrl = data.mediaUri;
    } else if (data.mediaUri) {
      mediaUrl = data.mediaUri;
    }
    const finalMediaUri = mediaUrl ?? (data.mediaUri?.startsWith("http") ? data.mediaUri : null);
    let thumbnailUrl: string | null = null;
    if ((createPostType === "video" || createPostType === "audio") && data.thumbnailUri && user) {
      try {
        thumbnailUrl = await uploadPostMedia(user.id, data.thumbnailUri, "picture", undefined);
      } catch {
        // non-blocking; post still created without thumbnail
      }
    }
    addPost({
      type: createPostType,
      title: title ?? "",
      body,
      mediaUri: finalMediaUri ?? undefined,
      thumbnailUri: thumbnailUrl ?? undefined,
      pollOptions: pollOpts,
    });
    setCreatePostType(null);
    if (user && supabase) {
      const insertPayload: Record<string, unknown> = {
        user_id: user.id,
        type: createPostType,
        title: title ?? null,
        body: body ?? null,
        media_uri: finalMediaUri ?? null,
      };
      if (thumbnailUrl) insertPayload.thumbnail_uri = thumbnailUrl;
      if (data.lat != null) insertPayload.lat = data.lat;
      if (data.lng != null) insertPayload.lng = data.lng;
      if (data.place_name != null) insertPayload.place_name = data.place_name;
      if (data.scheduledAt != null) insertPayload.scheduled_at = new Date(data.scheduledAt).toISOString();
      if (pollOpts?.length) insertPayload.poll_options = pollOpts;
      const { data: inserted, error } = await supabase
        .from("posts")
        .insert(insertPayload)
        .select("id")
        .single();
      if (!error && inserted?.id) {
        const fromContent = getHashtagsFromPostContent(title ?? "", body ?? null);
        const fromInput = (data.hashtags ?? []).map((t) => t.toLowerCase().replace(/^#/, ""));
        const tagNames = [...new Set([...fromContent, ...fromInput])].filter(Boolean);
        await syncPostHashtags(supabase, inserted.id, tagNames);
      }
    }
    Alert.alert(
      "Post created",
      "View it on your profile.",
      [{ text: "OK", onPress: () => router.replace("/(tabs)/profile") }]
    );
  };

  const handleSubmitProduct = async (data: {
    title: string;
    description: string;
    price: string;
    mediaUri?: string;
    coverUri?: string;
    mediaMimeType?: string;
    interval?: string;
    priceTiers?: PriceTier[];
    serviceSlots?: ServiceSlot[];
    eventDate?: number;
    eventTime?: string;
    categories?: string[];
    tags?: string[];
    goLiveAt?: number;
    revenueSplits?: { partnerUsername: string; splitPercent: number }[];
  }) => {
    if (!createProductType) return;
    const payload = {
      type: createProductType,
      title: data.title,
      description: data.description || undefined,
      price: data.price || undefined,
      mediaUri: data.mediaUri,
      coverUri: data.coverUri,
      mediaMimeType: data.mediaMimeType,
      interval: data.interval,
      priceTiers: data.priceTiers,
      serviceSlots: data.serviceSlots,
      eventDate: data.eventDate,
      eventTime: data.eventTime,
      categories: data.categories?.slice(0, 3),
      tags: data.tags,
      creatorId: user?.id ?? undefined,
      goLiveAt: data.goLiveAt,
    };
    if (!user?.id || !supabase) {
      Alert.alert("Error", "You must be signed in to create a product.");
      return;
    }
    const row = productToRow({ ...payload, creatorId: user.id }, user.id);
    const { data: inserted, error } = await supabase
      .from("products")
      .insert(row)
      .select()
      .single();
    if (error) {
      Alert.alert(
        "Could not create product",
        error.message || "Something went wrong. Check that all fields are valid and try again."
      );
      return;
    }
    if (inserted) {
      const productId = (inserted as { id: string }).id;
      addProductFromServer(rowToProduct(inserted as Parameters<typeof rowToProduct>[0]));
      if (data.revenueSplits?.length && user?.id) {
        for (const s of data.revenueSplits) {
          const partnerId = await getProfileIdByUsername(s.partnerUsername);
          if (partnerId) {
            await createRevenueSplit({
              ownerId: user.id,
              partnerId,
              targetType: "product",
              targetId: productId,
              splitPercent: s.splitPercent,
            });
          }
        }
      }
    }
    setCreateProductType(null);
    Alert.alert(
      "Product created",
      "It's now on your profile and in the marketplace. Category and tags help others find it.",
      [{ text: "OK", onPress: () => router.replace("/(tabs)/marketplace") }]
    );
  };

  const sections = [
    { id: "post" as const, label: "POST", color: "bg-violet-600", icon: "document-text-outline" },
    { id: "product" as const, label: "PRODUCT", color: "bg-amber-600", icon: "pricetag-outline" },
    { id: "event" as const, label: "EVENT", color: "bg-cyan-600", icon: "calendar-outline" },
    { id: "insights" as const, label: "Insights", color: "bg-emerald-600", icon: "stats-chart-outline" },
    { id: "broadcast" as const, label: "Broadcast", color: "bg-red-600", icon: "radio-outline" },
    { id: "station" as const, label: "Station", color: "bg-indigo-600", icon: "apps-outline" },
    { id: "cinema" as const, label: "Cinema", color: "bg-rose-600", icon: "film-outline" },
    { id: "community" as const, label: "Community", color: "bg-teal-600", icon: "people-outline" },
  ];

  const handleSectionPress = (id: (typeof sections)[number]["id"]) => {
    if (id === "post" || id === "product" || id === "event") {
      openCategoryModal(id);
    } else if (id === "insights") {
      setInsightsExpanded(true);
    } else {
      Alert.alert(
        "Coming soon",
        `${id.charAt(0).toUpperCase() + id.slice(1)} creation will be available in a future update.`,
        [{ text: "OK" }]
      );
    }
  };

  return (
    <View className="flex-1 bg-zinc-950">
      <View className="border-b border-zinc-800 px-4 pb-3 pt-14">
        <Text className="text-2xl font-bold text-zinc-100">Creator Studio</Text>
        <Text className="text-sm text-zinc-500">
          Create posts, products, and events
        </Text>
      </View>
      <View className="flex-1" style={{ paddingHorizontal: gridPadding, paddingBottom: 24 }}>
        <View style={{ flex: 1, width: gridWidth, gap: gridGap }}>
          {[0, 1].map((rowIndex) => (
            <View key={rowIndex} style={{ flex: 1, flexDirection: "row", gap: gridGap }}>
              {sections.slice(rowIndex * numColumns, (rowIndex + 1) * numColumns).map((section) => (
                <Pressable
                  key={section.id}
                  onPress={() => handleSectionPress(section.id)}
                  style={{ width: cellWidth }}
                  className="flex-1 flex-row items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 active:opacity-90 min-h-0"
                >
                  <View
                    className={`h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${section.color}`}
                  >
                    <Ionicons
                      name={section.icon as keyof typeof Ionicons.glyphMap}
                      size={24}
                      color="#fff"
                    />
                  </View>
                  <Text className="flex-1 text-base font-semibold text-zinc-100" numberOfLines={1}>
                    {section.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#71717a" style={{ marginLeft: "auto" }} />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </View>

      <Modal visible={insightsExpanded} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 }}
          onPress={() => setInsightsExpanded(false)}
        >
          <Pressable
            style={{ flexDirection: "row", gap: 12 }}
            onPress={(e) => e.stopPropagation()}
          >
            <Pressable
              onPress={() => {
                setInsightsExpanded(false);
                router.push("/insights/engagement");
              }}
              style={{ flex: 1 }}
              className="flex-row items-center justify-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-800/90 p-6 active:opacity-90"
            >
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-violet-600">
                <Ionicons name="heart-outline" size={28} color="#fff" />
              </View>
              <Text className="text-lg font-semibold text-zinc-100">Engagement</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setInsightsExpanded(false);
                router.push("/insights/income");
              }}
              style={{ flex: 1 }}
              className="flex-row items-center justify-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-800/90 p-6 active:opacity-90"
            >
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-amber-600">
                <Ionicons name="cash-outline" size={28} color="#fff" />
              </View>
              <Text className="text-lg font-semibold text-zinc-100">Income</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <OptionsModal
        visible={categoryModal === "post"}
        title="Post"
        options={POST_OPTIONS}
        onClose={closeCategoryModal}
        onSelectPost={handleSelectPost}
      />
      <OptionsModal
        visible={categoryModal === "product"}
        title="Product"
        options={PRODUCT_OPTIONS}
        onClose={closeCategoryModal}
        onSelectProduct={handleSelectProduct}
      />
      <CreateEventModal
        visible={categoryModal === "event"}
        onClose={closeCategoryModal}
        onSubmit={handleSubmitEvent}
      />

      <CreatePostModal
        visible={createPostType !== null}
        type={createPostType ?? "blog"}
        typeLabel={createPostType ? POST_TYPE_LABELS[createPostType] : "Post"}
        onClose={() => setCreatePostType(null)}
        onSubmit={handleSubmitPost}
      />

      <CreateProductModal
        visible={createProductType !== null}
        type={createProductType ?? "digital"}
        typeLabel={
          createProductType ? PRODUCT_TYPE_LABELS[createProductType] : "Product"
        }
        onClose={() => setCreateProductType(null)}
        onSubmit={handleSubmitProduct}
      />
    </View>
  );
}
