function pick<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clean(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[.•\-\s]+/, '')
    .replace(/\.$/, '');
}

function lower(text: string): string {
  return clean(text).toLowerCase();
}

/** Prefer short phrases; soft-cap near 120 characters. */
function trimMessage(message: string, max = 120): string {
  const compact = message.trim().replace(/\s+/g, ' ');
  if (compact.length <= max) return compact;
  const cut = compact.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}.`;
}

function asVisionOutcome(goal: string): string {
  const g = lower(goal);
  if (/^(get|build|own|become|have|make|earn|buy|create|find|win)\b/.test(g)) {
    return g;
  }
  return `get ${g}`;
}

function asAntiBehavior(bad: string): string {
  const b = lower(bad);
  if (
    /^(doomscrolling|scrolling|procrastinating|overthinking|sleeping in|skipping|avoiding|binging)/.test(
      b,
    )
  ) {
    return b;
  }
  if (b.startsWith('being ')) return b.slice(6);
  return b;
}

export type ChadMessageKind = 'affirmation' | 'accountability' | 'sideQuest';

export function generateAffirmation(vision: string[], _antiVision: string[]): string {
  const goal = pick(shuffle(vision));
  if (!goal) {
    return 'You will become the man you wrote down.';
  }

  const outcome = asVisionOutcome(goal);
  const templates = [
    () => `You will ${outcome}.`,
    () => `You will get that ${lower(goal)}.`,
    () => `That ${lower(goal)} is coming.`,
    () => `You’re built for ${lower(goal)}.`,
  ];

  return trimMessage(pick(templates)!());
}

export function generateAccountability(vision: string[], antiVision: string[]): string {
  const goal = pick(shuffle(vision));
  const bad = pick(shuffle(antiVision));

  if (goal && bad) {
    const outcome = asVisionOutcome(goal);
    const behavior = asAntiBehavior(bad);
    const templates = [
      () => `You won’t ${outcome} by ${behavior}.`,
      () => `You won’t get that ${lower(goal)} by ${behavior}.`,
      () => `${behavior} doesn’t build ${lower(goal)}.`,
      () => `Cut the ${behavior}. You want ${lower(goal)}.`,
    ];
    return trimMessage(pick(templates)!());
  }

  if (bad) {
    return trimMessage(`You won’t get the life you want by ${asAntiBehavior(bad)}.`);
  }

  if (goal) {
    return trimMessage(`Stay locked in. ${asVisionOutcome(goal)} needs today’s work.`);
  }

  return 'Hold the line. Excuses don’t build the life you want.';
}

type SideQuestTemplate = (goal?: string, bad?: string) => string;

const UNIVERSAL_SIDE_QUESTS: SideQuestTemplate[] = [
  () => 'Side quest: Drink a full glass of water right now.',
  () => 'Side quest: Stand up and stretch for 60 seconds.',
  () => 'Side quest: Put your phone face-down for 10 minutes.',
  () => 'Side quest: Make your bed before you do anything else.',
  () => 'Side quest: Write one sentence about who you’re becoming.',
  () => 'Side quest: Do 20 pushups or walk around the block.',
];

function listAwareSideQuests(goal?: string, bad?: string): SideQuestTemplate[] {
  const quests: SideQuestTemplate[] = [];

  if (goal) {
    const g = lower(goal);
    quests.push(
      () => `Side quest: Take one tiny step toward ${g} in the next 10 minutes.`,
      () => `Side quest: Text or note one action that moves ${g} forward.`,
      () => `Side quest: Clear 5 minutes and work on ${g} only.`,
      () => `Side quest: Ask: what’s the next smallest move for ${g}?`,
    );
  }

  if (bad) {
    const b = asAntiBehavior(bad);
    quests.push(
      () => `Side quest: Catch yourself mid-${b} and stop for 15 minutes.`,
      () => `Side quest: Replace ${b} with one focused minute of work.`,
      () => `Side quest: Block the trigger for ${b} for the next hour.`,
    );
  }

  return quests;
}

export function generateSideQuest(vision: string[], antiVision: string[]): string {
  const goal = pick(shuffle(vision));
  const bad = pick(shuffle(antiVision));

  // Prefer list-aware templates when available, but keep universal variety.
  const pool =
    goal || bad
      ? [...listAwareSideQuests(goal, bad), ...shuffle(UNIVERSAL_SIDE_QUESTS).slice(0, 3)]
      : UNIVERSAL_SIDE_QUESTS;

  return trimMessage(pick(pool)!());
}

export function generateTestMessage(vision: string[], antiVision: string[]): string {
  return generateAffirmation(vision, antiVision);
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
