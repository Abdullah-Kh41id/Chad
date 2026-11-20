export type ChadMessageKind = 'affirmation' | 'accountability' | 'sideQuest';

export type MessageContext = {
  vision: string[];
  antiVision: string[];
  dailyMissions?: string[];
  quarterlyMissions?: string[];
};

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

/** Priority: daily missions → vision → quarterly missions. */
function pickPriorityGoal(ctx: MessageContext): string | undefined {
  const daily = shuffle(ctx.dailyMissions ?? []);
  if (daily.length > 0) return pick(daily);

  const vision = shuffle(ctx.vision);
  if (vision.length > 0) return pick(vision);

  const quarterly = shuffle(ctx.quarterlyMissions ?? []);
  if (quarterly.length > 0) return pick(quarterly);

  return undefined;
}

export function generateAffirmation(ctx: MessageContext): string {
  const goal = pickPriorityGoal(ctx) ?? pick(shuffle(ctx.vision));
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

export function generateAccountability(ctx: MessageContext): string {
  const bad = pick(shuffle(ctx.antiVision));
  const goal =
    pick(shuffle(ctx.vision)) ??
    pick(shuffle(ctx.dailyMissions ?? [])) ??
    pick(shuffle(ctx.quarterlyMissions ?? []));

  if (goal && bad) {
    const outcome = asVisionOutcome(goal);
    const behavior = asAntiBehavior(bad);
    const templates = [
      () => `You won’t ${outcome} by ${behavior}.`,
      () => `You won’t get that ${lower(goal)} by ${behavior}.`,
      () => `${behavior} doesn’t build ${lower(goal)}.`,
      () => `Cut the ${behavior}. You want ${lower(goal)}.`,
      () => `You won’t finish ${lower(goal)} by ${behavior}.`,
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

const UNIVERSAL_SIDE_QUESTS = [
  () => 'Side quest: Drink a full glass of water right now.',
  () => 'Side quest: Stand up and stretch for 60 seconds.',
  () => 'Side quest: Put your phone face-down for 10 minutes.',
  () => 'Side quest: Make your bed before you do anything else.',
];

export function generateSideQuest(ctx: MessageContext): string {
  const daily = shuffle(ctx.dailyMissions ?? []);
  const quarterly = shuffle(ctx.quarterlyMissions ?? []);
  const vision = shuffle(ctx.vision);
  const bad = pick(shuffle(ctx.antiVision));

  const pool: Array<() => string> = [];

  // 1) Daily missions — highest priority for side quests
  for (const mission of daily.slice(0, 4)) {
    const m = lower(mission);
    pool.push(
      () => `Side quest: ${clean(mission)}.`,
      () => `Side quest: Next move toward ${m}.`,
      () => `Next move toward ${m}.`,
    );
  }

  // 2) Vision items
  for (const goal of vision.slice(0, 3)) {
    const g = lower(goal);
    pool.push(
      () => `Side quest: Next move toward ${g}.`,
      () => `Side quest: Take one tiny step toward ${g}.`,
    );
  }

  // 3) Quarterly missions
  for (const mission of quarterly.slice(0, 2)) {
    const m = lower(mission);
    pool.push(() => `Side quest: Next move toward ${m}.`);
  }

  // Light anti-vision contrast, then universals as fallback
  if (bad) {
    const b = asAntiBehavior(bad);
    pool.push(() => `Side quest: Replace ${b} with one focused minute of work.`);
  }

  if (pool.length === 0) {
    return trimMessage(pick(UNIVERSAL_SIDE_QUESTS)!());
  }

  // Prefer mission/vision phrasing; keep a little universal variety.
  const weighted = [...pool, ...shuffle(UNIVERSAL_SIDE_QUESTS).slice(0, 1)];
  return trimMessage(pick(weighted)!());
}

export function generateTestMessage(
  vision: string[],
  antiVision: string[],
  extras?: Pick<MessageContext, 'dailyMissions' | 'quarterlyMissions'>,
): string {
  return generateAffirmation({
    vision,
    antiVision,
    dailyMissions: extras?.dailyMissions,
    quarterlyMissions: extras?.quarterlyMissions,
  });
}

export function generateMessageByKind(
  kind: ChadMessageKind,
  vision: string[],
  antiVision: string[],
  extras?: Pick<MessageContext, 'dailyMissions' | 'quarterlyMissions'>,
): string {
  const ctx: MessageContext = {
    vision,
    antiVision,
    dailyMissions: extras?.dailyMissions,
    quarterlyMissions: extras?.quarterlyMissions,
  };

  switch (kind) {
    case 'affirmation':
      return generateAffirmation(ctx);
    case 'accountability':
      return generateAccountability(ctx);
    case 'sideQuest':
      return generateSideQuest(ctx);
  }
}
