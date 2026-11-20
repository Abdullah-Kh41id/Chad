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

/** Strip bullets, extra spaces, trailing punctuation. */
export function normalizePhrase(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[.•\-\s]+/, '')
    .replace(/[.!?]+$/g, '')
    .trim();
}

/** Capitalize first letter and ensure a terminal period. */
export function finalizeSentence(message: string): string {
  const compact = message.trim().replace(/\s+/g, ' ');
  if (!compact) return '';

  const withCap = compact.charAt(0).toUpperCase() + compact.slice(1);
  if (/[.!?]$/.test(withCap)) return withCap;
  return `${withCap}.`;
}

function softTrim(message: string, max = 120): string {
  const compact = message.trim().replace(/\s+/g, ' ');
  if (compact.length <= max) return compact;
  const cut = compact.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim();
}

const LEADING_VERBS =
  /^(wake|waking|make|making|have|having|build|building|get|getting|own|owning|become|becoming|earn|earning|buy|buying|create|creating|find|finding|win|winning|start|starting|stop|stopping|quit|quitting|move|moving|live|living|run|running|launch|launching|grow|growing|reach|reaching|finish|finishing|take|taking|do|doing|be|being|call|calling|close|closing|send|sending|write|writing|read|reading|train|training|ship|shipping|sell|selling|hire|hiring|fix|fixing|pay|paying|save|saving|invest|investing)\b/i;

function startsWithVerb(phrase: string): boolean {
  return LEADING_VERBS.test(normalizePhrase(phrase));
}

/** Natural affirmation body without the "You will" prefix. */
export function toAffirmationClause(visionItem: string): string {
  const phrase = normalizePhrase(visionItem);
  if (!phrase) return 'become the man you wrote down';

  const lower = phrase.toLowerCase();

  // Already a clean "You will ..." style item.
  if (/^you will\b/i.test(phrase)) {
    return normalizePhrase(phrase.replace(/^you will\s+/i, '')).toLowerCase();
  }

  // Verb-led goals: "wake up in your mansion..." / "make it big" / "call the lawyer"
  if (startsWithVerb(phrase)) {
    return lower;
  }

  // Wealth / asset noun phrases
  if (/net\s*worth|networth|fortune|empire|garage|mansion|business/i.test(phrase)) {
    if (/^\d/.test(lower) || /net\s*worth|networth/i.test(lower)) {
      return `reach ${lower}`;
    }
    return `build ${lower}`;
  }

  // Default noun phrase
  return `get ${lower}`;
}

/** Clause usable after "You won’t … by …" */
export function toAccountabilityTarget(visionOrMission: string): string {
  const phrase = normalizePhrase(visionOrMission);
  if (!phrase) return 'get the life you want';

  if (/^you will\b/i.test(phrase)) {
    return normalizePhrase(phrase.replace(/^you will\s+/i, '')).toLowerCase();
  }

  // Reuse affirmation clause so nouns get a verb ("reach 100 m networth").
  return toAffirmationClause(phrase);
}

/** Noun/goal phrase for "You want …" */
export function toDesirePhrase(visionOrMission: string): string {
  const phrase = normalizePhrase(visionOrMission);
  if (!phrase) return 'the life you wrote down';

  const lower = phrase.toLowerCase();
  if (/^you will\b/i.test(phrase)) {
    return normalizePhrase(phrase.replace(/^you will\s+/i, '')).toLowerCase();
  }
  if (startsWithVerb(phrase)) {
    // "have peace at home" -> "to have peace at home"
    return `to ${lower}`;
  }
  return lower;
}

/** Phrase after "toward …" */
export function toTowardPhrase(visionOrMission: string): string {
  const phrase = normalizePhrase(visionOrMission);
  if (!phrase) return 'the life you want';

  const lower = phrase.toLowerCase();
  if (/^you will\b/i.test(phrase)) {
    return normalizePhrase(phrase.replace(/^you will\s+/i, '')).toLowerCase();
  }

  if (startsWithVerb(phrase)) {
    return lower.replace(
      /^(get|make|have|build|become|earn|buy|create|find|win|finish|call|close|take|do|wake|start|stop|grow|reach|launch|move|live|run|own|hire|ship|sell|pay|save|invest|train|write|read|send|form)\b/i,
      (verb) => {
        const v = verb.toLowerCase();
        if (v === 'have') return 'having';
        if (v === 'make') return 'making';
        if (v === 'wake') return 'waking';
        if (v.endsWith('e') && !/(ee|oe|ye)$/.test(v)) return `${v.slice(0, -1)}ing`;
        return `${v}ing`;
      },
    );
  }

  return lower;
}

export function toAntiBehavior(antiItem: string): string {
  const phrase = normalizePhrase(antiItem).toLowerCase();
  if (!phrase) return 'slipping';
  if (phrase.startsWith('being ')) return phrase.slice(6);
  if (phrase.startsWith('by ')) return phrase.slice(3);
  return phrase;
}

