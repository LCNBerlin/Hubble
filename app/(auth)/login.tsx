import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";

export default function LoginScreen() {
  const { signIn, isSupabaseConfigured } = useAuth();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    setLoading(true);
    const { error: err } = await signIn(trimmedEmail, password);
    setLoading(false);
    if (err) {
      setError(err.message || "Sign in failed");
      return;
    }
    router.replace("/(tabs)/feed");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-zinc-950"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 80, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-2xl font-bold text-zinc-100">Sign in</Text>
        <Text className="mt-1 text-sm text-zinc-500">Welcome back to Hubble</Text>

        {!isSupabaseConfigured ? (
          <View className="mt-4 rounded-xl border border-amber-800/80 bg-amber-950/50 p-4">
            <Text className="text-sm font-medium text-amber-200">Supabase is not configured yet</Text>
            <Text className="mt-1 text-xs text-amber-200/80">
              Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to a .env file in the project root (see .env.example), then restart the app with: npx expo start --clear
            </Text>
          </View>
        ) : null}

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-zinc-100"
          editable={!loading}
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#71717a"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError(null);
          }}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextInput
          ref={passwordRef}
          autoCapitalize="none"
          autoComplete="password"
          className="mt-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base text-zinc-100"
          editable={!loading}
          placeholder="Password"
          placeholderTextColor="#71717a"
          secureTextEntry
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
          onSubmitEditing={handleSubmit}
        />

        {error ? (
          <Text className="mt-3 text-sm text-red-400">{error}</Text>
        ) : null}

        <Pressable
          className="mt-6 items-center justify-center rounded-xl bg-violet-600 py-3 active:opacity-90 disabled:opacity-60"
          disabled={loading}
          onPress={handleSubmit}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Sign in</Text>
          )}
        </Pressable>

        <View className="mt-8 flex-row items-center justify-center gap-1">
          <Text className="text-sm text-zinc-500">Don't have an account?</Text>
          <Pressable
            disabled={loading}
            onPress={() => router.replace("/(auth)/signup")}
            hitSlop={8}
          >
            <Text className="text-sm font-medium text-violet-400">Sign up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
