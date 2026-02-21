import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, Pressable, Text, View } from "react-native";
import supabase from "../../lib/supabase";

type StoryRow = {
  id: string;
  media_uri: string;
  type: string;
  created_at: string;
};

const AUTO_ADVANCE_MS = 5000;

export default function StoryViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [profile, setProfile] = useState<{ display_name: string | null; username: string } | null>(null);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width, height } = Dimensions.get("window");

  useEffect(() => {
    if (!userId || !supabase) return;
    (async () => {
      const { data: storyData } = await supabase
        .from("stories")
        .select("id, media_uri, type, created_at")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", userId)
        .maybeSingle();
      setStories((storyData ?? []) as StoryRow[]);
      setProfile(profileData as { display_name: string | null; username: string } | null);
    })();
  }, [userId]);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i >= stories.length - 1) {
        router.back();
        return i;
      }
      return i + 1;
    });
  }, [stories.length, router]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(advance, AUTO_ADVANCE_MS);
  }, [advance]);

  useEffect(() => {
    if (stories.length === 0) return;
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [stories.length, index, resetTimer]);

  if (stories.length === 0) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#fff" }}>No stories</Text>
          <Pressable onPress={() => router.back()} className="mt-4 rounded-lg bg-violet-600 px-4 py-2">
            <Text style={{ color: "#fff" }}>Close</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const story = stories[index];
  const storyVideoPlayer = useVideoPlayer(
    story?.type === "video" && story?.media_uri ? story.media_uri : null,
    (p) => {
      p.loop = false;
      p.play();
    }
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <View style={{ position: "absolute", top: 56, left: 16, right: 16, zIndex: 10 }}>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {stories.map((_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  backgroundColor: "rgba(255,255,255,0.3)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: i <= index ? "100%" : "0%",
                    height: "100%",
                    backgroundColor: "#fff",
                  }}
                />
              </View>
            ))}
          </View>
        </View>
        <Pressable
          style={{ position: "absolute", top: 48, left: 12, zIndex: 10 }}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <View style={{ position: "absolute", top: 52, left: 48, zIndex: 10 }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
            {profile?.display_name ?? profile?.username ?? "Story"}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>@{profile?.username ?? ""}</Text>
        </View>
        <Pressable style={{ flex: 1 }} onPress={advance}>
          <View style={{ width, height: height - 0 }}>
            {story.type === "video" ? (
              <VideoView
                player={storyVideoPlayer}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                nativeControls={false}
              />
            ) : (
              <Image
                source={{ uri: story.media_uri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            )}
          </View>
        </Pressable>
      </View>
    </>
  );
}
