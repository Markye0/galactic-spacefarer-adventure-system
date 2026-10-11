import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildWelcomeEmail } from '../srv/lib/welcome-email.js'

describe('buildWelcomeEmail', () => {
  const mail = buildWelcomeEmail({
    name: 'Ada Starling',
    email: 'ada.starling@spacefarers.example',
    stardustCollection: 350,
    wormholeNavigationSkill: 4,
  })

  it('addresses the new spacefarer', () => {
    assert.equal(mail.to, 'ada.starling@spacefarers.example')
    assert.equal(mail.subject, 'Welcome aboard, Ada Starling – your cosmic journey begins!')
  })

  it('congratulates them and lists their launch kit', () => {
    assert.equal(
      mail.text,
      [
        'Dear Ada Starling,',
        '',
        'Congratulations! You are now a galactic spacefarer, and your adventurous',
        'journey among the stars starts today.',
        '',
        'Your launch kit:',
        '  - Stardust collection: 350 units (including a 100-unit starter pack)',
        '  - Wormhole navigation skill: level 4 of 10',
        '',
        'Safe travels across the SAP galaxy!',
        '',
        'Galactic Spacefarer Adventure System',
      ].join('\n'),
    )
  })
})
