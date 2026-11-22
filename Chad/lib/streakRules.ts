import { shiftDateKey } from './dates';

/**
 * Daily streak.
 *
 * A day counts only when the app is open and the user logs activity
 * (completing a mission or saving a win). Activity always happens while the
 * app is open, so the stored streak advances on activity.
 *
 * Local calendar dates:
 * - Activity today, and the previous counted day was yesterday: streak + 1.
 * - Activity today, already counted today: streak stays.
 * - Activity today after a missed day, or with no history: streak becomes 1.
 * - On open, if the last counted day is before yesterday, the streak resets to 0.
 *   Yesterday still counts until today ends without activity.
 */
export type StreakData = {
  count: number;
  lastActiveDate: string | null;
  lastOpenDate: string | null;
};

export function emptyStreak(): StreakData {
  return { count: 0, lastActiveDate: null, lastOpenDate: null };
}

export function applyAppOpen(data: StreakData, today: string): StreakData {
  const yesterday = shiftDateKey(today, -1);
  const missed =
    data.lastActiveDate !== null &&
    data.lastActiveDate !== today &&
    data.lastActiveDate !== yesterday;

  return {
    count: missed ? 0 : Math.max(0, Math.floor(data.count) || 0),
    lastActiveDate: data.lastActiveDate,
    lastOpenDate: today,
  };
}

export function applyActivity(data: StreakData, today: string): StreakData {
  if (data.lastActiveDate === today) {
    return {
      ...data,
      count: Math.max(1, Math.floor(data.count) || 0),
      lastOpenDate: today,
    };
  }

  const yesterday = shiftDateKey(today, -1);
  const continued = data.lastActiveDate === yesterday;
  return {
    count: continued ? Math.max(0, Math.floor(data.count) || 0) + 1 : 1,
    lastActiveDate: today,
    lastOpenDate: today,
  };
}
