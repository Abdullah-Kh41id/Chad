import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDateKey, localDateKey } from './dates';
import { applyActivity, applyAppOpen, emptyStreak, StreakData } from './streakRules';

const STREAK_KEY = 'chadStreak';

function parseStreak(raw: string | null): StreakData {
  if (!raw) return emptyStreak();
  try {
    const parsed = JSON.parse(raw) as Partial<StreakData> | null;
    if (!parsed || typeof parsed !== 'object') return emptyStreak();
    const count = Number(parsed.count);
    const lastActiveDate =
      typeof parsed.lastActiveDate === 'string' && isDateKey(parsed.lastActiveDate)
        ? parsed.lastActiveDate
        : null;
    const lastOpenDate =
      typeof parsed.lastOpenDate === 'string' && isDateKey(parsed.lastOpenDate)
        ? parsed.lastOpenDate
        : null;
    return {
      count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
      lastActiveDate,
      lastOpenDate,
    };
  } catch {
    return emptyStreak();
  }
}

async function loadStreak(): Promise<StreakData> {
  try {
    return parseStreak(await AsyncStorage.getItem(STREAK_KEY));
  } catch {
    return emptyStreak();
  }
}

async function saveStreak(data: StreakData): Promise<void> {
  await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function recordAppOpen(today = localDateKey()): Promise<StreakData> {
  return enqueue(async () => {
    const next = applyAppOpen(await loadStreak(), today);
    await saveStreak(next);
    return next;
  });
}

export async function recordStreakActivity(today = localDateKey()): Promise<StreakData> {
  return enqueue(async () => {
    const next = applyActivity(await loadStreak(), today);
    await saveStreak(next);
    return next;
  });
}
