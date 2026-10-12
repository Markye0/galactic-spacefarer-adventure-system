import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildWelcomeEmail } from '../srv/lib/welcome-email.js'

describe('buildWelcomeEmail', () => {
  const mail = buildWelcomeEmail({
    name: 'Ada Starling',
    email: 'ada.starling@spacefarers.example',
    stardustCollection: 350,
    wormholeNavigationSkill: 4,
    starterStardust: 100,
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

  describe('when the starter pack was limited by the maximum collection', () => {
    const full = {
      name: 'Ada Starling',
      email: 'ada.starling@spacefarers.example',
      stardustCollection: 1_000_000_000,
      wormholeNavigationSkill: 4,
    }

    it('states the size of the pack that was granted', () => {
      const { text } = buildWelcomeEmail({ ...full, starterStardust: 50 })
      assert.match(text, /^ {2}- Stardust collection: 1000000000 units \(including a 50-unit starter pack\)$/m)
    })

    it('does not mention a starter pack when none was granted', () => {
      const { text } = buildWelcomeEmail({ ...full, starterStardust: 0 })
      assert.match(text, /^ {2}- Stardust collection: 1000000000 units$/m)
      assert.doesNotMatch(text, /starter pack/)
    })
  })
})
