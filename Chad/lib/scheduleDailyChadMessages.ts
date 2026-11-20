import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { saveChadMessages } from './chadMessages';
import { ChadMessageKind, generateMessageByKind } from './messageGenerator';

const DAILY_SLOTS: { hour: number; minute: number; kind: ChadMessageKind }[] = [
  { hour: 7, minute: 0, kind: 'affirmation' },
  { hour: 7, minute: 10, kind: 'accountability' },
  { hour: 12, minute: 30, kind: 'sideQuest' },
  { hour: 15, minute: 0, kind: 'affirmation' },
  { hour: 21, minute: 0, kind: 'accountability' },
];

export type ScheduleResult = {
  scheduled: number;
  confirmed: number;
};

async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

/**
 * Schedules five repeating local Chad notifications.
 * Uses the same permission + cancel-all + scheduleNotificationAsync flow as the debug test.
 */
export async function scheduleDailyChadMessages(): Promise<ScheduleResult> {
  try {
    const allowed = await requestNotificationPermission();
    if (!allowed) {
      return { scheduled: 0, confirmed: 0 };
    }

    const visionRaw = await AsyncStorage.getItem('vision');
    const antiRaw = await AsyncStorage.getItem('antiVision');

    const vision: string[] = visionRaw ? JSON.parse(visionRaw) : [];
    const antiVision: string[] = antiRaw ? JSON.parse(antiRaw) : [];

    if (vision.length === 0 && antiVision.length === 0) {
      return { scheduled: 0, confirmed: 0 };
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    const bodies: string[] = [];
    for (const slot of DAILY_SLOTS) {
      const body = generateMessageByKind(slot.kind, vision, antiVision);
      bodies.push(body);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Chad',
          body,
          sound: 'default',
        },
        // Daily repeating trigger (hour/minute). SDK 58 requires an explicit type.
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: slot.hour,
          minute: slot.minute,
        },
      });
    }

    const all = await Notifications.getAllScheduledNotificationsAsync();
    console.log('[Chad] scheduled daily notifications:', JSON.stringify(all, null, 2));

    await saveChadMessages(bodies);
    return { scheduled: bodies.length, confirmed: all.length };
  } catch (error) {
    console.log('[Chad] scheduleDailyChadMessages error:', error);
    return { scheduled: 0, confirmed: 0 };
  }
}

/**
 * Debug helper: schedule three near-term notifications to verify delivery in Expo Go.
 */
export async function scheduleSoonTestNotifications(): Promise<number> {
  try {
    const allowed = await requestNotificationPermission();
    if (!allowed) {
      return 0;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    const tests = [
      { seconds: 15, body: 'Test message 1 from Chad' },
      { seconds: 45, body: 'Test message 2 from Chad' },
      { seconds: 90, body: 'Test message 3 from Chad' },
    ];

    for (const test of tests) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Chad',
          body: test.body,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: test.seconds,
          repeats: false,
        },
      });
    }

    await saveChadMessages(tests.map((test) => test.body));

    const all = await Notifications.getAllScheduledNotificationsAsync();
    console.log('[Chad] soon test scheduled notifications:', JSON.stringify(all, null, 2));

    return tests.length;
  } catch (error) {
    console.log('[Chad] scheduleSoonTestNotifications error:', error);
    return 0;
  }
}
