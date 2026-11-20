import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { ChadMessageKind, generateMessageByKind } from './messageGenerator';

const DAILY_SLOTS: { hour: number; minute: number; kind: ChadMessageKind }[] = [
  { hour: 7, minute: 0, kind: 'affirmation' },
  { hour: 7, minute: 10, kind: 'accountability' },
  { hour: 12, minute: 30, kind: 'sideQuest' },
  { hour: 15, minute: 0, kind: 'affirmation' },
  { hour: 21, minute: 0, kind: 'accountability' },
];

/**
 * Schedules five repeating local Chad notifications for Expo Go.
 * Returns the number scheduled, or 0 on failure. Never throws.
 */
export async function scheduleDailyChadMessages(): Promise<number> {
  try {
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

    await Notifications.cancelAllScheduledNotificationsAsync();

    let scheduled = 0;
    for (const slot of DAILY_SLOTS) {
      const body = generateMessageByKind(slot.kind, vision, antiVision);

      // Expo SDK 58 requires `type`. `{ hour, minute, repeats: true }` alone is rejected.
      // DAILY triggers already repeat every day; `repeats: true` is kept for clarity.
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Chad',
          body,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: slot.hour,
          minute: slot.minute,
          repeats: true,
        } as Notifications.NotificationTriggerInput,
      });
      scheduled += 1;
    }

    return scheduled;
  } catch {
    return 0;
  }
}
