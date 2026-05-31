import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGet, apiPost } from "./api";

const REFERRAL_REF_KEY = "hubble_referral_ref";

export function getReferralRefKey(): string {
  return REFERRAL_REF_KEY;
}

export async function getStoredReferralRef(): Promise<string | null> {
  try {
    const s = await AsyncStorage.getItem(REFERRAL_REF_KEY);
    return s?.trim() || null;
  } catch {
    return null;
  }
}

export async function setStoredReferralRef(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(REFERRAL_REF_KEY, code.trim());
  } catch {}
}

export async function clearStoredReferralRef(): Promise<void> {
  try {
    await AsyncStorage.removeItem(REFERRAL_REF_KEY);
  } catch {}
}

export async function resolveReferralCodeToReferrerId(code: string): Promise<string | null> {
  if (!code.trim()) return null;
  try {
    const data = await apiGet<{ id: string } | null>(`/profiles/search?q=${encodeURIComponent(code.trim())}&limit=1`);
    return (data as { id: string }[])?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function recordReferralClick(referrerId: string, referralCode: string): Promise<void> {
  apiPost("/referrals/click", { referrerId, referralCode }).catch(() => {});
}

export async function recordReferralSignup(referrerId: string, referreeId: string, referralCode: string): Promise<void> {
  apiPost("/referrals/signup", { referrerId, referreeId, referralCode }).catch(() => {});
}
