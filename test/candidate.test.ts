import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyDefaults, describeBonuses, enhanceCandidate, validateCandidate } from '../srv/lib/candidate.js'

describe('validateCandidate', () => {
  const targets = (data: Parameters<typeof validateCandidate>[0]) => validateCandidate(data).map(error => error.target)

  it('accepts a valid candidate', () => {
    assert.deepEqual(validateCandidate({ email: 'nova@spacefarers.example', stardustCollection: 0, wormholeNavigationSkill: 1 }), [])
  })

  it('ignores fields that are not provided', () => {
    assert.deepEqual(validateCandidate({}), [])
  })

  it('rejects negative stardust', () => {
    assert.deepEqual(validateCandidate({ stardustCollection: -1 }), [
      { target: 'stardustCollection', message: 'Stardust collection must be a whole number between 0 and 1,000,000,000.' },
    ])
  })

  it('accepts the stardust limits 0 and 1,000,000,000', () => {
    assert.deepEqual(validateCandidate({ stardustCollection: 0 }), [])
    assert.deepEqual(validateCandidate({ stardustCollection: 1_000_000_000 }), [])
  })

  it('rejects stardust above 1,000,000,000', () => {
    assert.deepEqual(targets({ stardustCollection: 1_000_000_001 }), ['stardustCollection'])
  })

  it('accepts the wormhole navigation skill limits 1 and 10', () => {
    assert.deepEqual(validateCandidate({ wormholeNavigationSkill: 1 }), [])
    assert.deepEqual(validateCandidate({ wormholeNavigationSkill: 10 }), [])
  })

  for (const skill of [0, 11]) {
    it(`rejects wormhole navigation skill ${skill}`, () => {
      assert.deepEqual(validateCandidate({ wormholeNavigationSkill: skill }), [
        { target: 'wormholeNavigationSkill', message: 'Wormhole navigation skill must be a whole number between 1 and 10.' },
      ])
    })
  }

  it('rejects fractional and empty numbers', () => {
    assert.deepEqual(targets({ stardustCollection: 1.5, wormholeNavigationSkill: 2.5 }), ['stardustCollection', 'wormholeNavigationSkill'])
    assert.deepEqual(targets({ stardustCollection: null, wormholeNavigationSkill: null }), ['stardustCollection', 'wormholeNavigationSkill'])
  })

  for (const email of ['nova', 'nova@', '@spacefarers.example', 'nova kepler@spacefarers.example', 'nova@spacefarers']) {
    it(`rejects the email address '${email}'`, () => {
      assert.deepEqual(validateCandidate({ email }), [{ target: 'email', message: 'Enter a valid email address.' }])
    })
  }

  it('reports every invalid field at once', () => {
    assert.deepEqual(targets({ email: 'nova', stardustCollection: -5, wormholeNavigationSkill: 42 }), [
      'email',
      'stardustCollection',
      'wormholeNavigationSkill',
    ])
  })
})

describe('applyDefaults', () => {
  it('starts candidates without values at 0 stardust and skill 1', () => {
    const candidate = { stardustCollection: null }
    applyDefaults(candidate)
    assert.deepEqual(candidate, { stardustCollection: 0, wormholeNavigationSkill: 1 })
  })

  it('keeps provided values', () => {
    const candidate = { stardustCollection: 7, wormholeNavigationSkill: 3 }
    applyDefaults(candidate)
    assert.deepEqual(candidate, { stardustCollection: 7, wormholeNavigationSkill: 3 })
  })
})

describe('enhanceCandidate', () => {
  const enhance = (stardustCollection: number, wormholeNavigationSkill: number) => {
    const candidate = { stardustCollection, wormholeNavigationSkill }
    enhanceCandidate(candidate)
    return candidate
  }

  it('adds the 100-unit starter pack', () => {
    assert.deepEqual(enhance(0, 1), { stardustCollection: 100, wormholeNavigationSkill: 1 })
    assert.deepEqual(enhance(250, 4), { stardustCollection: 350, wormholeNavigationSkill: 4 })
  })

  it('raises the skill of candidates arriving with 1000 units or more', () => {
    assert.deepEqual(enhance(1000, 4), { stardustCollection: 1100, wormholeNavigationSkill: 5 })
  })

  it('does not raise the skill below 1000 units', () => {
    assert.deepEqual(enhance(999, 4), { stardustCollection: 1099, wormholeNavigationSkill: 4 })
  })

  it('decides the skill bonus before adding the starter pack', () => {
    assert.deepEqual(enhance(950, 4), { stardustCollection: 1050, wormholeNavigationSkill: 4 })
  })

  it('never lifts the collection above the maximum a spacefarer may have', () => {
    const full = { stardustCollection: 1_000_000_000, wormholeNavigationSkill: 1 }
    assert.deepEqual(enhanceCandidate(full), { starterStardust: 0, skillRaised: true })
    assert.equal(full.stardustCollection, 1_000_000_000)

    const nearlyFull = { stardustCollection: 999_999_950, wormholeNavigationSkill: 10 }
    assert.deepEqual(enhanceCandidate(nearlyFull), { starterStardust: 50, skillRaised: false })
    assert.equal(nearlyFull.stardustCollection, 1_000_000_000)
  })

  it('leaves every enhanced candidate valid', () => {
    for (const stardustCollection of [0, 999, 1000, 999_999_950, 1_000_000_000]) {
      const candidate = { stardustCollection, wormholeNavigationSkill: 10 }
      enhanceCandidate(candidate)
      assert.deepEqual(validateCandidate(candidate), [], `invalid after enhancing ${stardustCollection}`)
    }
  })

  it('reports which bonuses were granted', () => {
    assert.deepEqual(enhanceCandidate({ stardustCollection: 0, wormholeNavigationSkill: 1 }), { starterStardust: 100, skillRaised: false })
    assert.deepEqual(enhanceCandidate({ stardustCollection: 1000, wormholeNavigationSkill: 4 }), { starterStardust: 100, skillRaised: true })
    assert.deepEqual(enhanceCandidate({ stardustCollection: 1000, wormholeNavigationSkill: 10 }), { starterStardust: 100, skillRaised: false })
  })

  it('never raises the skill above 10', () => {
    assert.deepEqual(enhance(5000, 10), { stardustCollection: 5100, wormholeNavigationSkill: 10 })
  })
})

describe('describeBonuses', () => {
  it('mentions the starter pack', () => {
    assert.equal(describeBonuses({ starterStardust: 100, skillRaised: false }), 'A 100-unit stardust starter pack was added to the collection.')
  })

  it('mentions the skill bonus as well', () => {
    assert.equal(
      describeBonuses({ starterStardust: 100, skillRaised: true }),
      'A 100-unit stardust starter pack was added to the collection, and the wormhole navigation skill was raised by one level.',
    )
  })

  it('mentions the size of a starter pack that was cut short by the maximum', () => {
    assert.equal(describeBonuses({ starterStardust: 50, skillRaised: false }), 'A 50-unit stardust starter pack was added to the collection.')
  })

  it('mentions only the skill bonus when the collection was already full', () => {
    assert.equal(describeBonuses({ starterStardust: 0, skillRaised: true }), 'The wormhole navigation skill was raised by one level.')
  })

  it('says nothing when no bonus was granted', () => {
    assert.equal(describeBonuses({ starterStardust: 0, skillRaised: false }), undefined)
  })
})
