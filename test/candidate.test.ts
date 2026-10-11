import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyDefaults, enhanceCandidate, validateCandidate } from '../srv/lib/candidate.js'

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
      { target: 'stardustCollection', message: 'Stardust collection must be 0 or more.' },
    ])
  })

  it('accepts the wormhole navigation skill limits 1 and 10', () => {
    assert.deepEqual(validateCandidate({ wormholeNavigationSkill: 1 }), [])
    assert.deepEqual(validateCandidate({ wormholeNavigationSkill: 10 }), [])
  })

  for (const skill of [0, 11]) {
    it(`rejects wormhole navigation skill ${skill}`, () => {
      assert.deepEqual(validateCandidate({ wormholeNavigationSkill: skill }), [
        { target: 'wormholeNavigationSkill', message: 'Wormhole navigation skill must be between 1 and 10.' },
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

  it('reports which bonuses were granted', () => {
    assert.deepEqual(enhanceCandidate({ stardustCollection: 0, wormholeNavigationSkill: 1 }), { starterStardust: 100, skillRaised: false })
    assert.deepEqual(enhanceCandidate({ stardustCollection: 1000, wormholeNavigationSkill: 4 }), { starterStardust: 100, skillRaised: true })
    assert.deepEqual(enhanceCandidate({ stardustCollection: 1000, wormholeNavigationSkill: 10 }), { starterStardust: 100, skillRaised: false })
  })

  it('never raises the skill above 10', () => {
    assert.deepEqual(enhance(5000, 10), { stardustCollection: 5100, wormholeNavigationSkill: 10 })
  })
})
