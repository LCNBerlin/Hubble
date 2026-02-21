import { Redirect } from "expo-router";

/**
 * Cinema is now a section inside the TV tab.
 * This route exists for deep links; redirect to TV.
 */
export default function CinemaScreen() {
  return <Redirect href="/(tabs)/tv" />;
}
