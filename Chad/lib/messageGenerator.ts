export type ChadMessageKind = 'affirmation' | 'accountability' | 'sideQuest';

export type MessageContext = {
  vision: string[];
  antiVision: string[];
  visionStory?: string;
  antiVisionStory?: string;
  dailyMissions?: string[];
  quarterlyMissions?: string[];
};

export type PhraseKind = 'verb' | 'gerund' | 'quote' | 'empty';

export type ClassifiedPhrase = {
  kind: PhraseKind;
  /** Lowercased verb or gerund phrase when kind is verb or gerund. */
  action: string;
  /** Cleaned display text for quoting. */
  display: string;
};

/**
 * Chad copy only conjugates an item when the grammar is obvious:
 * a known base verb, a gerund of one of those verbs, or a "to" + verb.
 * Leading "I", "I'm going to", "I want to", and similar wrappers are peeled
 * off first. Anything else is wrapped, never forced into "You will get …".
 *
 *   wake up at 5            → You will wake up at 5.
 *   to build a business     → You will build a business.
 *   building a company      → You are building a company.
 *   I run every morning     → You will run every morning.
 *   the mansion             → Your goal: "The mansion".
 */

const VERBS = new Set(
  `answer ask attack be become begin breathe bring budget build buy
   call choose clean close coach code cook create cut
   decide defend design do draw drink drive drop
   earn eat exercise
   fast fight film find finish fix focus forgive
   get give go grind grow
   have help hire hit hold hustle
   invest
   join journal
   keep
   launch lead learn leave lift listen live love
   make marry meditate meet mentor move
   open own
   paint pay plan play post practice pray protect publish put
   quit
   raise reach read record rest ride rise run
   save scroll see sell send serve set shave ship show shower sing sit skip sleep smoke snooze speak stand start stay stop stretch study swim
   take talk teach text track train travel
   visit
   wait wake walk waste watch win wish work write`
    .split(/\s+/)
    .filter(Boolean),
);

const FALLBACK_AFFIRMATIONS = [
  'You will become the man you wrote down.',
  'You are building the life you chose.',
];

const FALLBACK_ACCOUNTABILITY = [
  'Hold the line. Excuses do not build the life you want.',
];

const UNIVERSAL_SIDE_QUESTS = [
  'Side quest: Drink a full glass of water right now.',
  'Side quest: Stand up and stretch for 60 seconds.',
  'Side quest: Put your phone face-down for 10 minutes.',
  'Side quest: Make your bed before you do anything else.',
];

