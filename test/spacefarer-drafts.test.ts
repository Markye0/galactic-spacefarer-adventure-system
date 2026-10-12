import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import cds from '@sap/cds'
import { mailer } from '../srv/lib/mailer.js'
import { as, spacefarerDrafts } from './support.js'

const test = cds.test(import.meta.dirname + '/..')
const { GET, axios } = test
const { newDraft, editDraft, change, activate, discard, create, update } = spacefarerDrafts(test)

axios.defaults.validateStatus = () => true
axios.defaults.path = '/odata/v4/spacefarer'

const PLANET_X_SPACEFARER = 'a0000000-0000-4000-8000-000000000003' // Lyra Solis: 560 stardust, Comet White
const PLANET_Y_SPACEFARER = 'a0000000-0000-4000-8000-000000000007'

const candidate = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ada Starling',
  email: 'ada.starling@spacefarers.example',
  ...overrides,
})

const activeSpacefarer = (id: string) => GET(`/Spacefarers(ID=${id},IsActiveEntity=true)`, as('alice'))
const activeCount = async () => (await GET('/Spacefarers/$count?$filter=IsActiveEntity eq true', as('alice'))).data

// Messages for the user travel in the sap-messages response header
const messagesOf = (response: { headers: Record<string, string> }): string[] =>
  JSON.parse(response.headers['sap-messages'] ?? '[]').map((message: { message: string }) => message.message)

