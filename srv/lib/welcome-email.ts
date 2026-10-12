import { MAX_SKILL } from './candidate.js'
import type { Mail } from './mailer.js'

export interface NewSpacefarer {
  name: string
  email: string
  stardustCollection: number
  wormholeNavigationSkill: number
  /** The starter pack that was added; less than the usual one if the collection was nearly full */
  starterStardust: number
}

export function buildWelcomeEmail({
  name,
  email,
  stardustCollection,
  wormholeNavigationSkill,
  starterStardust,
}: NewSpacefarer): Mail {
  const starterPack = starterStardust > 0 ? ` (including a ${starterStardust}-unit starter pack)` : ''

  return {
    to: email,
    subject: `Welcome aboard, ${name} – your cosmic journey begins!`,
    text: [
      `Dear ${name},`,
      '',
      'Congratulations! You are now a galactic spacefarer, and your adventurous',
      'journey among the stars starts today.',
      '',
      'Your launch kit:',
      `  - Stardust collection: ${stardustCollection} units${starterPack}`,
      `  - Wormhole navigation skill: level ${wormholeNavigationSkill} of ${MAX_SKILL}`,
      '',
      'Safe travels across the SAP galaxy!',
      '',
      'Galactic Spacefarer Adventure System',
    ].join('\n'),
  }
}
