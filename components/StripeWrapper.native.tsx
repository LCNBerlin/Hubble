import Constants from "expo-constants";
import type { ReactNode } from "react";
import { StripeContextProvider, defaultStripeContext } from "../context/StripeContext";
import { STRIPE_PUBLISHABLE_KEY } from "../lib/config";

const isExpoGo = Constants.appOwnership === "expo";

export function StripeWrapper({ children }: { children: ReactNode }) {
  if (isExpoGo) {
    return <StripeContextProvider value={defaultStripeContext}>{children}</StripeContextProvider>;
  }
  try {
    const { StripeProvider, useStripe } = require("@stripe/stripe-react-native");
    function Inner({ innerChildren }: { innerChildren: ReactNode }) {
      const stripe = useStripe();
      return (
        <StripeContextProvider
          value={{
            initPaymentSheet: stripe.initPaymentSheet.bind(stripe),
            presentPaymentSheet: stripe.presentPaymentSheet.bind(stripe),
          }}
        >
          {innerChildren}
        </StripeContextProvider>
      );
    }
    return (
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <Inner innerChildren={children} />
      </StripeProvider>
    );
  } catch {
    return <StripeContextProvider value={defaultStripeContext}>{children}</StripeContextProvider>;
  }
}
