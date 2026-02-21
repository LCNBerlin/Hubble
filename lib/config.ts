/**
 * App config from environment. For Expo, use EXPO_PUBLIC_* in .env.
 * On device, set EXPO_PUBLIC_API_URL to your machine IP (e.g. http://192.168.1.10:4242).
 */
export const API_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) || "http://localhost:4242";

export const STRIPE_PUBLISHABLE_KEY =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) || "";

export const PAYMENTS_ENABLED = !!STRIPE_PUBLISHABLE_KEY;

export const SUPABASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_SUPABASE_URL) || "";

export const SUPABASE_ANON_KEY =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) || "";

/** Base URL for affiliate/referral links (e.g. https://yourapp.com). Set EXPO_PUBLIC_AFFILIATE_BASE_URL in .env. */
export const AFFILIATE_BASE_URL =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_AFFILIATE_BASE_URL) || "https://hubble.app";
