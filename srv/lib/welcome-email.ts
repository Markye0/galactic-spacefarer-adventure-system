import { MAX_SKILL, STARTER_STARDUST } from './candidate.js'
import type { Mail } from './mailer.js'

export interface NewSpacefarer {
  name: string
  email: string
  stardustCollection: number
  wormholeNavigationSkill: number
}

export function buildWelcomeEmail({ name, email, stardustCollection, wormholeNavigationSkill }: NewSpacefarer): Mail {
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
      `  - Stardust collection: ${stardustCollection} units (including a ${STARTER_STARDUST}-unit starter pack)`,
      `  - Wormhole navigation skill: level ${wormholeNavigationSkill} of ${MAX_SKILL}`,
      '',
      'Safe travels across the SAP galaxy!',
      '',
      'Galactic Spacefarer Adventure System',
    ].join('\n'),
  }
}
