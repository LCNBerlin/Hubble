import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ALGORITHM_MORE_KEY = "hubble_algorithm_more";
const ALGORITHM_LESS_KEY = "hubble_algorithm_less";
const ALGORITHM_POST_TYPES_KEY = "hubble_algorithm_post_types";

export const DEFAULT_POST_TYPES = ["blog", "picture", "video", "audio"] as const;
const POST_TYPE_OPTIONS: { id: (typeof DEFAULT_POST_TYPES)[number]; label: string; icon: string }[] = [
  { id: "blog", label: "Blogs", icon: "document-text-outline" },
  { id: "picture", label: "Photos", icon: "image-outline" },
  { id: "video", label: "Videos", icon: "videocam-outline" },
  { id: "audio", label: "Audio", icon: "musical-notes-outline" },
];

const DEFAULT_AI_SUMMARY =
  "Lately you've been into humor from internet culture, behind-the-scenes music stories and trying new restaurants.";

function TopicChip({
  label,
  onRemove,
  showPencil,
}: {
  label: string;
  onRemove: () => void;
  showPencil?: boolean;
}) {
  return (
    <View className="flex-row items-center rounded-full bg-zinc-800 border border-zinc-600 pl-2 pr-1.5 py-1.5 mr-2 mb-2">
      {showPencil ? (
        <Pressable onPress={onRemove} className="mr-1.5 p-0.5">
          <Ionicons name="pencil" size={12} color="#71717a" />
        </Pressable>
      ) : null}
      <Text className="text-sm text-zinc-200 mr-1" numberOfLines={1}>
        {label}
      </Text>
      <Pressable onPress={onRemove} className="p-1" hitSlop={8}>
        <Ionicons name="close-circle" size={18} color="#71717a" />
      </Pressable>
    </View>
  );
}

