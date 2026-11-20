import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { ChadMessageKind, generateMessageByKind } from './messageGenerator';

const DAILY_SLOTS: { hour: number; minute: number; kind: ChadMessageKind; id: string }[] = [
  { hour: 7, minute: 0, kind: 'affirmation', id: 'chad-daily-0700' },
  { hour: 7, minute: 10, kind: 'accountability', id: 'chad-daily-0710' },
  { hour: 12, minute: 30, kind: 'sideQuest', id: 'chad-daily-1230' },
  { hour: 15, minute: 0, kind: 'affirmation', id: 'chad-daily-1500' },
  { hour: 21, minute: 0, kind: 'accountability', id: 'chad-daily-2100' },
];

export async function scheduleDailyChadMessages(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    return false;
  }

  const visionRaw = await AsyncStorage.getItem('vision');
  const antiRaw = await AsyncStorage.getItem('antiVision');

  const vision: string[] = visionRaw ? JSON.parse(visionRaw) : [];
  const antiVision: string[] = antiRaw ? JSON.parse(antiRaw) : [];

  if (vision.length === 0 && antiVision.length === 0) {
    return false;
  }

  for (const slot of DAILY_SLOTS) {
    try {
      await Notifications.cancelScheduledNotificationAsync(slot.id);
    } catch {
      // Nothing scheduled yet for this id.
    }

    const body = generateMessageByKind(slot.kind, vision, antiVision);

    await Notifications.scheduleNotificationAsync({
      identifier: slot.id,
      content: {
        title: 'Chad',
        body,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: slot.hour,
        minute: slot.minute,
      },
    });
  }

  return true;
}
