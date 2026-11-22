import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Vision profile.
 *
 * Existing keys stay string arrays so current users and Chad's message
 * history keep working:
 *   antiVision — short "refusing" bullets
 *   vision     — short goals
 *
 * Stories are new optional strings. Missing keys migrate as empty text.
 * Onboarding is complete when both original list keys already exist,
 * even if those lists are empty arrays.
 */
const ANTI_LIST = 'antiVision';
const VISION_LIST = 'vision';
const ANTI_STORY = 'antiVisionStory';
const VISION_STORY = 'visionStory';

export type ChadProfile = {
  onboarded: boolean;
  antiStory: string;
  visionStory: string;
  antiVision: string[];
  vision: string[];
};

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

function cleanList(items: string[]): string[] {
  return items.map((item) => item.trim()).filter(Boolean);
}

export async function loadChadProfile(): Promise<ChadProfile> {
  const entries = await AsyncStorage.multiGet([ANTI_LIST, VISION_LIST, ANTI_STORY, VISION_STORY]);
  const map = Object.fromEntries(entries) as Record<string, string | null>;
  const antiRaw = map[ANTI_LIST] ?? null;
  const visionRaw = map[VISION_LIST] ?? null;

  return {
    onboarded: Boolean(antiRaw && visionRaw),
    antiStory: map[ANTI_STORY] ?? '',
    visionStory: map[VISION_STORY] ?? '',
    antiVision: parseList(antiRaw),
    vision: parseList(visionRaw),
  };
}

export async function saveChadProfile(input: {
  antiStory: string;
  visionStory: string;
  antiVision: string[];
  vision: string[];
}): Promise<void> {
  await AsyncStorage.multiSet([
    [ANTI_LIST, JSON.stringify(cleanList(input.antiVision))],
    [VISION_LIST, JSON.stringify(cleanList(input.vision))],
    [ANTI_STORY, input.antiStory.trim()],
    [VISION_STORY, input.visionStory.trim()],
  ]);
}

export async function saveAntiVision(story: string, items: string[]): Promise<void> {
  await AsyncStorage.multiSet([
    [ANTI_LIST, JSON.stringify(cleanList(items))],
    [ANTI_STORY, story.trim()],
  ]);
}

export async function saveVision(story: string, items: string[]): Promise<void> {
  await AsyncStorage.multiSet([
    [VISION_LIST, JSON.stringify(cleanList(items))],
    [VISION_STORY, story.trim()],
  ]);
}
