function pick<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function clean(text: string): string {
  return text.trim().toLowerCase().replace(/\.$/, '');
}

export function generateTestMessage(vision: string[], antiVision: string[]): string {
  if (vision.length > 0) {
    const item = vision[Math.floor(Math.random() * vision.length)];
    return `You will ${item.toLowerCase().replace(/\.$/, '')}.`;
  }
  if (antiVision.length > 0) {
    const bad = antiVision[0];
    return `You won’t get the life you want by ${bad.toLowerCase()}.`;
  }
  return 'You will become the man you wrote down.';
}

export type ChadMessageKind = 'affirmation' | 'accountability' | 'sideQuest';

export function generateAffirmation(vision: string[], antiVision: string[]): string {
  const goal = pick(vision);
  if (goal) {
    return `You will ${clean(goal)}. Keep moving like that life is already yours.`;
  }
  const bad = pick(antiVision);
  if (bad) {
    return `You are not becoming the man who ${clean(bad)}. That chapter is closed.`;
  }
  return 'You will become the man you wrote down.';
}

export function generateAccountability(vision: string[], antiVision: string[]): string {
  const bad = pick(antiVision);
  const goal = pick(vision);
  if (bad && goal) {
    return `Don’t slide into ${clean(bad)}. Prove today that you will ${clean(goal)}.`;
  }
  if (bad) {
    return `Don’t slide into ${clean(bad)}. Fix your standards right now.`;
  }
  if (goal) {
    return `What did you do today that proves you will ${clean(goal)}?`;
  }
  return 'Hold the line. Excuses don’t build the life you want.';
}

export function generateSideQuest(vision: string[], antiVision: string[]): string {
  const goal = pick(vision);
  if (goal) {
    return `Side quest: take one concrete action in the next hour that moves you toward ${clean(goal)}.`;
  }
  const bad = pick(antiVision);
  if (bad) {
    return `Side quest: kill one habit that leads to ${clean(bad)} before the day ends.`;
  }
  return 'Side quest: do one hard thing before dinner that Future You would respect.';
}

export function generateMessageByKind(
  kind: ChadMessageKind,
  vision: string[],
  antiVision: string[],
): string {
  switch (kind) {
    case 'affirmation':
      return generateAffirmation(vision, antiVision);
    case 'accountability':
      return generateAccountability(vision, antiVision);
    case 'sideQuest':
      return generateSideQuest(vision, antiVision);
  }
}
