import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import cds from '@sap/cds'

const test = cds.test(import.meta.dirname + '/..')
const { GET, POST, PATCH, axios } = test

axios.defaults.validateStatus = () => true
axios.defaults.path = '/odata/v4/spacefarer'

const as = (username: string) => ({ auth: { username, password: 'pass' } })

const EXISTING_SPACEFARER = 'a0000000-0000-4000-8000-000000000003' // Lyra Solis: 560 stardust, skill 6

const candidate = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ada Starling',
  email: 'ada.starling@spacefarers.example',
  originPlanet_code: 'X',
  ...overrides,
})

interface ODataError {
  target?: string
  message: string
  details?: ODataError[]
}
const errorsOf = (response: { data: { error: ODataError } }) => response.data.error.details ?? [response.data.error]

describe('spacefarer event handlers', () => {
  beforeEach(() => test.data.reset())

  describe('before CREATE: validation', () => {
    it('rejects negative stardust', async () => {
      const response = await POST('/Spacefarers', candidate({ stardustCollection: -1 }), as('alice'))
      assert.equal(response.status, 400)
      assert.deepEqual(errorsOf(response).map(({ target, message }) => ({ target, message })), [
        { target: 'stardustCollection', message: 'Stardust collection must be 0 or more.' },
      ])
    })

    it('rejects a wormhole navigation skill above 10', async () => {
      const response = await POST('/Spacefarers', candidate({ wormholeNavigationSkill: 11 }), as('alice'))
      assert.equal(response.status, 400)
      assert.deepEqual(errorsOf(response).map(error => error.target), ['wormholeNavigationSkill'])
    })

    it('rejects an invalid email address', async () => {
      const response = await POST('/Spacefarers', candidate({ email: 'ada.starling' }), as('alice'))
      assert.equal(response.status, 400)
      assert.deepEqual(errorsOf(response).map(error => error.target), ['email'])
    })

    it('reports every invalid field at once', async () => {
      const invalid = candidate({ email: 'ada', stardustCollection: -5, wormholeNavigationSkill: 0 })
      const response = await POST('/Spacefarers', invalid, as('alice'))
      assert.equal(response.status, 400)
      assert.deepEqual(errorsOf(response).map(error => error.target).sort(), ['email', 'stardustCollection', 'wormholeNavigationSkill'])
    })

    it('does not store an invalid candidate', async () => {
      await POST('/Spacefarers', candidate({ stardustCollection: -1 }), as('alice'))
      const count = await GET('/Spacefarers/$count', as('alice'))
      assert.equal(count.data, 12)
    })
  })

  describe('before CREATE: enhancement', () => {
    it('adds the starter pack to the stardust collection', async () => {
      const response = await POST('/Spacefarers', candidate({ stardustCollection: 250, wormholeNavigationSkill: 4 }), as('alice'))
      assert.equal(response.status, 201)
      assert.equal(response.data.stardustCollection, 350)
      assert.equal(response.data.wormholeNavigationSkill, 4)
    })

    it('raises the skill of an experienced collector', async () => {
      const response = await POST('/Spacefarers', candidate({ stardustCollection: 1000, wormholeNavigationSkill: 4 }), as('alice'))
      assert.equal(response.data.stardustCollection, 1100)
      assert.equal(response.data.wormholeNavigationSkill, 5)
    })

    it('starts a candidate without values at 100 stardust and skill 1', async () => {
      const response = await POST('/Spacefarers', candidate(), as('alice'))
      assert.equal(response.data.stardustCollection, 100)
      assert.equal(response.data.wormholeNavigationSkill, 1)
    })

    it('stores the enhanced values', async () => {
      const created = await POST('/Spacefarers', candidate({ stardustCollection: 1000, wormholeNavigationSkill: 4 }), as('alice'))
      const stored = await GET(`/Spacefarers(${created.data.ID})`, as('alice'))
      assert.equal(stored.data.stardustCollection, 1100)
      assert.equal(stored.data.wormholeNavigationSkill, 5)
    })
  })

  describe('before UPDATE', () => {
    it('rejects invalid values', async () => {
      const response = await PATCH(`/Spacefarers(${EXISTING_SPACEFARER})`, { stardustCollection: -1 }, as('alice'))
      assert.equal(response.status, 400)
      assert.deepEqual(errorsOf(response).map(error => error.target), ['stardustCollection'])
    })

    it('rejects clearing the wormhole navigation skill', async () => {
      const response = await PATCH(`/Spacefarers(${EXISTING_SPACEFARER})`, { wormholeNavigationSkill: null }, as('alice'))
      assert.equal(response.status, 400)
    })

    it('stores valid values without granting the bonuses again', async () => {
      const response = await PATCH(`/Spacefarers(${EXISTING_SPACEFARER})`, { stardustCollection: 2000 }, as('alice'))
      assert.equal(response.status, 200)
      assert.equal(response.data.stardustCollection, 2000)
      assert.equal(response.data.wormholeNavigationSkill, 6)
    })

    it('leaves fields alone that are not part of the update', async () => {
      const response = await PATCH(`/Spacefarers(${EXISTING_SPACEFARER})`, { spacesuitColor_code: 'AURORA_GREEN' }, as('alice'))
      assert.equal(response.status, 200)
      assert.equal(response.data.stardustCollection, 560)
    })
  })
})
