import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDateKey, localDateKey } from './dates';

const WINS_KEY = 'chadDailyWins';

export type DayWins = {
  mental: string;
  physical: string;
  spiritual: string;
};

export function emptyWins(): DayWins {
  return { mental: '', physical: '', spiritual: '' };
}

function isDayWins(value: unknown): value is DayWins {
  if (!value || typeof value !== 'object') return false;
  const wins = value as DayWins;
  return (
    typeof wins.mental === 'string' &&
    typeof wins.physical === 'string' &&
    typeof wins.spiritual === 'string'
  );
}

function normalizeWins(wins: DayWins): DayWins {
  return {
    mental: wins.mental.trim(),
    physical: wins.physical.trim(),
    spiritual: wins.spiritual.trim(),
  };
}

export function winsHaveActivity(wins: DayWins): boolean {
  const cleaned = normalizeWins(wins);
  return Boolean(cleaned.mental || cleaned.physical || cleaned.spiritual);
}

async function loadStore(): Promise<Record<string, DayWins>> {
  try {
    const raw = await AsyncStorage.getItem(WINS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const store: Record<string, DayWins> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isDateKey(key) && isDayWins(value)) {
        store[key] = normalizeWins(value);
      }
    }
    return store;
  } catch {
    return {};
  }
}

export async function loadTodayWins(today = localDateKey()): Promise<DayWins> {
  const store = await loadStore();
  return store[today] ?? emptyWins();
}

/** Save one day without dropping other stored dates. */
export async function saveTodayWins(wins: DayWins, today = localDateKey()): Promise<void> {
  const store = await loadStore();
  store[today] = normalizeWins(wins);
  await AsyncStorage.setItem(WINS_KEY, JSON.stringify(store));
}
