import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import cds from '@sap/cds'
import { as, spacefarerDrafts } from './support.js'

// XSUAA and IAS deliver user attributes as lists, also when there is only one value
const users = cds.env.requires.auth.users as Record<string, unknown>
users.xander = { password: 'pass', roles: ['SpacefarerManager'], attr: { planet: ['X'] } }
users.xyla = { password: 'pass', roles: ['SpacefarerManager'], attr: { planet: ['X', 'Y'] } }

const test = cds.test(import.meta.dirname + '/..')
const { GET, axios } = test
const { newDraft, create, update } = spacefarerDrafts(test)

axios.defaults.validateStatus = () => true
axios.defaults.path = '/odata/v4/spacefarer'

const PLANET_X_SPACEFARER = 'a0000000-0000-4000-8000-000000000001'

const candidate = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ada Starling',
  email: 'ada.starling@spacefarers.example',
  ...overrides,
})

describe('planet attribute delivered as a list', () => {
  beforeEach(() => test.data.reset())

  describe('with one planet', () => {
    it('reads the spacefarers of that planet', async () => {
      const response = await GET('/Spacefarers/$count?$filter=IsActiveEntity eq true', as('xander'))
      assert.equal(response.data, 40)
    })

    it('prefills the planet of a new spacefarer', async () => {
      const draft = await newDraft(candidate(), 'xander')
      assert.equal(draft.data.originPlanet_code, 'X')
    })

    it('creates and updates spacefarers on that planet', async () => {
      assert.equal((await create(candidate(), 'xander')).status, 201)
      assert.equal((await update(PLANET_X_SPACEFARER, { spacesuitColor_code: 'COMET_WHITE' }, 'xander')).status, 200)
    })

    it('cannot create a spacefarer on another planet', async () => {
      const response = await create(candidate({ originPlanet_code: 'Y' }), 'xander')
      assert.equal(response.status, 403)
    })
  })

  describe('with several planets', () => {
    it('creates spacefarers on each of them', async () => {
      assert.equal((await create(candidate({ originPlanet_code: 'X' }), 'xyla')).status, 201)
      assert.equal((await create(candidate({ originPlanet_code: 'Y', email: 'ada.two@spacefarers.example' }), 'xyla')).status, 201)
    })

    it('lets the user choose the planet in the UI', async () => {
      const response = await GET('/CurrentUser', as('xyla'))
      assert.equal(response.data.canChoosePlanet, true)
    })

    it('leaves the planet of a new spacefarer open, as there is no single default', async () => {
      const draft = await newDraft(candidate(), 'xyla')
      assert.equal(draft.data.originPlanet_code, null)
    })
  })
})
