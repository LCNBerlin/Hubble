import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function getDaysFromToday(count: number): Date[] {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function formatDateLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type SchedulePickerProps = {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  value: Date;
  onChange: (d: Date) => void;
  label?: string;
};

export function SchedulePicker({
  enabled,
  onEnabledChange,
  value,
  onChange,
  label = "Schedule",
}: SchedulePickerProps) {
  const [hourModal, setHourModal] = useState(false);
  const [minuteModal, setMinuteModal] = useState(false);

  const days = useMemo(() => getDaysFromToday(31), []);
  const selectedDateKey = useMemo(() => {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [value]);

  const hour = value.getHours();
  const minute = value.getMinutes();

  const setHour = (h: number) => {
    const next = new Date(value);
    next.setHours(h, next.getMinutes(), 0, 0);
    onChange(next);
    setHourModal(false);
  };

  const setMinute = (m: number) => {
    const next = new Date(value);
    next.setMinutes(m, 0, 0);
    onChange(next);
    setMinuteModal(false);
  };

  const setDate = (d: Date) => {
    const next = new Date(d);
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onChange(next);
  };

  const handleToggle = (v: boolean) => {
    onEnabledChange(v);
    if (v) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      onChange(tomorrow);
    }
  };

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3">
        <Text className="text-base text-zinc-200">{label}</Text>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: "#3f3f46", true: "#7c3aed" }}
          thumbColor="#e4e4e7"
        />
      </View>
      {enabled && (
        <View className="mt-3 rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
          <Text className="mb-2 text-sm font-medium text-zinc-400">Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4 -mx-1"
            contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
          >
            {days.map((d) => {
              const key = new Date(d).setHours(0, 0, 0, 0);
              const isSelected = key === selectedDateKey;
              return (
                <Pressable
                  key={key}
                  onPress={() => setDate(d)}
                  className={`rounded-lg border px-4 py-2.5 ${isSelected ? "border-violet-500 bg-violet-600/30" : "border-zinc-600 bg-zinc-800"}`}
                >
                  <Text className={`text-sm ${isSelected ? "font-semibold text-violet-200" : "text-zinc-400"}`}>
                    {formatDateLabel(d)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text className="mb-2 text-sm font-medium text-zinc-400">Time</Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setHourModal(true)}
              className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-3"
            >
              <Text className="text-zinc-300">
                {hour % 12 || 12}:{minute.toString().padStart(2, "0")} {hour >= 12 ? "PM" : "AM"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMinuteModal(true)}
              className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-3"
            >
              <Text className="text-zinc-300">{minute.toString().padStart(2, "0")} min</Text>
            </Pressable>
          </View>

          <Modal visible={hourModal} transparent animationType="fade">
            <Pressable className="flex-1 justify-center bg-black/60 p-4" onPress={() => setHourModal(false)}>
              <Pressable className="rounded-2xl bg-zinc-900 border border-zinc-700 p-4 max-h-[60%]" onPress={(e) => e.stopPropagation()}>
                <Text className="mb-2 text-sm font-medium text-zinc-400">Hour</Text>
                <ScrollView className="max-h-48">
                  {HOURS.map((h) => (
                    <Pressable
                      key={h}
                      onPress={() => setHour(h)}
                      className={`py-2.5 px-3 rounded-lg ${hour === h ? "bg-violet-600/30" : ""}`}
                    >
                      <Text className={hour === h ? "text-violet-200 font-medium" : "text-zinc-300"}>
                        {h % 12 || 12} {h >= 12 ? "PM" : "AM"}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>

          <Modal visible={minuteModal} transparent animationType="fade">
            <Pressable className="flex-1 justify-center bg-black/60 p-4" onPress={() => setMinuteModal(false)}>
              <Pressable className="rounded-2xl bg-zinc-900 border border-zinc-700 p-4" onPress={(e) => e.stopPropagation()}>
                <Text className="mb-2 text-sm font-medium text-zinc-400">Minute</Text>
                <View className="flex-row flex-wrap gap-2">
                  {MINUTES.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setMinute(m)}
                      className={`rounded-lg border px-4 py-2.5 ${minute === m ? "border-violet-500 bg-violet-600/30" : "border-zinc-600 bg-zinc-800"}`}
                    >
                      <Text className={minute === m ? "text-violet-200 font-medium" : "text-zinc-300"}>
                        {m.toString().padStart(2, "0")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      )}
    </View>
  );
}
