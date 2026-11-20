import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { ChadMessageKind, generateMessageByKind } from './messageGenerator';

const CHAD_CHANNEL_ID = 'chad-messages';
const CHAD_ID_PREFIX = 'chad-daily-';

const DAILY_SLOTS: { hour: number; minute: number; kind: ChadMessageKind; id: string }[] = [
  { hour: 7, minute: 0, kind: 'affirmation', id: 'chad-daily-0700' },
  { hour: 7, minute: 10, kind: 'accountability', id: 'chad-daily-0710' },
  { hour: 12, minute: 30, kind: 'sideQuest', id: 'chad-daily-1230' },
  { hour: 15, minute: 0, kind: 'affirmation', id: 'chad-daily-1500' },
  { hour: 21, minute: 0, kind: 'accountability', id: 'chad-daily-2100' },
];

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHAD_CHANNEL_ID, {
    name: 'Chad messages',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
}

async function cancelPreviousChadNotifications() {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((n) => n.identifier.startsWith(CHAD_ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  // Also clear known slot ids in case getAll missed any.
  await Promise.all(
    DAILY_SLOTS.map(async (slot) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(slot.id);
      } catch {
        // Not scheduled yet.
      }
    }),
  );
}

function dailyTrigger(hour: number, minute: number): Notifications.DailyTriggerInput {
  // Daily triggers repeat every day at hour:minute.
  // SDK 58 requires an explicit `type`; `{ hour, minute, repeats: true }` alone is rejected.
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
    ...(Platform.OS === 'android' ? { channelId: CHAD_CHANNEL_ID } : null),
  };
}

/**
 * Schedules five repeating local Chad notifications.
 * Returns the number scheduled, or 0 if permissions/lists are missing.
 */
export async function scheduleDailyChadMessages(): Promise<number> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    return 0;
  }

  const visionRaw = await AsyncStorage.getItem('vision');
  const antiRaw = await AsyncStorage.getItem('antiVision');

  const vision: string[] = visionRaw ? JSON.parse(visionRaw) : [];
  const antiVision: string[] = antiRaw ? JSON.parse(antiRaw) : [];

  if (vision.length === 0 && antiVision.length === 0) {
    return 0;
  }

  await ensureAndroidChannel();
  await cancelPreviousChadNotifications();

  let scheduled = 0;
  for (const slot of DAILY_SLOTS) {
    const body = generateMessageByKind(slot.kind, vision, antiVision);

    await Notifications.scheduleNotificationAsync({
      identifier: slot.id,
      content: {
        title: 'Chad',
        body,
        sound: 'default',
      },
      trigger: dailyTrigger(slot.hour, slot.minute),
    });
    scheduled += 1;
  }

  const confirmed = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) =>
    n.identifier.startsWith(CHAD_ID_PREFIX),
  );

  return confirmed.length > 0 ? confirmed.length : scheduled;
}