export default function AlgorithmScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [seeMore, setSeeMore] = useState<string[]>([]);
  const [seeLess, setSeeLess] = useState<string[]>([]);
  const [enabledPostTypes, setEnabledPostTypes] = useState<string[]>([...DEFAULT_POST_TYPES]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForSection, setAddForSection] = useState<"more" | "less">("more");
  const [addInput, setAddInput] = useState("");

  const loadPreferences = useCallback(async () => {
    try {
      const [moreRaw, lessRaw, typesRaw] = await Promise.all([
        AsyncStorage.getItem(ALGORITHM_MORE_KEY),
        AsyncStorage.getItem(ALGORITHM_LESS_KEY),
        AsyncStorage.getItem(ALGORITHM_POST_TYPES_KEY),
      ]);
      if (moreRaw) {
        const parsed = JSON.parse(moreRaw);
        if (Array.isArray(parsed)) setSeeMore(parsed.filter((x): x is string => typeof x === "string"));
      }
      if (lessRaw) {
        const parsed = JSON.parse(lessRaw);
        if (Array.isArray(parsed)) setSeeLess(parsed.filter((x): x is string => typeof x === "string"));
      }
      if (typesRaw) {
        const parsed = JSON.parse(typesRaw);
        if (Array.isArray(parsed)) setEnabledPostTypes(parsed.filter((x): x is string => typeof x === "string" && DEFAULT_POST_TYPES.includes(x as (typeof DEFAULT_POST_TYPES)[number])));
        else setEnabledPostTypes([...DEFAULT_POST_TYPES]);
      } else {
        setEnabledPostTypes([...DEFAULT_POST_TYPES]);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const saveMore = useCallback((list: string[]) => {
    setSeeMore(list);
    AsyncStorage.setItem(ALGORITHM_MORE_KEY, JSON.stringify(list)).catch(() => {});
  }, []);

  const saveLess = useCallback((list: string[]) => {
    setSeeLess(list);
    AsyncStorage.setItem(ALGORITHM_LESS_KEY, JSON.stringify(list)).catch(() => {});
  }, []);

  const removeMore = useCallback(
    (topic: string) => saveMore(seeMore.filter((t) => t !== topic)),
    [seeMore, saveMore]
  );

  const removeLess = useCallback(
    (topic: string) => saveLess(seeLess.filter((t) => t !== topic)),
    [seeLess, saveLess]
  );

  const togglePostType = useCallback((typeId: (typeof DEFAULT_POST_TYPES)[number]) => {
    setEnabledPostTypes((prev) => {
      const next = prev.includes(typeId) ? prev.filter((t) => t !== typeId) : [...prev, typeId];
      AsyncStorage.setItem(ALGORITHM_POST_TYPES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const openAdd = (section: "more" | "less") => {
    setAddForSection(section);
    setAddInput("");
    setAddModalVisible(true);
  };

  const submitAdd = useCallback(() => {
    const trimmed = addInput.trim();
    if (!trimmed) return;
    if (addForSection === "more") {
      if (seeMore.includes(trimmed)) return;
      saveMore([...seeMore, trimmed]);
    } else {
      if (seeLess.includes(trimmed)) return;
      saveLess([...seeLess, trimmed]);
    }
    setAddModalVisible(false);
    setAddInput("");
  }, [addForSection, addInput, seeMore, seeLess, saveMore, saveLess]);

  const handleShare = useCallback(() => {
    Share.share({
      message: "Check out my feed preferences on Hubble",
      title: "My algorithm",
    }).catch(() => {});
  }, []);

  return (
    <View className="flex-1 bg-zinc-950">
      <View
        className="flex-row items-center border-b border-zinc-800 px-2 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons name="arrow-back" size={24} color="#e4e4e7" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-zinc-100 flex-1">Your algorithm</Text>
        <TouchableOpacity onPress={() => {}} className="p-2">
          <Ionicons name="ellipsis-horizontal" size={22} color="#71717a" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} className="p-2">
          <Ionicons name="paper-plane-outline" size={20} color="#71717a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-base font-semibold text-zinc-100 mb-2">Post types to show</Text>
        <Text className="text-sm text-zinc-500 mb-3">Choose which types of posts appear in your feed. All are shown by default.</Text>
        <View className="flex-row flex-wrap gap-2 mb-8">
          {POST_TYPE_OPTIONS.map(({ id, label, icon }) => {
            const enabled = enabledPostTypes.includes(id);
            return (
              <Pressable
                key={id}
                onPress={() => togglePostType(id)}
                className={`flex-row items-center rounded-xl border px-4 py-3 ${enabled ? "border-violet-500 bg-violet-600/20" : "border-zinc-700 bg-zinc-800/80"}`}
              >
                <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={enabled ? "#a78bfa" : "#71717a"} />
                <Text className={`ml-2 text-sm font-medium ${enabled ? "text-violet-300" : "text-zinc-500"}`}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="text-base text-zinc-200 leading-6 mb-6">{DEFAULT_AI_SUMMARY}</Text>

        <Text className="text-base font-semibold text-zinc-100 mb-1">What you want to see more of</Text>
        <Pressable onPress={() => {}} className="flex-row items-center mb-3">
          <Text className="text-sm text-zinc-500">Based on your activity, summarized by AI</Text>
          <Ionicons name="chevron-forward" size={16} color="#71717a" />
        </Pressable>
        <View className="flex-row flex-wrap mb-2">
          {seeMore.map((topic) => (
            <TopicChip key={topic} label={topic} onRemove={() => removeMore(topic)} showPencil />
          ))}
        </View>
        <TouchableOpacity
          onPress={() => openAdd("more")}
          className="flex-row items-center rounded-lg border border-dashed border-zinc-600 py-2.5 px-3 mb-8"
        >
          <Ionicons name="add" size={20} color="#a78bfa" />
          <Text className="text-sm font-medium ml-2" style={{ color: "#a78bfa" }}>
            Add +
          </Text>
        </TouchableOpacity>

        <Text className="text-base font-semibold text-zinc-100 mb-3">What you want to see less of</Text>
        <View className="flex-row flex-wrap mb-2">
          {seeLess.map((topic) => (
            <TopicChip key={topic} label={topic} onRemove={() => removeLess(topic)} />
          ))}
        </View>
        <TouchableOpacity
          onPress={() => openAdd("less")}
          className="flex-row items-center rounded-lg border border-dashed border-zinc-600 py-2.5 px-3"
        >
          <Ionicons name="add" size={20} color="#a78bfa" />
          <Text className="text-sm font-medium ml-2" style={{ color: "#a78bfa" }}>
            Add +
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={addModalVisible} transparent animationType="fade">
        <Pressable className="flex-1 bg-black/60 justify-center px-6" onPress={() => setAddModalVisible(false)}>
          <Pressable
            className="bg-zinc-900 rounded-xl border border-zinc-700 p-4"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-base font-semibold text-zinc-100 mb-2">
              {addForSection === "more" ? "Add topic to see more of" : "Add topic to see less of"}
            </Text>
            <TextInput
              value={addInput}
              onChangeText={setAddInput}
              placeholder="Topic name"
              placeholderTextColor="#71717a"
              className="bg-zinc-800 rounded-lg px-3 py-2.5 text-zinc-100 text-base mb-4"
              autoCapitalize="none"
              onSubmitEditing={submitAdd}
            />
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setAddModalVisible(false)}
                className="flex-1 py-2.5 rounded-lg bg-zinc-700 items-center"
              >
                <Text className="text-zinc-200 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitAdd}
                disabled={!addInput.trim()}
                className="flex-1 py-2.5 rounded-lg bg-violet-600 items-center disabled:opacity-50"
              >
                <Text className="text-white font-medium">Add</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
