/**
 * Dev sanity checks for Chad copy, the streak calendar, and the level curve.
 *
 * Run from Chad/:
 *   node scripts/runSanityCheck.cjs
 */
import { shiftDateKey } from '../lib/dates';
import { levelProgress, xpToAdvance } from '../lib/leveling';
import {
  accountabilityVariants,
  affirmationVariants,
  generateAccountability,
  generateAffirmation,
  generateMessageByKind,
  generateSideQuest,
  sideQuestVariants,
} from '../lib/messageGenerator';
import { applyActivity, applyAppOpen, emptyStreak } from '../lib/streakRules';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertNatural(message: string, label: string): void {
  const problems: string[] = [];
  if (!message.trim()) problems.push('empty');
  if (/\s{2,}/.test(message)) problems.push('double space');
  if (!/^[A-Z0-9]/.test(message)) problems.push('bad start');
  if (!/[.!?…]$/.test(message)) problems.push('bad ending');
  if (/\bYou will to\b/i.test(message)) problems.push('will to');
  if (/\bYou will (?:building|making|getting|running|having|doing|going|being|waking|scrolling)\b/i.test(message)) {
    problems.push('will gerund');
  }
  if (/\bYou will I\b/.test(message) || /\byou will i\b/i.test(message)) problems.push('will I');
  if (/\btoward to\b/i.test(message)) problems.push('toward to');
  if (/\bby to\b/i.test(message)) problems.push('by to');
  if (/\bby by\b/i.test(message)) problems.push('by by');
  if (/\b(?:undefined|NaN|null)\b/.test(message)) problems.push('nullish');
  if (/ \./.test(message) || / \!/.test(message)) problems.push('space before punct');
  if (/\.\./.test(message)) problems.push('double period');
  if (/""/.test(message)) problems.push('empty quotes');
  if (/Side quest:\s*[.!]/.test(message)) problems.push('empty quest');
  if (/Your goal:\s*[.!]/.test(message)) problems.push('empty goal');
  if (problems.length > 0) {
    throw new Error(`${label}: ${problems.join(', ')} :: ${message}`);
  }
}

const samples = [
  'wake up at 5',
  'Wake up at 5!',
  'WAKE UP AT 5',
  'to build a business',
  'To build a business.',
  'building a company',
  'Building a company',
  'I run every morning',
  'I will run every morning',
  "I'll run every morning",
  'I want to be rich',
  'I want a mansion',
  "I'm building a company",
  'I am going to launch the product',
  'going to the gym',
  "I'm going to the gym",
  'gonna ship the app',
  '100m net worth',
  'a calmer man',
  'the mansion',
  'be present with my family',
  'being consistent',
  '• drink water',
  '1. Call Mom',
  'my dream life',
  '',
  '   ',
  'to',
  'I',
  'something great',
  'get up',
  'getting stronger',
  'have peace at home',
  'having peace at home',
  '???',
  'scrolling all day',
  'I quit when it gets hard',
];

function mustInclude(variants: string[], needle: string, label: string): void {
  assert(
    variants.some((line) => line.includes(needle)),
    `${label} missing "${needle}" in:\n${variants.join('\n')}`,
  );
}

mustInclude(affirmationVariants('wake up at 5'), 'You will wake up at 5.', 'wake');
mustInclude(affirmationVariants('Wake up at 5!'), 'You will wake up at 5.', 'wake punct');
mustInclude(affirmationVariants('WAKE UP AT 5'), 'You will wake up at 5.', 'wake caps');
mustInclude(affirmationVariants('to build a business'), 'You will build a business.', 'infinitive');
mustInclude(affirmationVariants('building a company'), 'You are building a company.', 'gerund');
mustInclude(affirmationVariants('I run every morning'), 'You will run every morning.', 'leading I');
mustInclude(affirmationVariants("I'll call Mom"), 'You will call Mom.', 'contraction');
mustInclude(affirmationVariants('I want to be rich'), 'You will be rich.', 'want to');
mustInclude(affirmationVariants('I am going to launch the product'), 'You will launch the product.', 'going to verb');
mustInclude(affirmationVariants('getting stronger'), 'You are getting stronger.', 'getting');
mustInclude(affirmationVariants('being consistent'), 'You are being consistent.', 'being');
mustInclude(affirmationVariants('• drink water'), 'You will drink water.', 'bullet');
mustInclude(affirmationVariants('1. Call Mom'), 'You will call Mom.', 'numbered');
mustInclude(affirmationVariants('have peace at home'), 'You will have peace at home.', 'have');
mustInclude(affirmationVariants('THE MANSION'), '"The mansion"', 'noun caps');
mustInclude(affirmationVariants('I want a mansion'), '"I want a mansion"', 'noun with I');
mustInclude(affirmationVariants('100m net worth'), '"100m net worth"', 'noun number');
mustInclude(affirmationVariants('a calmer man'), '"A calmer man"', 'noun article');
mustInclude(affirmationVariants(''), 'You will become the man you wrote down.', 'empty');

for (const line of affirmationVariants('the mansion')) {
  assert(!/You will get\b/i.test(line), `noun was forced into get: ${line}`);
}
for (const line of affirmationVariants('to build a business')) {
  assert(!/You will to\b/i.test(line), `infinitive stayed broken: ${line}`);
}

