import { Redirect } from "expo-router";

export default function WishlistRedirect() {
  return <Redirect href="/(tabs)/marketplace?view=wishlist" />;
}
