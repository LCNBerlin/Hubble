import AsyncStorage from "@react-native-async-storage/async-storage";
import supabase from "./supabase";

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
  } catch {
    // ignore
  }
}

export async function clearStoredReferralRef(): Promise<void> {
  try {
    await AsyncStorage.removeItem(REFERRAL_REF_KEY);
  } catch {
    // ignore
  }
}

/**
 * Resolve referral code (affiliate_code or username) to referrer profile id.
 */
export async function resolveReferralCodeToReferrerId(code: string): Promise<string | null> {
  if (!supabase || !code.trim()) return null;
  const c = code.trim().toLowerCase();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .or(`affiliate_code.eq.${c},username.eq.${c}`)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Record a referral click (opener may be anon; we record on behalf of referrer).
 * Call when a logged-in user opens the app with ?ref= and we have resolved referrer_id.
 */
export async function recordReferralClick(referrerId: string, referralCode: string): Promise<void> {
  if (!supabase) return;
  await supabase.from("referral_events").insert({
    referrer_id: referrerId,
    referral_code: referralCode,
    event_type: "click",
    referree_id: null,
  });
}

/**
 * Record a referral signup. Call after new user signs up with stored ref.
 */
export async function recordReferralSignup(
  referrerId: string,
  referreeId: string,
  referralCode: string
): Promise<void> {
  if (!supabase) return;
  await supabase.from("referral_events").insert({
    referrer_id: referrerId,
    referral_code: referralCode,
    event_type: "signup",
    referree_id: referreeId,
  });
}
