import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChadMessage = {
  text: string;
  timestamp: number;
};

const STORAGE_KEY = 'chadMessages';
const MAX_STORED = 50;

export async function loadChadMessages(): Promise<ChadMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ChadMessage =>
          item &&
          typeof item === 'object' &&
          typeof item.text === 'string' &&
          typeof item.timestamp === 'number',
      )
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export async function saveChadMessage(text: string): Promise<ChadMessage[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    return loadChadMessages();
  }

  const existing = await loadChadMessages();
  const next: ChadMessage[] = [
    { text: trimmed, timestamp: Date.now() },
    ...existing,
  ].slice(0, MAX_STORED);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function saveChadMessages(texts: string[]): Promise<ChadMessage[]> {
  let messages = await loadChadMessages();
  const now = Date.now();

  const additions: ChadMessage[] = texts
    .map((text, index) => ({
      text: text.trim(),
      // Slight offset so reverse-chronological order matches schedule order.
      timestamp: now + index,
    }))
    .filter((item) => item.text.length > 0);

  messages = [...additions.reverse(), ...messages].slice(0, MAX_STORED);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  return messages;
}

export function formatMessageTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
