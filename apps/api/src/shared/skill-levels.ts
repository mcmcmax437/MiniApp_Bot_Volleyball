/**
 * Single source of truth for skill level values used in DTO validation,
 * Prisma enums, and the mini-app. The enum is mirrored as a string union
 * here so DTOs don't have to import from Prisma.
 */
export const SKILL_LEVELS = [
  'LEVEL_1',
  'LEVEL_2',
  'LEVEL_3',
  'LEVEL_4',
  'LEVEL_5',
  'LEVEL_6',
] as const;

export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  LEVEL_1: 'Beginner',
  LEVEL_2: 'Beginner (Amateur)',
  LEVEL_3: 'Intermediate',
  LEVEL_4: 'Advanced',
  LEVEL_5: 'Semi-Pro',
  LEVEL_6: 'Professional',
};

export const SKILL_LEVEL_DESCRIPTIONS: Record<SkillLevel, string> = {
  LEVEL_1: 'Knows the rules, but basic elements (receive, serve, pass) are inconsistent.',
  LEVEL_2: 'Overhand serve, positional defense, simple receive.',
  LEVEL_3: 'Consistent reception, confident attacks, first attempts at a group block.',
  LEVEL_4: 'Confident play with the setter, first-tempo attacks, powerful & tactical serves.',
  LEVEL_5: 'Deep tactical understanding, powerful serves / gliders, well-rehearsed combinations.',
  LEVEL_6: 'Former pro athletes, MS / CMS holders, excellent technique, lightning-fast teamwork.',
};

/** Group levels into 3 buckets for the mini-app's quick-filter chips. */
export const SKILL_BUCKETS = {
  BEGINNER: ['LEVEL_1', 'LEVEL_2'] as SkillLevel[],
  INTERMEDIATE: ['LEVEL_3'] as SkillLevel[],
  ADVANCED: ['LEVEL_4', 'LEVEL_5', 'LEVEL_6'] as SkillLevel[],
};