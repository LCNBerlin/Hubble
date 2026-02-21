import { createContext, ReactNode, useContext } from "react";

export type StripeContextValue = {
  initPaymentSheet: (params: { paymentIntentClientSecret: string; merchantDisplayName: string }) => Promise<void>;
  presentPaymentSheet: () => Promise<{ error: { message?: string } | null }>;
};

const stubValue: StripeContextValue = {
  initPaymentSheet: async () => {},
  presentPaymentSheet: async () => ({ error: null }),
};

const StripeContext = createContext<StripeContextValue>(stubValue);

export function StripeContextProvider({ children, value }: { children: ReactNode; value: StripeContextValue }) {
  return <StripeContext.Provider value={value}>{children}</StripeContext.Provider>;
}

export function useStripeContext(): StripeContextValue {
  return useContext(StripeContext);
}

export { stubValue as defaultStripeContext };
