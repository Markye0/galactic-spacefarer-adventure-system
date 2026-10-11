export const STARTER_STARDUST = 100
export const TALENT_THRESHOLD = 1000
export const MIN_SKILL = 1
export const MAX_SKILL = 10

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface CandidateData {
  email?: string | null
  stardustCollection?: number | null
  wormholeNavigationSkill?: number | null
}

export interface ValidationError {
  target: keyof CandidateData
  message: string
}

/** Checks the fields that are present; `undefined` means the field was not provided. */
export function validateCandidate({ email, stardustCollection, wormholeNavigationSkill }: CandidateData): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof email === 'string' && !EMAIL.test(email)) {
    errors.push({ target: 'email', message: 'Enter a valid email address.' })
  }
  if (stardustCollection !== undefined && !(Number.isInteger(stardustCollection) && stardustCollection! >= 0)) {
    errors.push({ target: 'stardustCollection', message: 'Stardust collection must be 0 or more.' })
  }
  if (wormholeNavigationSkill !== undefined && !isSkillLevel(wormholeNavigationSkill)) {
    errors.push({
      target: 'wormholeNavigationSkill',
      message: `Wormhole navigation skill must be between ${MIN_SKILL} and ${MAX_SKILL}.`,
    })
  }
  return errors
}

function isSkillLevel(value: number | null): boolean {
  return Number.isInteger(value) && value! >= MIN_SKILL && value! <= MAX_SKILL
}

/** A new candidate without stardust or skill starts at 0 units and the lowest skill level. */
export function applyDefaults(candidate: CandidateData): void {
  candidate.stardustCollection ??= 0
  candidate.wormholeNavigationSkill ??= MIN_SKILL
}

/**
 * Prepares a valid new candidate for the journey: experienced collectors get a skill bonus,
 * and everyone receives the stardust starter pack. The skill bonus depends on the stardust
 * the candidate arrives with, so it is decided before the starter pack is added.
 */
export function enhanceCandidate(candidate: CandidateData): void {
  const stardust = candidate.stardustCollection ?? 0
  const skill = candidate.wormholeNavigationSkill ?? MIN_SKILL

  candidate.wormholeNavigationSkill = stardust >= TALENT_THRESHOLD ? Math.min(skill + 1, MAX_SKILL) : skill
  candidate.stardustCollection = stardust + STARTER_STARDUST
}
