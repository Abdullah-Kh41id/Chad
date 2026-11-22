import AsyncStorage from '@react-native-async-storage/async-storage';

export type MissionCategory = 'daily' | 'quarterly' | 'year';

export type Mission = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
};

export type MissionBoard = {
  daily: Mission[];
  quarterly: Mission[];
  year: Mission[];
};

/**
 * XP granted when a mission is completed. Each roll is an integer inside the band:
 * daily 50–100, quarterly 300–500, yearly 1000–2000.
 * Existing total XP in AsyncStorage is left as-is; only new completions use these bands.
 */
export const XP_RANGES: Record<MissionCategory, { min: number; max: number }> = {
  daily: { min: 50, max: 100 },
  quarterly: { min: 300, max: 500 },
  year: { min: 1000, max: 2000 },
};

export function rollMissionXp(category: MissionCategory): number {
  const { min, max } = XP_RANGES[category];
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function formatXpRange(category: MissionCategory): string {
  const { min, max } = XP_RANGES[category];
  return `${min}–${max} XP`;
}

export const CATEGORY_LABELS: Record<MissionCategory, string> = {
  daily: 'Daily Missions',
  quarterly: 'Quarterly Missions (3 months)',
  year: '1 Year Missions',
};

const MISSIONS_KEY = 'chadMissions';
const XP_KEY = 'chadTotalXp';

const emptyBoard = (): MissionBoard => ({
  daily: [],
  quarterly: [],
  year: [],
});

function isMission(value: unknown): value is Mission {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Mission).id === 'string' &&
    typeof (value as Mission).text === 'string' &&
    typeof (value as Mission).completed === 'boolean' &&
    typeof (value as Mission).createdAt === 'number'
  );
}

export async function loadMissionBoard(): Promise<MissionBoard> {
  try {
    const raw = await AsyncStorage.getItem(MISSIONS_KEY);
    if (!raw) return emptyBoard();
    const parsed = JSON.parse(raw);
    return {
      daily: Array.isArray(parsed?.daily) ? parsed.daily.filter(isMission) : [],
      quarterly: Array.isArray(parsed?.quarterly) ? parsed.quarterly.filter(isMission) : [],
      year: Array.isArray(parsed?.year) ? parsed.year.filter(isMission) : [],
    };
  } catch {
    return emptyBoard();
  }
}

export async function saveMissionBoard(board: MissionBoard): Promise<void> {
  await AsyncStorage.setItem(MISSIONS_KEY, JSON.stringify(board));
}

export async function loadTotalXp(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(XP_KEY);
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export async function saveTotalXp(xp: number): Promise<void> {
  await AsyncStorage.setItem(XP_KEY, String(Math.max(0, Math.floor(xp))));
}

export function createMission(text: string): Mission {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    completed: false,
    createdAt: Date.now(),
  };
}
