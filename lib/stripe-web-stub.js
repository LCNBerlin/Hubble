// Stub for @stripe/stripe-react-native on web — native module not available
const React = require("react");

const StripeProvider = ({ children }) => children;

const useStripe = () => ({
  initPaymentSheet: async () => ({ error: { message: "Stripe not available on web" } }),
  presentPaymentSheet: async () => ({ error: { message: "Stripe not available on web" } }),
});

module.exports = { StripeProvider, useStripe };
