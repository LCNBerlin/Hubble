import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { PostType } from "../../context/ContentContext";
import { useAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import { getHashtagsFromPostContent, syncPostHashtags } from "../../lib/hashtags";
import { uploadPostMedia } from "../../lib/postUpload";
import {
  getCurrentPositionAsync,
  Accuracy as LocationAccuracy,
  requestForegroundPermissionsAsync,
} from "../../lib/location";
import supabase from "../../lib/supabase";

async function pickImage(): Promise<{ uri: string; mimeType?: string | null } | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Photo access", "Photo library access was denied.", [
      { text: "Cancel", style: "cancel" },
      { text: "Open Settings", onPress: () => Linking.openSettings() },
    ]);
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
}

async function pickAudio(): Promise<{ uri: string; mimeType?: string | null } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? null };
}

async function pickVideo(): Promise<{ uri: string; mimeType?: string | null } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "video/*", copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? null };
}

type PostRow = {
  id: string;
  user_id: string;
  type: string;
  title: string | null;
  body: string | null;
  media_uri: string | null;
  lat?: number | null;
  lng?: number | null;
  place_name?: string | null;
};

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<PostRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; place_name?: string } | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");

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

  const fetchPost = useCallback(async () => {
    if (!supabase || !id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("id, user_id, type, title, body, media_uri, lat, lng, place_name")
      .eq("id", id)
      .single();
    if (error || !data) {
      setLoading(false);
      setPost(null);
      return;
    }
    const row = data as PostRow;
    if (user && row.user_id !== user.id) {
      setLoading(false);
      setPost(null);
      return;
    }
    setPost(row);
    setTitle(row.title ?? "");
    setBody(row.body ?? "");
    setMediaUri(row.media_uri ?? null);
    setMediaMimeType(null);
    setLocation(
      row.lat != null && row.lng != null
        ? { lat: row.lat, lng: row.lng, place_name: row.place_name ?? undefined }
        : null
    );
    const { data: phData } = await supabase
      .from("post_hashtags")
      .select("hashtags(name)")
      .eq("post_id", id);
    const tagNames = (phData ?? [])
      .map((r: { hashtags: { name: string } | null }) => r.hashtags?.name)
      .filter(Boolean) as string[];
    setHashtags(tagNames.map((t) => t.toLowerCase()));
    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const needsUpload = post && (post.type === "picture" || post.type === "audio" || post.type === "video");

  const handleUpload = async () => {
    if (!post) return;
    if (post.type === "picture") {
      const result = await pickImage();
      if (result) {
        setMediaUri(result.uri);
        setMediaMimeType(result.mimeType ?? null);
      }
    } else if (post.type === "audio") {
      const result = await pickAudio();
      if (result) {
        setMediaUri(result.uri);
        setMediaMimeType(result.mimeType ?? null);
      }
    } else if (post.type === "video") {
      const result = await pickVideo();
      if (result) {
        setMediaUri(result.uri);
        setMediaMimeType(result.mimeType ?? null);
      }
    }
  };

  const handleAddLocation = async () => {
    try {
      const perm = await requestForegroundPermissionsAsync();
      if (!perm || perm.status !== "granted") {
        Alert.alert("Location", "Location permission was denied. You can enable it in Settings.", [{ text: "OK" }]);
        return;
      }
      const loc = await getCurrentPositionAsync({ accuracy: LocationAccuracy.Balanced });
      if (!loc) {
        Alert.alert("Location", "Could not get your location. Please try again.");
        return;
      }
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude, place_name: "Current location" });
    } catch {
      Alert.alert("Location", "Could not get your location. Please try again.");
    }
  };

  const handleSave = async () => {
    if (!post || !user || !supabase) return;
    const finalTitle = title.trim() || null;
    if (needsUpload && !mediaUri) return;
    setSaving(true);
    let finalMediaUri: string | null = mediaUri;
    const isLocalFile = mediaUri?.startsWith("file://") || mediaUri?.startsWith("content://");
    if (isLocalFile && mediaUri && (post.type === "picture" || post.type === "audio" || post.type === "video")) {
      try {
        finalMediaUri = await uploadPostMedia(user.id, mediaUri, post.type as "picture" | "audio" | "video", mediaMimeType ?? undefined);
      } catch (err) {
        setSaving(false);
        Alert.alert("Upload failed", err instanceof Error ? err.message : "Could not upload media.");
        return;
      }
    }
    const updatePayload: Record<string, unknown> = {
      title: finalTitle ?? null,
      body: body.trim() || null,
      media_uri: finalMediaUri ?? null,
    };
    if (location) {
      updatePayload.lat = location.lat;
      updatePayload.lng = location.lng;
      updatePayload.place_name = location.place_name ?? null;
    } else {
      updatePayload.lat = null;
      updatePayload.lng = null;
      updatePayload.place_name = null;
    }
    const { error } = await supabase
      .from("posts")
      .update(updatePayload)
      .eq("id", post.id)
      .eq("user_id", user.id);
    if (error) {
      setSaving(false);
      Alert.alert("Error", "Could not update post.");
      return;
    }
    const fromContent = getHashtagsFromPostContent(finalTitle ?? "", body.trim() || null);
    const fromInput = hashtags.map((t) => t.toLowerCase().replace(/^#/, ""));
    const tagNames = [...new Set([...fromContent, ...fromInput])].filter(Boolean);
    await syncPostHashtags(supabase, post.id, tagNames);
    setSaving(false);
    router.back();
  };

  const handleDelete = () => {
    if (!post || !user || !supabase) return;
    Alert.alert("Delete post?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("posts").delete().eq("id", post.id).eq("user_id", user.id);
          if (!error) router.replace("/(tabs)/profile");
          else Alert.alert("Error", "Could not delete post.");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Edit post" }} />
        <View className="flex-1 bg-zinc-950 items-center justify-center">
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      </>
    );
  }

  if (!post) {
    return (
      <>
        <Stack.Screen options={{ title: "Edit post" }} />
        <View className="flex-1 bg-zinc-950 items-center justify-center px-4">
          <Text className="text-zinc-400 text-center">Post not found or you can’t edit it.</Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-4 rounded-xl bg-zinc-700 px-4 py-2">
            <Text className="text-zinc-100">Go back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  const typeLabel = { blog: "Blog", picture: "Picture", audio: "Audio", video: "Video", polls: "Polls" }[post.type] ?? post.type;

  return (
    <>
      <Stack.Screen options={{ title: `Edit ${typeLabel}` }} />
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
          {(post.type === "blog" || post.type === "audio" || post.type === "polls") && (
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
          {(post.type === "picture" || post.type === "audio" || post.type === "video") && (
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
                {post.type === "picture" ? "Image" : post.type === "audio" ? "Audio" : "Video"}
              </Text>
              <View
                className={`mb-4 rounded-xl border-2 border-dashed py-6 ${
                  mediaUri ? "border-violet-500 bg-violet-500/10" : "border-zinc-600 bg-zinc-800/50"
                }`}
              >
                <TouchableOpacity onPress={handleUpload} className="flex-row items-center justify-center gap-2">
                  <Ionicons
                    name={
                      post.type === "picture" ? "image-outline" : post.type === "audio" ? "musical-notes-outline" : "videocam-outline"
                    }
                    size={28}
                    color={mediaUri ? "#a78bfa" : "#71717a"}
                  />
                  <Text className={mediaUri ? "font-medium text-violet-400" : "text-zinc-500"}>
                    {mediaUri ? "File selected" : "Tap to change"}
                  </Text>
                </TouchableOpacity>
                {mediaUri && (
                  <View className="mt-3 flex-row justify-center gap-3 px-4">
                    <TouchableOpacity onPress={() => setMediaUri(null)} className="rounded-lg bg-zinc-700 px-3 py-1.5">
                      <Text className="text-sm text-zinc-300">Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
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
          <View className="mb-4 flex-row flex-wrap gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 px-3 py-2">
            {hashtags.map((tag) => (
              <View
                key={tag}
                className="flex-row items-center gap-1 rounded-full border border-violet-500/50 bg-violet-600/30 px-3 py-1.5"
              >
                <Text className="text-sm text-violet-300">#{tag}</Text>
                <TouchableOpacity onPress={() => removeHashtag(tag)} hitSlop={8} className="pl-0.5">
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
            onPress={() => (location ? setLocation(null) : handleAddLocation())}
            className="mb-4 flex-row items-center justify-center gap-2 rounded-xl border border-zinc-600 py-2.5"
          >
            <Ionicons name="location-outline" size={20} color="#a78bfa" />
            <Text className="text-violet-400">{location ? "Location added (tap to clear)" : "Add location"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            className="rounded-xl bg-violet-600 py-3 active:opacity-90 disabled:opacity-50"
          >
            <Text className="text-center font-semibold text-white">{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            className="mt-4 rounded-xl border border-red-500/50 py-3 active:opacity-90"
          >
            <Text className="text-center font-medium text-red-400">Delete post</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