const PREFIXES: { pattern: RegExp; verbRemainder: boolean }[] = [
  { pattern: /^i'm\s+going\s+to\s+/i, verbRemainder: true },
  { pattern: /^i\s+am\s+going\s+to\s+/i, verbRemainder: true },
  { pattern: /^i'm\s+gonna\s+/i, verbRemainder: true },
  { pattern: /^i\s+am\s+gonna\s+/i, verbRemainder: true },
  { pattern: /^gonna\s+/i, verbRemainder: true },
  { pattern: /^going\s+to\s+/i, verbRemainder: true },
  { pattern: /^i\s+will\s+/i, verbRemainder: false },
  { pattern: /^i'll\s+/i, verbRemainder: false },
  { pattern: /^i\s+want\s+to\s+/i, verbRemainder: true },
  { pattern: /^i\s+wanna\s+/i, verbRemainder: true },
  { pattern: /^i\s+need\s+to\s+/i, verbRemainder: true },
  { pattern: /^i\s+have\s+to\s+/i, verbRemainder: true },
  { pattern: /^i\s+gotta\s+/i, verbRemainder: true },
  { pattern: /^you\s+will\s+/i, verbRemainder: false },
  { pattern: /^i'm\s+/i, verbRemainder: false },
  { pattern: /^i\s+am\s+/i, verbRemainder: false },
  { pattern: /^to\s+/i, verbRemainder: true },
  { pattern: /^i\s+/i, verbRemainder: false },
];

function pick<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const left = copy[i];
    const right = copy[j];
    if (left === undefined || right === undefined) continue;
    copy[i] = right;
    copy[j] = left;
  }
  return copy;
}

function firstWord(text: string): string {
  return text.split(/\s+/)[0]?.replace(/[^A-Za-z']/g, '') ?? '';
}

function lowerFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function cap(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function polishMessage(message: string): string {
  const compact = message
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+([.!?])/g, '$1');
  if (!compact) return '';
  const capped = compact.charAt(0).toUpperCase() + compact.slice(1);
  if (/[.!?…]$/.test(capped)) return capped;
  return `${capped}.`;
}

function gerundStem(word: string): string | null {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!cleaned.endsWith('ing') || cleaned.length < 5) return null;
  const base = cleaned.slice(0, -3);
  if (VERBS.has(base)) return base;
  if (VERBS.has(`${base}e`)) return `${base}e`;
  if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
    const undoubled = base.slice(0, -1);
    if (VERBS.has(undoubled)) return undoubled;
  }
  return null;
}

function startsWithBaseVerb(text: string): boolean {
  return VERBS.has(firstWord(text).toLowerCase());
}

function startsWithGerund(text: string): boolean {
  return gerundStem(firstWord(text)) !== null;
}

export function cleanItem(raw: string): string {
  let text = raw
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  text = text.replace(/^(?:(?:[•*\u2022\-–—]+)\s*)+/, '');
  text = text.replace(/^\d+[.)]\s*/, '');
  text = text.replace(/^['"]+|['"]+$/g, '').trim();
  text = text.replace(/[.!?…,;:]+$/g, '').trim();
  if (!text || !/[A-Za-z0-9]/.test(text)) return '';

  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 2 && letters === letters.toUpperCase()) {
    text = text.charAt(0) + text.slice(1).toLowerCase();
  }
  if (/^[a-z]/.test(text) && !/^.[A-Z]/.test(text)) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  return text;
}

function stripOnePrefix(text: string): string | null {
  for (const rule of PREFIXES) {
    const match = text.match(rule.pattern);
    if (!match?.[0]) continue;
    const rest = text.slice(match[0].length).trim();
    if (!rest) continue;
    if (rule.verbRemainder && !startsWithBaseVerb(rest) && !startsWithGerund(rest)) continue;
    return rest;
  }
  return null;
}

function extractAction(input: string): { kind: 'verb' | 'gerund'; action: string } | null {
  let text = input.trim();
  for (let i = 0; i < 4; i += 1) {
    if (startsWithBaseVerb(text)) return { kind: 'verb', action: lowerFirst(text) };
    if (startsWithGerund(text)) return { kind: 'gerund', action: lowerFirst(text) };
    const next = stripOnePrefix(text);
    if (!next) return null;
    text = next;
  }
  return null;
}

export function classifyPhrase(raw: string): ClassifiedPhrase {
  const display = cleanItem(raw);
  if (!display) return { kind: 'empty', action: '', display: '' };
  const action = extractAction(display);
  if (!action || !action.action.trim()) return { kind: 'quote', action: '', display };
  return { kind: action.kind, action: action.action, display };
}

function quoteDisplay(display: string): string {
  let text = display.trim();
  if (!text) return '';
  if (text.length > 80) {
    const cut = text.slice(0, 79);
    const lastSpace = cut.lastIndexOf(' ');
    text = `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
  }
  return `"${text}"`;
}

function storyExcerpt(story: string): string {
  const oneLine = story.trim().replace(/\s+/g, ' ');
  if (!oneLine) return '';
  const sentenceMatch = oneLine.match(/^[\s\S]{1,180}?[.!?]/);
  const sentence = (sentenceMatch ? sentenceMatch[0] : oneLine).replace(/[.!?…]+$/g, '').trim();
  if (!sentence) return '';
  if (sentence.length <= 90) return sentence;
  const cut = sentence.slice(0, 87);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function affirmationVariants(item: string, options?: { quoteOnly?: boolean }): string[] {
  if (!options?.quoteOnly) {
    const classified = classifyPhrase(item);
    if (classified.kind === 'verb') {
      return [
        polishMessage(`You will ${classified.action}`),
        polishMessage(`You are going to ${classified.action}`),
      ];
    }
    if (classified.kind === 'gerund') {
      return [
        polishMessage(`You are ${classified.action}`),
        polishMessage(`Keep ${classified.action}`),
      ];
    }
    if (classified.kind === 'empty') return [...FALLBACK_AFFIRMATIONS];
    const quoted = quoteDisplay(classified.display);
    if (!quoted) return [...FALLBACK_AFFIRMATIONS];
    return [
      polishMessage(`Your goal: ${quoted}`),
      polishMessage(`Keep your eyes on ${quoted}`),
    ];
  }

  const display = cleanItem(item);
  const quoted = quoteDisplay(display);
  if (!quoted) return [...FALLBACK_AFFIRMATIONS];
  return [
    polishMessage(`Your goal: ${quoted}`),
    polishMessage(`Keep your eyes on ${quoted}`),
  ];
}

export function accountabilityVariants(
  badItem: string,
  goalItem?: string,
  options?: { goalQuoteOnly?: boolean; badQuoteOnly?: boolean },
): string[] {
  const bad = options?.badQuoteOnly
    ? { kind: 'quote' as const, action: '', display: cleanItem(badItem) }
    : badItem.trim()
      ? classifyPhrase(badItem)
      : classifyPhrase('');
  const goal = goalItem && goalItem.trim() ? classifyPhrase(goalItem) : null;
  const quotedGoalSource = options?.goalQuoteOnly ? cleanItem(goalItem ?? '') || goal?.display || '' : goal?.display || '';
  const goalQuoted = quotedGoalSource ? quoteDisplay(quotedGoalSource) : '';

  if (bad.kind === 'empty' && goal) {
    const line = affirmationVariants(goalItem ?? '', { quoteOnly: options?.goalQuoteOnly })[0] ?? FALLBACK_AFFIRMATIONS[0];
    return [polishMessage(`Stay locked in. ${line}`)];
  }

  if (bad.kind === 'empty') return [...FALLBACK_ACCOUNTABILITY];

  if (bad.kind === 'quote') {
    const badQuoted = quoteDisplay(bad.display);
    if (!badQuoted) return [...FALLBACK_ACCOUNTABILITY];
    if (!goalQuoted) return [polishMessage(`Cut this out: ${badQuoted}`)];
    return [polishMessage(`Drop ${badQuoted}. Your goal: ${goalQuoted}`)];
  }

  const byPhrase = bad.kind === 'gerund' ? bad.action : `choosing to ${bad.action}`;

  if (goal?.kind === 'verb' && !options?.goalQuoteOnly) {
    return [
      polishMessage(`You won't ${goal.action} by ${byPhrase}`),
      polishMessage(`You won't get there by ${byPhrase}`),
    ];
  }

  if (goal?.kind === 'gerund' && !options?.goalQuoteOnly) {
    return [
      polishMessage(`You won't get there by ${byPhrase}. Keep ${goal.action}`),
      polishMessage(`You won't get there by ${byPhrase}`),
    ];
  }

  if (goalQuoted) {
    return [
      polishMessage(`You won't reach ${goalQuoted} by ${byPhrase}`),
      polishMessage(`You won't get there by ${byPhrase}`),
    ];
  }

  return [polishMessage(`You won't get the life you want by ${byPhrase}`)];
}

export function sideQuestVariants(item: string, options?: { quoteOnly?: boolean }): string[] {
  if (options?.quoteOnly) {
    const quoted = quoteDisplay(cleanItem(item));
    if (!quoted) return [...UNIVERSAL_SIDE_QUESTS];
    return [
      polishMessage(`Side quest: make one move on ${quoted}`),
      polishMessage(`Side quest: your goal — ${quoted}`),
    ];
  }

  const classified = classifyPhrase(item);
  if (classified.kind === 'verb') {
    return [
      polishMessage(`Side quest: ${cap(classified.action)}`),
      polishMessage(`Side quest: do this next — ${classified.action}`),
    ];
  }
  if (classified.kind === 'gerund') {
    return [
      polishMessage(`Side quest: spend the next block ${classified.action}`),
      polishMessage(`Side quest: put in one focused bout of ${classified.action}`),
    ];
  }
  if (classified.kind === 'empty') return [...UNIVERSAL_SIDE_QUESTS];
  const quoted = quoteDisplay(classified.display);
  if (!quoted) return [...UNIVERSAL_SIDE_QUESTS];
  return [
    polishMessage(`Side quest: make one move on ${quoted}`),
    polishMessage(`Side quest: your goal — ${quoted}`),
  ];
}

function antiSideQuest(item: string, quoteOnly = false): string | null {
  if (quoteOnly) {
    const quoted = quoteDisplay(cleanItem(item));
    if (!quoted) return null;
    return polishMessage(`Side quest: drop ${quoted} for one focused minute of work`);
  }
  const classified = classifyPhrase(item);
  if (classified.kind === 'gerund') {
    return polishMessage(`Side quest: replace ${classified.action} with one focused minute of work`);
  }
  if (classified.kind === 'verb') {
    return polishMessage(`Side quest: do not ${classified.action}. Put in one focused minute of work`);
  }
  if (classified.kind === 'quote') {
    const quoted = quoteDisplay(classified.display);
    if (!quoted) return null;
    return polishMessage(`Side quest: drop ${quoted} for one focused minute of work`);
  }
  return null;
}

type GoalPick = { text: string; quoteOnly: boolean };

function usable(items: string[] | undefined): string[] {
  return shuffle((items ?? []).map((item) => item.trim()).filter(Boolean));
}

function pickGoal(ctx: MessageContext): GoalPick | undefined {
  const daily = usable(ctx.dailyMissions);
  const dailyGoal = daily[0];
  if (dailyGoal) return { text: dailyGoal, quoteOnly: false };

  const vision = usable(ctx.vision);
  const visionGoal = vision[0];
  if (visionGoal) return { text: visionGoal, quoteOnly: false };

  const quarterly = usable(ctx.quarterlyMissions);
  const quarterlyGoal = quarterly[0];
  if (quarterlyGoal) return { text: quarterlyGoal, quoteOnly: false };

  const story = storyExcerpt(ctx.visionStory ?? '');
  if (story) return { text: story, quoteOnly: true };
  return undefined;
}

function pickAnti(ctx: MessageContext): GoalPick | undefined {
  const items = usable(ctx.antiVision);
  const item = items[0];
  if (item) return { text: item, quoteOnly: false };
  const story = storyExcerpt(ctx.antiVisionStory ?? '');
  if (story) return { text: story, quoteOnly: true };
  return undefined;
}

export function generateAffirmation(ctx: MessageContext): string {
  const goal = pickGoal(ctx);
  if (!goal) return pick(FALLBACK_AFFIRMATIONS) ?? FALLBACK_AFFIRMATIONS[0];
  return (
    pick(affirmationVariants(goal.text, { quoteOnly: goal.quoteOnly })) ?? FALLBACK_AFFIRMATIONS[0]
  );
}

export function generateAccountability(ctx: MessageContext): string {
  const bad = pickAnti(ctx);
  const vision = usable(ctx.vision);
  const daily = usable(ctx.dailyMissions);
  const quarterly = usable(ctx.quarterlyMissions);
  const listedGoal = vision[0] ?? daily[0] ?? quarterly[0];
  const story = storyExcerpt(ctx.visionStory ?? '');
  const goalText = listedGoal ?? story;
  const goalQuoteOnly = !listedGoal && Boolean(story);

  return (
    pick(
      accountabilityVariants(bad?.text ?? '', goalText, {
        goalQuoteOnly,
        badQuoteOnly: bad?.quoteOnly === true,
      }),
    ) ?? FALLBACK_ACCOUNTABILITY[0]
  );
}

export function generateSideQuest(ctx: MessageContext): string {
  const pool: string[] = [];
  const push = (item: string, quoteOnly = false) => {
    pool.push(...sideQuestVariants(item, { quoteOnly }));
  };

  for (const mission of usable(ctx.dailyMissions).slice(0, 4)) push(mission);
  for (const goal of usable(ctx.vision).slice(0, 3)) push(goal);
  for (const mission of usable(ctx.quarterlyMissions).slice(0, 2)) push(mission);

  const story = storyExcerpt(ctx.visionStory ?? '');
  if (pool.length === 0 && story) push(story, true);

  const bad = pickAnti(ctx);
  if (bad) {
    const line = antiSideQuest(bad.text, bad.quoteOnly);
    if (line) pool.push(line);
  }

  if (pool.length === 0) {
    return pick(UNIVERSAL_SIDE_QUESTS) ?? UNIVERSAL_SIDE_QUESTS[0];
  }

  const universal = pick(UNIVERSAL_SIDE_QUESTS);
  if (universal) pool.push(universal);
  return pick(pool) ?? UNIVERSAL_SIDE_QUESTS[0];
}

export function generateTestMessage(
  vision: string[],
  antiVision: string[],
  extras?: Pick<MessageContext, 'dailyMissions' | 'quarterlyMissions' | 'visionStory' | 'antiVisionStory'>,
): string {
  return generateAffirmation({
    vision,
    antiVision,
    dailyMissions: extras?.dailyMissions,
    quarterlyMissions: extras?.quarterlyMissions,
    visionStory: extras?.visionStory,
    antiVisionStory: extras?.antiVisionStory,
  });
}

export function generateMessageByKind(
  kind: ChadMessageKind,
  vision: string[],
  antiVision: string[],
  extras?: Pick<MessageContext, 'dailyMissions' | 'quarterlyMissions' | 'visionStory' | 'antiVisionStory'>,
): string {
  const ctx: MessageContext = {
    vision,
    antiVision,
    dailyMissions: extras?.dailyMissions,
    quarterlyMissions: extras?.quarterlyMissions,
    visionStory: extras?.visionStory,
    antiVisionStory: extras?.antiVisionStory,
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
