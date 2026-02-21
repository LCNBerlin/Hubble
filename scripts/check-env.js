#!/usr/bin/env node
/**
 * Validates .env has required Supabase vars for Hubble.
 * Run from project root: node scripts/check-env.js
 */
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
let env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^EXPO_PUBLIC_SUPABASE_(URL|ANON_KEY)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    });
}

const url = env.URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const key = env.ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const urlOk = url.length > 0 && url.startsWith("https://") && url.includes("supabase.co");
const keyOk = key.length > 0;
const keyFormatOk = key.startsWith("eyJ"); // Supabase anon keys are JWTs

console.log("Hubble .env check\n");
console.log("EXPO_PUBLIC_SUPABASE_URL:", urlOk ? "set and looks valid" : url ? "set but check format (https://xxx.supabase.co)" : "MISSING");
console.log("EXPO_PUBLIC_SUPABASE_ANON_KEY:", !keyOk ? "MISSING" : keyFormatOk ? "set and looks like a JWT" : "set but Supabase anon keys usually start with eyJ — get from Dashboard > Settings > API > anon public");

if (!urlOk || !keyOk) {
  process.exit(1);
}
if (!keyFormatOk) {
  console.log("\nIf the app fails to connect, replace the anon key with the one from Supabase Dashboard > Project Settings > API.");
}
console.log("\nEnv check done.");
