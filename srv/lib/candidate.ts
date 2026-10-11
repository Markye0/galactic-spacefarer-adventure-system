export const STARTER_STARDUST = 100
export const TALENT_THRESHOLD = 1000
// Leaves room for the starter pack within the 32-bit integer the collection is stored as
export const MAX_STARDUST = 1_000_000_000
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
  if (stardustCollection !== undefined && !isWholeNumberBetween(stardustCollection, 0, MAX_STARDUST)) {
    errors.push({
      target: 'stardustCollection',
      message: `Stardust collection must be a whole number between 0 and ${MAX_STARDUST.toLocaleString('en-US')}.`,
    })
  }
  if (wormholeNavigationSkill !== undefined && !isWholeNumberBetween(wormholeNavigationSkill, MIN_SKILL, MAX_SKILL)) {
    errors.push({
      target: 'wormholeNavigationSkill',
      message: `Wormhole navigation skill must be a whole number between ${MIN_SKILL} and ${MAX_SKILL}.`,
    })
  }
  return errors
}

function isWholeNumberBetween(value: number | null, min: number, max: number): boolean {
  return Number.isInteger(value) && value! >= min && value! <= max
}

/** A new candidate without stardust or skill starts at 0 units and the lowest skill level. */
export function applyDefaults(candidate: CandidateData): void {
  candidate.stardustCollection ??= 0
  candidate.wormholeNavigationSkill ??= MIN_SKILL
}

export interface Bonuses {
  starterStardust: number
  skillRaised: boolean
}

/**
 * Prepares a valid new candidate for the journey: experienced collectors get a skill bonus,
 * and everyone receives the stardust starter pack. The skill bonus depends on the stardust
 * the candidate arrives with, so it is decided before the starter pack is added.
 */
export function enhanceCandidate(candidate: CandidateData): Bonuses {
  const stardust = candidate.stardustCollection ?? 0
  const skill = candidate.wormholeNavigationSkill ?? MIN_SKILL
  const raisedSkill = stardust >= TALENT_THRESHOLD ? Math.min(skill + 1, MAX_SKILL) : skill

  candidate.wormholeNavigationSkill = raisedSkill
  candidate.stardustCollection = stardust + STARTER_STARDUST
  return { starterStardust: STARTER_STARDUST, skillRaised: raisedSkill > skill }
}

export function describeBonuses({ starterStardust, skillRaised }: Bonuses): string {
  const starterPack = `A ${starterStardust}-unit stardust starter pack was added to the collection`
  return skillRaised ? `${starterPack}, and the wormhole navigation skill was raised by one level.` : `${starterPack}.`
}
