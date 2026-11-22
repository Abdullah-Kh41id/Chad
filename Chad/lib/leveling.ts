/**
 * Level curve
 * -----------
 * Level 1 starts at 0 XP.
 * XP required to advance from level L to L+1:
 *
 *   xpToAdvance(L) = round(100 * L^1.5)
 *
 * Examples:
 *   L1 → L2: round(100 * 1^1.5) = 100
 *   L2 → L3: round(100 * 2^1.5) = 283
 *   L3 → L4: round(100 * 3^1.5) = 520
 *   L4 → L5: round(100 * 4^1.5) = 800
 *   L5 → L6: round(100 * 5^1.5) = 1118
 *
 * Total XP to reach level N is the sum of xpToAdvance(1) .. xpToAdvance(N-1).
 * The home bar fills with xp earned inside the current level / xpToAdvance(level).
 * Reaching the exact threshold starts the next level at 0 progress.
 */

export type LevelProgress = {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  /** 0–1 fill of the current level. */
  progress: number;
  totalXp: number;
};

export function xpToAdvance(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.round(100 * Math.pow(safeLevel, 1.5));
}

export function levelProgress(totalXp: number): LevelProgress {
  const xp = Number.isFinite(totalXp) && totalXp > 0 ? Math.floor(totalXp) : 0;
  let level = 1;
  let spent = 0;

  while (level < 500) {
    const need = xpToAdvance(level);
    if (spent + need > xp) {
      const into = xp - spent;
      return {
        level,
        xpIntoLevel: into,
        xpForNext: need,
        progress: need === 0 ? 0 : into / need,
        totalXp: xp,
      };
    }
    spent += need;
    level += 1;
  }

  const need = xpToAdvance(level);
  return {
    level,
    xpIntoLevel: need,
    xpForNext: need,
    progress: 1,
    totalXp: xp,
  };
}
