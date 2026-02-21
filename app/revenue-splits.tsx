import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import {
  createRevenueSplit,
  deleteRevenueSplit,
  getProfileIdByUsername,
  getRevenueSplitsForOwner,
  updateRevenueSplit,
  type RevenueSplitWithPartner,
} from "../lib/revenue-splits";
import supabase from "../lib/supabase";

type ProductRow = {
  id: string;
  creator_id: string;
  title: string;
  type: string;
  price: string | null;
};

function AddEditSplitModal({
  visible,
  productTitle,
  existingSplit,
  totalPercent,
  onClose,
  onSave,
}: {
  visible: boolean;
  productTitle: string;
  existingSplit: RevenueSplitWithPartner | null;
  totalPercent: number;
  onClose: () => void;
  onSave: (partnerUsername: string, splitPercent: number) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [percent, setPercent] = useState("");
  const [saving, setSaving] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const maxPercent = 99 - totalPercent + (existingSplit?.split_percent ?? 0);

  useEffect(() => {
    if (visible) {
      setUsername(existingSplit?.partner?.username ?? "");
      setPercent(existingSplit?.split_percent?.toString() ?? "");
      setLookupError(null);
    }
  }, [visible, existingSplit]);

  const handleSave = async () => {
    const p = parseInt(percent, 10);
    if (isNaN(p) || p < 1 || p > 99) {
      setLookupError("Enter a percent between 1 and 99.");
      return;
    }
    if (!existingSplit && p > maxPercent) {
      setLookupError(`Total splits cannot exceed 99%. Max for this partner: ${maxPercent}%.`);
      return;
    }
    if (!existingSplit) {
      const u = username.trim();
      if (!u) {
        setLookupError("Enter partner username.");
        return;
      }
      const partnerId = await getProfileIdByUsername(u);
      if (!partnerId) {
        setLookupError("User not found. Check the username.");
        return;
      }
    }
    setSaving(true);
    setLookupError(null);
    try {
      await onSave(username.trim(), p);
      onClose();
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        className="flex-1 bg-black/60 justify-center p-6"
        onPress={onClose}
      >
        <Pressable
          className="bg-zinc-900 rounded-2xl border border-zinc-700 p-5"
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-semibold text-zinc-100 mb-1">
            {existingSplit ? "Edit split" : "Add partner"}
          </Text>
          <Text className="text-sm text-zinc-400 mb-4">{productTitle}</Text>
          {!existingSplit && (
            <>
              <Text className="text-zinc-400 text-sm mb-1">Partner username</Text>
              <TextInput
                className="bg-zinc-800 border border-zinc-600 rounded-xl px-4 py-3 text-zinc-100 mb-3"
                placeholder="@username"
                placeholderTextColor="#71717a"
                value={username}
                onChangeText={(t) => {
                  setUsername(t);
                  setLookupError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!existingSplit}
              />
            </>
          )}
          {existingSplit && (
            <Text className="text-zinc-400 text-sm mb-1">
              Partner: @{existingSplit.partner?.username ?? existingSplit.partner_id}
            </Text>
          )}
          <Text className="text-zinc-400 text-sm mb-1">Share % (1–99)</Text>
          <TextInput
            className="bg-zinc-800 border border-zinc-600 rounded-xl px-4 py-3 text-zinc-100 mb-3"
            placeholder="e.g. 25"
            placeholderTextColor="#71717a"
            value={percent}
            onChangeText={(t) => {
              setPercent(t.replace(/\D/g, "").slice(0, 2));
              setLookupError(null);
            }}
            keyboardType="number-pad"
          />
          {lookupError && (
            <Text className="text-amber-400 text-sm mb-3">{lookupError}</Text>
          )}
          <View className="flex-row gap-3 justify-end">
            <TouchableOpacity
              onPress={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-700"
            >
              <Text className="text-zinc-200">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-emerald-600"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-medium">
                  {existingSplit ? "Update" : "Add"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function RevenueSplitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [splits, setSplits] = useState<RevenueSplitWithPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalProductId, setModalProductId] = useState<string | null>(null);
  const [editingSplit, setEditingSplit] = useState<RevenueSplitWithPartner | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [productsRes, splitsRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, creator_id, title, type, price")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false }),
      getRevenueSplitsForOwner(user.id, "product"),
    ]);
    if (productsRes.error) {
      setProducts([]);
    } else {
      setProducts((productsRes.data as ProductRow[]) ?? []);
    }
    setSplits(splitsRes);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const splitsByProduct = splits.reduce<Record<string, RevenueSplitWithPartner[]>>(
    (acc, s) => {
      if (!acc[s.target_id]) acc[s.target_id] = [];
      acc[s.target_id].push(s);
      return acc;
    },
    {}
  );

  const openAdd = (productId: string) => {
    setEditingSplit(null);
    setModalProductId(productId);
  };

  const openEdit = (productId: string, split: RevenueSplitWithPartner) => {
    setEditingSplit(split);
    setModalProductId(productId);
  };

  const totalPercentForProduct = (productId: string) => {
    const list = splitsByProduct[productId] ?? [];
    return list.reduce((sum, s) => sum + s.split_percent, 0);
  };

  const handleSaveSplit = useCallback(
    async (_partnerUsername: string, splitPercent: number) => {
      if (!user?.id || !modalProductId) return;
      if (editingSplit) {
        const res = await updateRevenueSplit(
          editingSplit.id,
          splitPercent,
          user.id
        );
        if (!res.ok) throw new Error(res.error);
      } else {
        const partnerId = await getProfileIdByUsername(_partnerUsername);
        if (!partnerId) throw new Error("User not found.");
        const res = await createRevenueSplit({
          ownerId: user.id,
          partnerId,
          targetType: "product",
          targetId: modalProductId,
          splitPercent,
        });
        if (!res.ok) throw new Error(res.error);
      }
      await load();
      setModalProductId(null);
      setEditingSplit(null);
    },
    [user?.id, modalProductId, editingSplit, load]
  );

  const handleDeleteSplit = useCallback(
    (split: RevenueSplitWithPartner) => {
      Alert.alert(
        "Remove partner",
        `Remove @${split.partner?.username ?? split.partner_id} from this product's revenue split?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              if (!user?.id) return;
              const res = await deleteRevenueSplit(split.id, user.id);
              if (res.ok) await load();
              else Alert.alert("Error", res.error);
            },
          },
        ]
      );
    },
    [user?.id, load]
  );

  const productTitle = modalProductId
    ? products.find((p) => p.id === modalProductId)?.title ?? ""
    : "";
  const totalPercent = modalProductId
    ? totalPercentForProduct(modalProductId)
    : 0;

  if (!user) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <Text className="text-zinc-400">Sign in to manage revenue splits.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center border-b border-zinc-800 px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#e4e4e7" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-zinc-100">Revenue splits</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          <Text className="text-sm text-zinc-400 mb-4">
            Share product revenue with partners. Add partners by username; their share is a percentage of each sale (1–99%). You keep the remainder.
          </Text>

          {loading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#a78bfa" />
            </View>
          ) : products.length === 0 ? (
            <View className="py-8 rounded-xl bg-zinc-900/80 border border-zinc-800 p-6">
              <Text className="text-zinc-400 text-center">
                You don't have any products yet. Create a product in Creator Studio first.
              </Text>
              <TouchableOpacity
                onPress={() => router.back()}
                className="mt-4 bg-violet-600 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-semibold">Back to Creator Studio</Text>
              </TouchableOpacity>
            </View>
          ) : (
            products.map((product) => {
              const productSplits = splitsByProduct[product.id] ?? [];
              const total = productSplits.reduce((s, x) => s + x.split_percent, 0);
              return (
                <View
                  key={product.id}
                  className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden"
                >
                  <View className="p-4 border-b border-zinc-800">
                    <Text className="text-zinc-100 font-semibold" numberOfLines={1}>
                      {product.title}
                    </Text>
                    <Text className="text-zinc-500 text-sm mt-0.5">
                      {product.type} {product.price != null ? ` · ${product.price}` : ""}
                    </Text>
                    {total > 0 && (
                      <Text className="text-zinc-400 text-xs mt-1">
                        Partner share: {total}% · You keep: {100 - total}%
                      </Text>
                    )}
                  </View>
                  <View className="p-2">
                    {productSplits.map((split) => (
                      <View
                        key={split.id}
                        className="flex-row items-center justify-between py-2 px-2 rounded-lg bg-zinc-800/50 mb-1"
                      >
                        <Text className="text-zinc-200 flex-1">
                          @{split.partner?.username ?? split.partner_id.slice(0, 8)}
                          {split.partner?.display_name
                            ? ` (${split.partner.display_name})`
                            : ""}
                        </Text>
                        <Text className="text-zinc-400 mr-2">{split.split_percent}%</Text>
                        <View className="flex-row gap-2">
                          <TouchableOpacity
                            onPress={() => openEdit(product.id, split)}
                            className="p-2"
                          >
                            <Ionicons name="pencil-outline" size={20} color="#a78bfa" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteSplit(split)}
                            className="p-2"
                          >
                            <Ionicons name="trash-outline" size={20} color="#f87171" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    {total < 99 && (
                      <TouchableOpacity
                        onPress={() => openAdd(product.id)}
                        className="flex-row items-center gap-2 py-3 px-2 rounded-lg mt-1"
                      >
                        <Ionicons name="add-circle-outline" size={22} color="#a78bfa" />
                        <Text className="text-violet-400 font-medium">Add partner</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <AddEditSplitModal
        visible={!!modalProductId}
        productTitle={productTitle}
        existingSplit={editingSplit}
        totalPercent={totalPercent}
        onClose={() => {
          setModalProductId(null);
          setEditingSplit(null);
        }}
        onSave={handleSaveSplit}
      />
    </View>
  );
}