function pickPriorityGoal(ctx: MessageContext): string | undefined {
  const daily = shuffle((ctx.dailyMissions ?? []).map(normalizePhrase).filter(Boolean));
  if (daily.length > 0) return pick(daily);

  const vision = shuffle(ctx.vision.map(normalizePhrase).filter(Boolean));
  if (vision.length > 0) return pick(vision);

  const quarterly = shuffle((ctx.quarterlyMissions ?? []).map(normalizePhrase).filter(Boolean));
  if (quarterly.length > 0) return pick(quarterly);

  return undefined;
}

export function generateAffirmation(ctx: MessageContext): string {
  const goal = pickPriorityGoal(ctx) ?? pick(shuffle(ctx.vision.map(normalizePhrase).filter(Boolean)));
  if (!goal) {
    return finalizeSentence('You will become the man you wrote down');
  }

  const clause = toAffirmationClause(goal);
  const lowerGoal = normalizePhrase(goal).toLowerCase();

  const templates: Array<() => string> = [
    () => `You will ${clause}`,
  ];

  // Noun-style alternatives when the item isn't already verb-led.
  if (!startsWithVerb(goal) && !/^you will\b/i.test(goal)) {
    templates.push(
      () => `The ${lowerGoal} is coming`,
      () => `You’re built for ${lowerGoal}`,
    );
  } else {
    templates.push(() => `You will ${clause}`);
  }

  return finalizeSentence(softTrim(pick(templates)!()));
}

export function generateAccountability(ctx: MessageContext): string {
  const badRaw = pick(shuffle(ctx.antiVision.map(normalizePhrase).filter(Boolean)));
  const goalRaw =
    pick(shuffle(ctx.vision.map(normalizePhrase).filter(Boolean))) ??
    pick(shuffle((ctx.dailyMissions ?? []).map(normalizePhrase).filter(Boolean))) ??
    pick(shuffle((ctx.quarterlyMissions ?? []).map(normalizePhrase).filter(Boolean)));

  const bad = badRaw ? toAntiBehavior(badRaw) : undefined;
  const target = goalRaw ? toAccountabilityTarget(goalRaw) : undefined;
  const desire = goalRaw ? toDesirePhrase(goalRaw) : undefined;

  if (target && bad && desire) {
    const templates = [
      () => `You won’t ${target} by ${bad}`,
      () => `Cut the ${bad}. You want ${desire}`,
      () => `You won’t get there by ${bad}. Stay focused`,
    ];
    return finalizeSentence(softTrim(pick(templates)!()));
  }

  if (bad) {
    return finalizeSentence(`You won’t get the life you want by ${bad}`);
  }

  if (target) {
    return finalizeSentence(`Stay locked in. You will ${target}`);
  }

  return finalizeSentence('Hold the line. Excuses don’t build the life you want');
}

const UNIVERSAL_SIDE_QUESTS = [
  'Side quest: Drink a full glass of water right now',
  'Side quest: Stand up and stretch for 60 seconds',
  'Side quest: Put your phone face-down for 10 minutes',
  'Side quest: Make your bed before you do anything else',
];

export function generateSideQuest(ctx: MessageContext): string {
  const daily = shuffle((ctx.dailyMissions ?? []).map(normalizePhrase).filter(Boolean));
  const quarterly = shuffle((ctx.quarterlyMissions ?? []).map(normalizePhrase).filter(Boolean));
  const vision = shuffle(ctx.vision.map(normalizePhrase).filter(Boolean));
  const badRaw = pick(shuffle(ctx.antiVision.map(normalizePhrase).filter(Boolean)));

  const pool: string[] = [];

  for (const mission of daily.slice(0, 4)) {
    const toward = toTowardPhrase(mission);
    pool.push(`Side quest: ${mission}`);
    pool.push(`Side quest: Next move toward ${toward}`);
  }

  for (const goal of vision.slice(0, 3)) {
    const toward = toTowardPhrase(goal);
    pool.push(
      `Side quest: Take one concrete action in the next hour that moves you toward ${toward}`,
    );
    pool.push(`Side quest: Next move toward ${toward}`);
  }

  for (const mission of quarterly.slice(0, 2)) {
    pool.push(`Side quest: Next move toward ${toTowardPhrase(mission)}`);
  }

  if (badRaw) {
    const bad = toAntiBehavior(badRaw);
    pool.push(`Side quest: Replace ${bad} with one focused minute of work`);
  }

  if (pool.length === 0) {
    return finalizeSentence(pick(UNIVERSAL_SIDE_QUESTS) ?? UNIVERSAL_SIDE_QUESTS[0]);
  }

  const weighted = [...pool, ...shuffle(UNIVERSAL_SIDE_QUESTS).slice(0, 1)];
  return finalizeSentence(softTrim(pick(weighted) ?? UNIVERSAL_SIDE_QUESTS[0]));
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