describe('spacefarer drafts', () => {
  const send = mock.method(mailer, 'send', async () => {})
  const afterCommit = () => sleep(50)

  beforeEach(async () => {
    await test.data.reset()
    send.mock.resetCalls()
  })

  describe('creating', () => {
    it('keeps a new spacefarer as a draft until it is saved', async () => {
      const draft = await newDraft(candidate(), 'xavier')
      await afterCommit()

      assert.equal(draft.status, 201)
      assert.equal(draft.data.IsActiveEntity, false)
      assert.equal(await activeCount(), 80)
      assert.equal(send.mock.callCount(), 0)
    })

    it('enhances the candidate and sends the welcome email once, on save', async () => {
      const draft = await newDraft(candidate({ stardustCollection: 250 }), 'xavier')
      const saved = await activate(draft.data.ID, 'xavier')
      await afterCommit()

      assert.equal(saved.status, 201)
      assert.equal(saved.data.IsActiveEntity, true)
      assert.equal(saved.data.stardustCollection, 350)
      assert.equal(send.mock.callCount(), 1)
    })

    it('tells the user about the starter pack', async () => {
      const saved = await create(candidate({ stardustCollection: 250 }), 'xavier')
      assert.deepEqual(messagesOf(saved), ['A 100-unit stardust starter pack was added to the collection.'])
    })

    it('tells the user about the skill bonus as well', async () => {
      const saved = await create(candidate({ stardustCollection: 1000, wormholeNavigationSkill: 4 }), 'xavier')
      assert.deepEqual(messagesOf(saved), [
        'A 100-unit stardust starter pack was added to the collection, and the wormhole navigation skill was raised by one level.',
      ])
    })

    it('reports no bonus when the spacefarer is rejected for another planet', async () => {
      const rejected = await create(candidate({ originPlanet_code: 'Y' }), 'xavier')
      assert.equal(rejected.status, 403)
      assert.deepEqual(messagesOf(rejected), [])
    })

    it('reports no bonus when the spacefarer refers to unknown master data', async () => {
      const rejected = await create(candidate({ department_ID: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }), 'xavier')
      assert.equal(rejected.status, 400)
      assert.deepEqual(messagesOf(rejected), [])
    })

    it('does not save an invalid draft', async () => {
      const draft = await newDraft(candidate({ stardustCollection: -1 }), 'xavier')
      const saved = await activate(draft.data.ID, 'xavier')

      assert.equal(saved.status, 400)
      assert.equal(await activeCount(), 80)
    })

    it('is denied to viewers', async () => {
      const draft = await newDraft(candidate(), 'xena')
      assert.equal(draft.status, 403)
    })
  })

  describe('origin planet of a new spacefarer', () => {
    it('is the planet of a planet-bound user', async () => {
      const draft = await newDraft(candidate(), 'xavier')
      assert.equal(draft.data.originPlanet_code, 'X')
    })

    it('is left open for the galactic admin, who has no planet', async () => {
      const draft = await newDraft(candidate(), 'alice')
      assert.equal(draft.data.originPlanet_code, null)
    })

    it('has to be chosen by the galactic admin before saving', async () => {
      const response = await create(candidate(), 'alice')
      assert.equal(response.status, 400)
    })

    it('can be any planet for the galactic admin', async () => {
      const response = await create(candidate({ originPlanet_code: 'Y' }), 'alice')
      assert.equal(response.status, 201)
      assert.equal(response.data.originPlanet_code, 'Y')
    })
  })

  describe('editing', () => {
    it('changes stardust collection and spacesuit color on save', async () => {
      const saved = await update(
        PLANET_X_SPACEFARER,
        { stardustCollection: 1200, spacesuitColor_code: 'AURORA_GREEN' },
        'xavier',
      )

      assert.equal(saved.status, 200)
      const { data } = await activeSpacefarer(PLANET_X_SPACEFARER)
      assert.equal(data.stardustCollection, 1200)
      assert.equal(data.spacesuitColor_code, 'AURORA_GREEN')
      assert.equal(data.stardustStatus, 'Master')
    })

    it('leaves the spacefarer untouched until the draft is saved', async () => {
      await editDraft(PLANET_X_SPACEFARER, 'xavier')
      await change(PLANET_X_SPACEFARER, { stardustCollection: 1200 }, 'xavier')

      const { data } = await activeSpacefarer(PLANET_X_SPACEFARER)
      assert.equal(data.stardustCollection, 560)
    })

    it('leaves the spacefarer untouched when the draft is discarded', async () => {
      await editDraft(PLANET_X_SPACEFARER, 'xavier')
      await change(PLANET_X_SPACEFARER, { stardustCollection: 1200 }, 'xavier')
      const discarded = await discard(PLANET_X_SPACEFARER, 'xavier')

      assert.equal(discarded.status, 204)
      const { data } = await activeSpacefarer(PLANET_X_SPACEFARER)
      assert.equal(data.stardustCollection, 560)
    })

    it('is still possible for a spacefarer created with the maximum stardust', async () => {
      const created = await create(candidate({ stardustCollection: 1_000_000_000 }), 'xavier')
      assert.equal(created.status, 201)

      const saved = await update(created.data.ID, { name: 'Ada Nova' }, 'xavier')
      assert.equal(saved.status, 200)
      assert.equal(saved.data.name, 'Ada Nova')
    })

    it('grants no bonus and shows no bonus message', async () => {
      const saved = await update(PLANET_X_SPACEFARER, { stardustCollection: 1200 }, 'xavier')
      assert.deepEqual(messagesOf(saved), [])
    })

    it('does not save invalid changes', async () => {
      const saved = await update(PLANET_X_SPACEFARER, { wormholeNavigationSkill: 11 }, 'xavier')

      assert.equal(saved.status, 400)
      const { data } = await activeSpacefarer(PLANET_X_SPACEFARER)
      assert.equal(data.wormholeNavigationSkill, 6)
    })

    it('is denied to viewers', async () => {
      const edited = await editDraft(PLANET_X_SPACEFARER, 'xena')
      assert.equal(edited.status, 403)
    })

    it('is denied to managers of another planet', async () => {
      const edited = await editDraft(PLANET_Y_SPACEFARER, 'xavier')
      assert.ok([403, 404].includes(edited.status), `unexpected status ${edited.status}`)
    })

    it('hides the draft of one user from another', async () => {
      await editDraft(PLANET_X_SPACEFARER, 'xavier')
      const response = await GET(`/Spacefarers(ID=${PLANET_X_SPACEFARER},IsActiveEntity=false)`, as('alice'))
      assert.equal(response.status, 404)
    })
  })
})
