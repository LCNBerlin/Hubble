import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EscrowDashboard } from "../../components/wallet/EscrowDashboard";
import { CryptoVaultView } from "../../components/wallet/CryptoVaultView";
import { FiatVaultView } from "../../components/wallet/FiatVaultView";
import { OverviewStrip, type QuickActionKey } from "../../components/wallet/OverviewStrip";
import { PlaceholderSection } from "../../components/wallet/PlaceholderSection";
import { SecurityGate } from "../../components/wallet/SecurityGate";
import { SlideOverDetail } from "../../components/wallet/SlideOverDetail";
import { TransactionLedger } from "../../components/wallet/TransactionLedger";
import { VaultBreakdownCards, type VaultKey } from "../../components/wallet/VaultBreakdownCards";
import { WalletRightPanel } from "../../components/wallet/WalletRightPanel";
import { WalletSidebar, type WalletSection } from "../../components/wallet/WalletSidebar";
import { useAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import { useCreatorPayouts } from "../../hooks/useCreatorPayouts";
import { useOrdersForWallet } from "../../hooks/useOrdersForWallet";
import { useWalletLayout } from "../../lib/wallet-grid";
import supabase from "../../lib/supabase";
import type { OrderWithItems } from "../../hooks/useOrdersForWallet";

const MOBILE_TABS: { key: WalletSection; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "fiat", label: "Fiat" },
  { key: "crypto", label: "Crypto" },
  { key: "escrow", label: "Escrow" },
  { key: "transactions", label: "Activity" },
];

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const layout = useWalletLayout(width);
  const { user } = useAuth();
  const { profile } = useProfile();
  const { orders, loading, refresh } = useOrdersForWallet(user?.id);
  const { payouts, refresh: refreshPayouts } = useCreatorPayouts(user?.id);

  const [activeSection, setActiveSection] = useState<WalletSection>("overview");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [securityVisible, setSecurityVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stripeConnectAccountId, setStripeConnectAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !supabase) return;
    supabase
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setStripeConnectAccountId(data?.stripe_connect_account_id ?? null));
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshPayouts()]);
    if (user?.id && supabase) {
      const { data } = await supabase
        .from("profiles")
        .select("stripe_connect_account_id")
        .eq("id", user.id)
        .single();
      setStripeConnectAccountId(data?.stripe_connect_account_id ?? null);
    }
    setRefreshing(false);
  }, [refresh, refreshPayouts, user?.id]);

  const totals = useMemo(() => {
    const lockedCents = orders
      .filter((o) => o.status === "escrow_held")
      .reduce((s, o) => s + o.total_cents, 0);
    const earnedCents = payouts
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + p.amount_cents, 0);
    const pendingPayoutCents = payouts
      .filter((p) => p.status === "pending")
      .reduce((s, p) => s + p.amount_cents, 0);
    const totalCents = earnedCents + lockedCents;
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const payouts30d = payouts
      .filter((p) => new Date(p.created_at).getTime() >= thirtyDaysAgo && p.status === "paid")
      .reduce((s, p) => s + p.amount_cents, 0);
    const spent30d = orders
      .filter((o) => new Date(o.created_at).getTime() >= thirtyDaysAgo)
      .reduce((s, o) => s + o.total_cents, 0);
    const netChange30dCents = payouts30d - spent30d;
    return {
      totalCents,
      availableCents: earnedCents,
      lockedCents,
      pendingCents: pendingPayoutCents,
      netChange30dCents,
    };
  }, [orders, payouts]);

  const vaultBalances = useMemo(
    () => ({
      spending: totals.availableCents,
      savings: 0,
      tax: 0,
      escrow: totals.lockedCents,
      staking: 0,
    }),
    [totals]
  );

  const rightPanelData = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const monthlyRevenueCents = payouts
      .filter((p) => new Date(p.created_at).getTime() >= thirtyDaysAgo && p.status === "paid")
      .reduce((s, p) => s + p.amount_cents, 0);
    const escrowTotalCents = orders
      .filter((o) => o.status === "escrow_held")
      .reduce((s, o) => s + o.total_cents, 0);
    const escrowCount = orders.filter((o) => o.status === "escrow_held").length;
    const upcomingPayoutCents = payouts
      .filter((p) => p.status === "pending")
      .reduce((s, p) => s + p.amount_cents, 0);
    return {
      monthlyRevenueCents,
      escrowTotalCents,
      escrowCount,
      upcomingPayoutCents,
      hasStripeAccount: !!stripeConnectAccountId,
    };
  }, [payouts, orders, stripeConnectAccountId]);

  const handleQuickAction = useCallback(
    (key: QuickActionKey) => {
      if (key === "send") {
        Alert.alert("Send", "Send payments from Marketplace or tip creators from posts.");
      } else if (key === "request") {
        Alert.alert("Request", "Share your profile or product links for others to pay you.");
      } else if (key === "convert") {
        setActiveSection("crypto");
      } else if (key === "withdraw") {
        router.push("/orders");
      } else if (key === "escrow") {
        setActiveSection("escrow");
      }
    },
    [router]
  );

  const handleManageVault = useCallback((key: VaultKey) => {
    if (key === "escrow") setActiveSection("escrow");
    else if (key === "spending") setActiveSection("overview");
    else if (key === "savings" || key === "tax" || key === "staking") {
      Alert.alert("Manage", "Vault settings will be available in a future update.");
    }
  }, []);

  const handleSelectOrder = useCallback((order: OrderWithItems) => {
    setSelectedOrder(order);
    setDetailVisible(true);
  }, []);

  const renderMainContent = () => {
    if (activeSection === "overview") {
      return (
        <View className="flex-1">
          <OverviewStrip
            totalCents={totals.totalCents}
            availableCents={totals.availableCents}
            lockedCents={totals.lockedCents}
            pendingCents={totals.pendingCents}
            netChange30dCents={totals.netChange30dCents}
            onQuickAction={handleQuickAction}
          />
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 32 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />
            }
          >
            <VaultBreakdownCards
              vaultBalances={vaultBalances}
              totalCents={totals.totalCents || 1}
              onManageVault={handleManageVault}
            />
            <TransactionLedger orders={orders} onSelectOrder={handleSelectOrder} />
          </ScrollView>
        </View>
      );
    }
    if (activeSection === "fiat") {
      return (
        <FiatVaultView
          userId={user?.id}
          stripeConnectAccountId={stripeConnectAccountId}
          earnedCents={totals.availableCents}
          pendingPayoutCents={totals.pendingCents}
          onRefresh={onRefresh}
        />
      );
    }
    if (activeSection === "crypto") {
      return (
        <CryptoVaultView
          walletAddress={profile.walletAddress || null}
          ensName={profile.ensName || null}
        />
      );
    }
    if (activeSection === "escrow") return <EscrowDashboard userId={user?.id} />;
    if (activeSection === "transactions") {
      return (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />
          }
        >
          <TransactionLedger orders={orders} onSelectOrder={handleSelectOrder} />
        </ScrollView>
      );
    }
    if (
      activeSection === "analytics" ||
      activeSection === "cards" ||
      activeSection === "automation" ||
      activeSection === "tax" ||
      activeSection === "security"
    ) {
      return <PlaceholderSection section={activeSection} />;
    }
    return null;
  };

  if (!user) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center" style={{ paddingTop: insets.top }}>
        <Text className="text-zinc-500">Sign in to view wallet</Text>
      </View>
    );
  }

  if (layout.isTablet) {
    return (
      <View className="flex-1 flex-row bg-zinc-950" style={{ paddingTop: insets.top }}>
        <View style={{ flex: layout.sidebarFlex }} className="min-w-0">
          <View className="flex-row items-center justify-end border-b border-zinc-800 pr-2 pt-2">
            <Pressable onPress={() => setSecurityVisible(true)} className="p-2">
              <Ionicons name="shield-checkmark-outline" size={24} color="#71717a" />
            </Pressable>
          </View>
          <WalletSidebar activeSection={activeSection} onSelect={setActiveSection} />
        </View>
        <View style={{ flex: layout.mainFlex }} className="min-w-0">
          {renderMainContent()}
        </View>
        {layout.rightPanelWidth > 0 && (
          <View style={{ flex: layout.rightPanelFlex }} className="min-w-0 border-l border-zinc-800">
            <WalletRightPanel
              section={activeSection}
              monthlyRevenueCents={rightPanelData.monthlyRevenueCents}
              escrowTotalCents={rightPanelData.escrowTotalCents}
              escrowCount={rightPanelData.escrowCount}
              upcomingPayoutCents={rightPanelData.upcomingPayoutCents}
              hasStripeAccount={rightPanelData.hasStripeAccount}
            />
          </View>
        )}
        <SlideOverDetail
          order={selectedOrder}
          visible={detailVisible}
          onClose={() => {
            setDetailVisible(false);
            setSelectedOrder(null);
          }}
        />
        <SecurityGate visible={securityVisible} onClose={() => setSecurityVisible(false)} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
        <Text className="text-xl font-bold text-zinc-100">Wallet</Text>
        <Pressable onPress={() => setSecurityVisible(true)} className="p-2">
          <Ionicons name="shield-checkmark-outline" size={24} color="#71717a" />
        </Pressable>
      </View>
      <View className="flex-1">{renderMainContent()}</View>
      <View
        className="flex-row border-t border-zinc-800 bg-zinc-900/80"
        style={{ paddingBottom: insets.bottom + 8, paddingTop: 8 }}
      >
        {MOBILE_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveSection(tab.key)}
            className="flex-1 items-center py-2"
          >
            <Text
              className={`text-xs font-medium ${
                activeSection === tab.key ? "text-violet-400" : "text-zinc-500"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <SlideOverDetail
        order={selectedOrder}
        visible={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setSelectedOrder(null);
        }}
      />
      <SecurityGate visible={securityVisible} onClose={() => setSecurityVisible(false)} />
    </View>
  );
}
