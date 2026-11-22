import * as Notifications from 'expo-notifications';
import { saveChadMessages } from './chadMessages';
import { ChadMessageKind, generateMessageByKind } from './messageGenerator';
import { loadMissionBoard } from './missions';
import { loadChadProfile } from './profile';

const NEXT_24H_SLOTS: { seconds: number; kind: ChadMessageKind }[] = [
  { seconds: 2 * 60, kind: 'affirmation' },
  { seconds: 30 * 60, kind: 'accountability' },
  { seconds: 2 * 60 * 60, kind: 'sideQuest' },
  { seconds: 6 * 60 * 60, kind: 'affirmation' },
  { seconds: 12 * 60 * 60, kind: 'accountability' },
  { seconds: 20 * 60 * 60, kind: 'sideQuest' },
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

async function loadVisionLists(): Promise<{
  vision: string[];
  antiVision: string[];
  visionStory: string;
  antiVisionStory: string;
} | null> {
  const profile = await loadChadProfile();
  const vision = profile.vision;
  const antiVision = profile.antiVision;
  const visionStory = profile.visionStory.trim();
  const antiVisionStory = profile.antiStory.trim();

  if (vision.length === 0 && antiVision.length === 0 && !visionStory && !antiVisionStory) {
    return null;
  }

  return { vision, antiVision, visionStory, antiVisionStory };
}

async function scheduleOffsetMessages(
  slots: { seconds: number; kind: ChadMessageKind }[],
): Promise<ScheduleResult> {
  const allowed = await requestNotificationPermission();
  if (!allowed) {
    return { scheduled: 0, confirmed: 0, exampleMessage: '' };
  }

  const lists = await loadVisionLists();
  if (!lists) {
    return { scheduled: 0, confirmed: 0, exampleMessage: '' };
  }

  const board = await loadMissionBoard();
  const dailyMissions = board.daily.filter((m) => !m.completed).map((m) => m.text);
  const quarterlyMissions = board.quarterly.filter((m) => !m.completed).map((m) => m.text);

  const { vision, antiVision, visionStory, antiVisionStory } = lists;
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = Date.now();
  const bodies: string[] = [];
  const fireTimes: number[] = [];
  for (const slot of slots) {
    const body = generateMessageByKind(slot.kind, vision, antiVision, {
      dailyMissions,
      quarterlyMissions,
      visionStory,
      antiVisionStory,
    });
    bodies.push(body);
    fireTimes.push(now + slot.seconds * 1000);

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

  await saveChadMessages(bodies, fireTimes);

  const all = await Notifications.getAllScheduledNotificationsAsync();
  console.log('[Chad] scheduled offset notifications:', JSON.stringify(all, null, 2));

  return {
    scheduled: bodies.length,
    confirmed: all.length,
    exampleMessage: bodies[0] ?? '',
  };
}

/**
 * Schedule 6 one-off Chad notifications across the next 24 hours.
 * Uses the same TIME_INTERVAL trigger style that works in Expo Go.
 */
export async function scheduleNext24Hours(): Promise<ScheduleResult> {
  try {
    return await scheduleOffsetMessages(NEXT_24H_SLOTS);
  } catch (error) {
    console.log('[Chad] scheduleNext24Hours error:', error);
    return { scheduled: 0, confirmed: 0, exampleMessage: '' };
  }
}

/** @deprecated Use scheduleNext24Hours */
export async function scheduleDailyChadMessages(): Promise<ScheduleResult> {
  return scheduleNext24Hours();
}

/**
 * Debug helper: schedule three near-term notifications with real generated Chad copy.
 */
export async function scheduleSoonTestNotifications(): Promise<ScheduleResult> {
  try {
    return await scheduleOffsetMessages(SOON_TEST_SLOTS);
  } catch (error) {
    console.log('[Chad] scheduleSoonTestNotifications error:', error);
    return { scheduled: 0, confirmed: 0, exampleMessage: '' };
  }
}
