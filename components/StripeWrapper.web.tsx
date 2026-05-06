import type { ReactNode } from "react";
import { StripeContextProvider, defaultStripeContext } from "../context/StripeContext";

/** Stripe React Native is native-only; web uses placeholder context (no native payments sheet). */
export function StripeWrapper({ children }: { children: ReactNode }) {
  return <StripeContextProvider value={defaultStripeContext}>{children}</StripeContextProvider>;
}
