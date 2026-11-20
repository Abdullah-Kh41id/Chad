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

const SOON_TEST_SLOTS: { seconds: number; kind: ChadMessageKind }[] = [
  { seconds: 15, kind: 'affirmation' },
  { seconds: 45, kind: 'accountability' },
  { seconds: 90, kind: 'sideQuest' },
];

export type ScheduleResult = {
  scheduled: number;
  confirmed: number;
  exampleMessage: string;
};

async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

async function loadVisionLists(): Promise<{ vision: string[]; antiVision: string[] } | null> {
  const visionRaw = await AsyncStorage.getItem('vision');
  const antiRaw = await AsyncStorage.getItem('antiVision');

  const vision: string[] = visionRaw ? JSON.parse(visionRaw) : [];
  const antiVision: string[] = antiRaw ? JSON.parse(antiRaw) : [];

  if (vision.length === 0 && antiVision.length === 0) {
    return null;
  }

  return { vision, antiVision };
}

/**
 * Same reliable flow as the short-delay test:
 * request permission → cancel all → scheduleNotificationAsync → verify with getAll.
 */
export async function scheduleDailyChadMessages(): Promise<ScheduleResult> {
  try {
    const allowed = await requestNotificationPermission();
    if (!allowed) {
      return { scheduled: 0, confirmed: 0, exampleMessage: '' };
    }

    const lists = await loadVisionLists();
    if (!lists) {
      return { scheduled: 0, confirmed: 0, exampleMessage: '' };
    }

    const { vision, antiVision } = lists;
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
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: slot.hour,
          minute: slot.minute,
          repeats: true,
        } as Notifications.NotificationTriggerInput,
      });
    }

    const all = await Notifications.getAllScheduledNotificationsAsync();
    console.log('[Chad] scheduled daily notifications:', JSON.stringify(all, null, 2));

    await saveChadMessages(bodies);
    return {
      scheduled: bodies.length,
      confirmed: all.length,
      exampleMessage: bodies[0] ?? '',
    };
  } catch (error) {
    console.log('[Chad] scheduleDailyChadMessages error:', error);
    return { scheduled: 0, confirmed: 0, exampleMessage: '' };
  }
}

/**
 * Debug helper: schedule three near-term notifications with real generated Chad copy.
 */
export async function scheduleSoonTestNotifications(): Promise<ScheduleResult> {
  try {
    const allowed = await requestNotificationPermission();
    if (!allowed) {
      return { scheduled: 0, confirmed: 0, exampleMessage: '' };
    }

    const lists = await loadVisionLists();
    if (!lists) {
      return { scheduled: 0, confirmed: 0, exampleMessage: '' };
    }

    const { vision, antiVision } = lists;
    await Notifications.cancelAllScheduledNotificationsAsync();

    const bodies: string[] = [];
    for (const slot of SOON_TEST_SLOTS) {
      const body = generateMessageByKind(slot.kind, vision, antiVision);
      bodies.push(body);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Chad',
          body,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: slot.seconds,
          repeats: false,
        },
      });
    }

    await saveChadMessages(bodies);

    const all = await Notifications.getAllScheduledNotificationsAsync();
    console.log('[Chad] soon test scheduled notifications:', JSON.stringify(all, null, 2));

    return {
      scheduled: bodies.length,
      confirmed: all.length,
      exampleMessage: bodies[0] ?? '',
    };
  } catch (error) {
    console.log('[Chad] scheduleSoonTestNotifications error:', error);
    return { scheduled: 0, confirmed: 0, exampleMessage: '' };
  }
}
