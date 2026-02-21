import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
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
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { CREATOR_AVATAR } from "../lib/constants";
import {
  getCurrentPositionAsync,
  requestForegroundPermissionsAsync,
  Accuracy as LocationAccuracy,
} from "../lib/location";
import {
  pickBannerImage,
  pickProfileImage,
  uploadProfileImage,
} from "../lib/profileUpload";
import supabase from "../lib/supabase";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, refetchProfile } = useProfile();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [bannerUri, setBannerUri] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);

  useEffect(() => {
    setDisplayName(profile.displayName ?? "");
    setUsername(profile.username ?? "");
    setBio(profile.bio ?? "");
    setLocation(profile.location ?? "");
    setLat(profile.lat ?? null);
    setLng(profile.lng ?? null);
    setAvatarUri(profile.avatarUri ?? null);
    setBannerUri(profile.bannerUri ?? null);
  }, [profile.displayName, profile.username, profile.bio, profile.location, profile.lat, profile.lng, profile.avatarUri, profile.bannerUri]);

  const handleSave = useCallback(async () => {
    if (!user?.id || !supabase) return;
    const trimmedDisplay = displayName.trim();
    const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_|_$/g, "") || "user";
    const trimmedBio = bio.trim();
    const trimmedLocation = location.trim();

    if (!trimmedUsername) {
      Alert.alert("Invalid username", "Username is required.");
      return;
    }

    // Avoid saving while avatar/banner uploads are in-flight to prevent partial state.
    if (avatarUploading || bannerUploading) {
      Alert.alert("Please wait", "Profile photo or banner is still uploading. Try saving again in a moment.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: trimmedDisplay || null,
        username: trimmedUsername,
        bio: trimmedBio || null,
        location: trimmedLocation || null,
        lat: lat ?? null,
        lng: lng ?? null,
        avatar_url: avatarUri || null,
        banner_url: bannerUri || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        Alert.alert("Username taken", "That username is already in use. Try another.");
      } else {
        Alert.alert("Error", error.message || "Could not save profile.");
      }
      return;
    }
    await refetchProfile();
    router.back();
  }, [user?.id, displayName, username, bio, location, lat, lng, avatarUri, bannerUri, avatarUploading, bannerUploading, refetchProfile, router]);

  const handleChangeAvatar = useCallback(async () => {
    if (!user?.id || !supabase) return;
    const picked = await pickProfileImage();
    if (!picked) return;
    setAvatarUploading(true);
    try {
      const url = await uploadProfileImage(user.id, "avatar", picked.base64, picked.mimeType);
      // Optimistically update local state so the edit screen preview updates immediately.
      setAvatarUri(url);
      // Persist avatar change immediately so it shows on the profile even if the user forgets to tap Save.
      const { error } = await supabase
        .from("profiles")
        .update({
          avatar_url: url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) {
        Alert.alert("Profile photo", error.message || "Saved locally, but could not update your profile. Try saving again.");
      } else {
        await refetchProfile();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not upload profile picture.";
      Alert.alert("Upload failed", message);
    } finally {
      setAvatarUploading(false);
    }
  }, [user?.id, supabase, refetchProfile]);

  const handleChangeBanner = useCallback(async () => {
    if (!user?.id) return;
    const picked = await pickBannerImage();
    if (!picked) return;
    setBannerUploading(true);
    try {
      const url = await uploadProfileImage(user.id, "banner", picked.base64, picked.mimeType);
      setBannerUri(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not upload banner.";
      Alert.alert("Upload failed", message);
    } finally {
      setBannerUploading(false);
    }
  }, [user?.id]);

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: "Edit profile" }} />
        <View className="flex-1 bg-zinc-950 items-center justify-center">
          <Text className="text-zinc-400">Sign in to edit your profile.</Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-4 rounded-xl bg-zinc-700 px-4 py-2">
            <Text className="text-zinc-100">Go back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Edit profile",
          headerStyle: { backgroundColor: "#18181b" },
          headerTintColor: "#e4e4e7",
          headerTitleStyle: { fontWeight: "600", fontSize: 17 },
          headerRight: () =>
            saving || avatarUploading || bannerUploading ? (
              <View className="pr-2">
                <ActivityIndicator size="small" color="#a78bfa" />
              </View>
            ) : (
              <TouchableOpacity onPress={handleSave} className="pr-2 py-2" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text className="text-base font-semibold text-violet-400">Save</Text>
              </TouchableOpacity>
            ),
        }}
      />
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
          {/* Banner */}
          <View className="rounded-xl overflow-hidden bg-zinc-800 h-28 mb-4">
            {bannerUri ? (
              <Image source={{ uri: bannerUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : null}
            <TouchableOpacity
              onPress={handleChangeBanner}
              disabled={bannerUploading}
              className="absolute inset-0 items-center justify-center bg-black/40"
            >
              {bannerUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-sm font-medium text-white">Change banner</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View className="items-center -mt-14 mb-6">
            <View className="h-24 w-24 rounded-full overflow-hidden border-2 border-zinc-800 bg-zinc-700">
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <Image source={CREATOR_AVATAR} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              )}
            </View>
            <TouchableOpacity
              onPress={handleChangeAvatar}
              disabled={avatarUploading}
              className="mt-2 rounded-lg bg-zinc-700 px-4 py-2"
            >
              {avatarUploading ? (
                <ActivityIndicator size="small" color="#a78bfa" />
              ) : (
                <Text className="text-sm font-medium text-violet-400">Change photo</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text className="mb-1 text-sm text-zinc-400">Display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor="#71717a"
            className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
          />

          <Text className="mb-1 text-sm text-zinc-400">Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            placeholderTextColor="#71717a"
            autoCapitalize="none"
            autoCorrect={false}
            className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
          />

          <Text className="mb-1 text-sm text-zinc-400">Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about yourself"
            placeholderTextColor="#71717a"
            multiline
            numberOfLines={3}
            className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
            style={{ minHeight: 80, textAlignVertical: "top" }}
          />

          <Text className="mb-1 text-sm text-zinc-400">Location</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="City, country"
            placeholderTextColor="#71717a"
            className="mb-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-zinc-100"
          />
          <TouchableOpacity
            onPress={async () => {
              const perm = await requestForegroundPermissionsAsync();
              if (perm?.status !== "granted") {
                Alert.alert("Location", "Location permission is needed to show services near you in the marketplace.");
                return;
              }
              const pos = await getCurrentPositionAsync({ accuracy: LocationAccuracy.Balanced });
              if (pos) {
                setLat(pos.coords.latitude);
                setLng(pos.coords.longitude);
                if (!location.trim()) setLocation("Current location");
              } else {
                Alert.alert("Location", "Could not get your location. Try again.");
              }
            }}
            className="mb-4 flex-row items-center gap-2 rounded-xl border border-zinc-600 bg-zinc-800/50 px-4 py-3"
          >
            <Ionicons name="location-outline" size={20} color="#a78bfa" />
            <Text className="text-base text-violet-400">Use my location (for Services near you)</Text>
          </TouchableOpacity>
          {(lat != null || lng != null) && (
            <Text className="mb-4 text-xs text-zinc-500">
              Coordinates set. Clear the location field and save to remove.
            </Text>
          )}

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || avatarUploading || bannerUploading}
            className="mt-2 rounded-xl bg-violet-600 py-3.5 items-center disabled:opacity-60"
          >
            <Text className="text-base font-semibold text-white">
              {saving || avatarUploading || bannerUploading ? "Saving…" : "Save profile"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