mustInclude(
  accountabilityVariants('scrolling all day', 'build a business'),
  "You won't build a business by scrolling all day.",
  'accountability gerund',
);
mustInclude(
  accountabilityVariants('being lazy', 'wake up at 5'),
  "You won't wake up at 5 by being lazy.",
  'accountability being',
);
mustInclude(
  accountabilityVariants('I quit when it gets hard', 'to build a business'),
  "You won't build a business by choosing to quit when it gets hard.",
  'accountability leading I',
);
for (const line of accountabilityVariants('a quitter', 'the mansion')) {
  assert(line.includes('Drop'), `expected Drop wrapper: ${line}`);
  assert(line.includes('"A quitter"'), `expected quoted anti: ${line}`);
  assert(line.includes('"The mansion"'), `expected quoted goal: ${line}`);
  assert(!/by a quitter/i.test(line), `broken by-phrase: ${line}`);
}

mustInclude(sideQuestVariants('drink water'), 'Side quest: Drink water.', 'quest verb');
mustInclude(sideQuestVariants('to build a business'), 'Side quest: Build a business.', 'quest infinitive');
for (const line of sideQuestVariants('100m net worth')) {
  assert(line.includes('"'), `quest noun should be quoted: ${line}`);
}

for (const sample of samples) {
  for (const line of affirmationVariants(sample)) assertNatural(line, `affirm ${sample}`);
  for (const line of sideQuestVariants(sample)) assertNatural(line, `quest ${sample}`);
  for (const other of ['build a business', 'the mansion', 'scrolling all day', '']) {
    for (const line of accountabilityVariants(sample, other)) {
      assertNatural(line, `account ${sample} / ${other}`);
    }
  }
}

for (let i = 0; i < 25; i += 1) {
  const line = generateAffirmation({
    vision: ['the mansion'],
    antiVision: ['being lazy'],
    dailyMissions: ['drink water'],
  });
  assert(
    affirmationVariants('drink water').includes(line),
    `daily mission should lead the affirmation: ${line}`,
  );
  assertNatural(line, 'priority');
}

const awkward = {
  vision: ['I want a mansion', 'to build a business', 'THE MANSION', 'building a company'],
  antiVision: ['scrolling all day', 'I quit when it gets hard', 'a quitter', 'being lazy'],
  dailyMissions: ['• drink water', 'get up', 'to call Mom'],
  quarterlyMissions: ['100m net worth', 'having peace at home'],
  visionStory: 'I see a quiet house and a man who keeps his word. He trains before the day starts.',
  antiVisionStory: 'I am done being the guy who scrolls and calls it rest.',
};

for (let i = 0; i < 40; i += 1) {
  assertNatural(generateAffirmation(awkward), 'random affirm');
  assertNatural(generateAccountability(awkward), 'random account');
  assertNatural(generateSideQuest(awkward), 'random quest');
  assertNatural(generateMessageByKind('affirmation', [], [], { visionStory: awkward.visionStory }), 'story only');
  assertNatural(
    generateMessageByKind('accountability', [], ['???'], { visionStory: 'My life.' }),
    'punct only',
  );
}

assert(shiftDateKey('2026-03-01', -1) === '2026-02-28', 'March back one day');
assert(shiftDateKey('2024-03-01', -1) === '2024-02-29', 'leap day');
assert(shiftDateKey('2026-01-01', -1) === '2025-12-31', 'new year');

let streak = emptyStreak();
streak = applyActivity(streak, '2026-11-20');
assert(streak.count === 1 && streak.lastActiveDate === '2026-11-20', 'streak starts at 1');
streak = applyAppOpen(streak, '2026-11-21');
assert(streak.count === 1, 'open the next day keeps the streak');
streak = applyActivity(streak, '2026-11-21');
assert(streak.count === 2, 'activity the next day increments');
streak = applyActivity(streak, '2026-11-21');
assert(streak.count === 2, 'a second activity the same day does not increment');
streak = applyAppOpen(streak, '2026-11-23');
assert(streak.count === 0, 'a missed day resets to 0');
streak = applyActivity(streak, '2026-11-23');
assert(streak.count === 1, 'activity after a miss starts over at 1');

assert(xpToAdvance(1) === 100, 'level 1 cost');
assert(xpToAdvance(2) === 283, 'level 2 cost');
assert(xpToAdvance(3) === 520, 'level 3 cost');
assert(xpToAdvance(4) === 800, 'level 4 cost');
assert(xpToAdvance(5) === 1118, 'level 5 cost');

const start = levelProgress(0);
assert(start.level === 1 && start.xpIntoLevel === 0 && start.xpForNext === 100 && start.progress === 0, '0 xp');
const exact = levelProgress(100);
assert(exact.level === 2 && exact.xpIntoLevel === 0 && exact.xpForNext === 283, 'exact threshold');
const almost = levelProgress(99);
assert(almost.level === 1 && almost.xpIntoLevel === 99, 'inside level 1');
const level3 = levelProgress(100 + 283);
assert(level3.level === 3 && level3.xpIntoLevel === 0, 'level 3 boundary');

console.log('sanity checks passed');
