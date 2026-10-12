import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import cds from '@sap/cds'
import { as, spacefarerDrafts } from './support.js'
import { mailer, type Mail } from '../srv/lib/mailer.js'

const test = cds.test(import.meta.dirname + '/..')
const { GET, POST, axios } = test

axios.defaults.validateStatus = () => true
axios.defaults.path = '/odata/v4/spacefarer'

const { create, update } = spacefarerDrafts(test)

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
  const send = mock.method(mailer, 'send', async () => {})
  const sentMails = () => send.mock.calls.map(call => call.arguments[0] as Mail)
  // The email is sent in the background once the transaction has committed
  const afterCommit = () => sleep(50)

  beforeEach(async () => {
    await test.data.reset()
    send.mock.resetCalls()
    send.mock.mockImplementation(async () => {})
  })

  describe('before CREATE: validation', () => {
    it('rejects negative stardust', async () => {
      const response = await create(candidate({ stardustCollection: -1 }), 'alice')
      assert.equal(response.status, 400)
      assert.deepEqual(
        errorsOf(response).map(({ target, message }) => ({ target, message })),
        [
          {
            target: 'stardustCollection',
            message: 'Stardust collection must be a whole number between 0 and 1,000,000,000.',
          },
        ],
      )
    })

    it('rejects a wormhole navigation skill above 10', async () => {
      const response = await create(candidate({ wormholeNavigationSkill: 11 }), 'alice')
      assert.equal(response.status, 400)
      assert.deepEqual(
        errorsOf(response).map(error => error.target),
        ['wormholeNavigationSkill'],
      )
    })

    it('rejects an invalid email address', async () => {
      const response = await create(candidate({ email: 'ada.starling' }), 'alice')
      assert.equal(response.status, 400)
      assert.deepEqual(
        errorsOf(response).map(error => error.target),
        ['email'],
      )
    })

    it('reports every invalid field at once', async () => {
      const invalid = candidate({ email: 'ada', stardustCollection: -5, wormholeNavigationSkill: 0 })
      const response = await create(invalid, 'alice')
      assert.equal(response.status, 400)
      assert.deepEqual(
        errorsOf(response)
          .map(error => error.target)
          .sort(),
        ['email', 'stardustCollection', 'wormholeNavigationSkill'],
      )
    })

    it('does not store an invalid candidate', async () => {
      await create(candidate({ stardustCollection: -1 }), 'alice')
      const count = await GET('/Spacefarers/$count', as('alice'))
      assert.equal(count.data, 80)
    })
  })

  describe('before CREATE: enhancement', () => {
    it('adds the starter pack to the stardust collection', async () => {
      const response = await create(candidate({ stardustCollection: 250, wormholeNavigationSkill: 4 }), 'alice')
      assert.equal(response.status, 201)
      assert.equal(response.data.stardustCollection, 350)
      assert.equal(response.data.wormholeNavigationSkill, 4)
    })

    it('raises the skill of an experienced collector', async () => {
      const response = await create(candidate({ stardustCollection: 1000, wormholeNavigationSkill: 4 }), 'alice')
      assert.equal(response.data.stardustCollection, 1100)
      assert.equal(response.data.wormholeNavigationSkill, 5)
    })

    it('starts a candidate without values at 100 stardust and skill 1', async () => {
      const response = await create(candidate(), 'alice')
      assert.equal(response.data.stardustCollection, 100)
      assert.equal(response.data.wormholeNavigationSkill, 1)
    })

    it('stores the enhanced values', async () => {
      const created = await create(candidate({ stardustCollection: 1000, wormholeNavigationSkill: 4 }), 'alice')
      const stored = await GET(`/Spacefarers(${created.data.ID})`, as('alice'))
      assert.equal(stored.data.stardustCollection, 1100)
      assert.equal(stored.data.wormholeNavigationSkill, 5)
    })
  })

  describe('before UPDATE', () => {
    it('rejects invalid values', async () => {
      const response = await update(EXISTING_SPACEFARER, { stardustCollection: -1 }, 'alice')
      assert.equal(response.status, 400)
      assert.deepEqual(
        errorsOf(response).map(error => error.target),
        ['stardustCollection'],
      )
    })

    it('rejects clearing the wormhole navigation skill', async () => {
      const response = await update(EXISTING_SPACEFARER, { wormholeNavigationSkill: null }, 'alice')
      assert.equal(response.status, 400)
    })

    it('stores valid values without granting the bonuses again', async () => {
      const response = await update(EXISTING_SPACEFARER, { stardustCollection: 2000 }, 'alice')
      assert.equal(response.status, 200)
      assert.equal(response.data.stardustCollection, 2000)
      assert.equal(response.data.wormholeNavigationSkill, 6)
    })

    it('leaves fields alone that are not part of the update', async () => {
      const response = await update(EXISTING_SPACEFARER, { spacesuitColor_code: 'AURORA_GREEN' }, 'alice')
      assert.equal(response.status, 200)
      assert.equal(response.data.stardustCollection, 560)
    })
  })

  describe('references to master data', () => {
    const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    const unknown = {
      originPlanet_code: 'ZZZ',
      spacesuitColor_code: 'BOGUS',
      department_ID: UNKNOWN_ID,
      position_ID: UNKNOWN_ID,
    }

    for (const [reference, value] of Object.entries(unknown)) {
      it(`rejects a new spacefarer with an unknown ${reference}`, async () => {
        const response = await create(candidate({ [reference]: value }), 'alice')
        assert.equal(response.status, 400)
      })

      it(`rejects changing ${reference} to an unknown value`, async () => {
        const response = await update(EXISTING_SPACEFARER, { [reference]: value }, 'alice')
        assert.equal(response.status, 400)

        const stored = await GET(`/Spacefarers(${EXISTING_SPACEFARER})`, as('alice'))
        assert.notEqual(stored.data[reference], value)
      })
    }

    it('still accepts a spacefarer without color, department and position', async () => {
      const response = await create(candidate(), 'alice')
      assert.equal(response.status, 201)
    })
  })

  describe('after CREATE: welcome email', () => {
    it('sends one email to the new spacefarer', async () => {
      await create(candidate({ stardustCollection: 250, wormholeNavigationSkill: 4 }), 'alice')
      await afterCommit()

      const mails = sentMails()
      assert.equal(mails.length, 1)
      assert.equal(mails[0].to, 'ada.starling@spacefarers.example')
      assert.equal(mails[0].subject, 'Welcome aboard, Ada Starling – your cosmic journey begins!')
    })

    it('mentions the enhanced values', async () => {
      await create(candidate({ stardustCollection: 1000, wormholeNavigationSkill: 4 }), 'alice')
      await afterCommit()

      const [mail] = sentMails()
      assert.match(mail.text, /Stardust collection: 1100 units/)
      assert.match(mail.text, /level 5 of 10/)
    })

    it('states the starter pack that was actually granted', async () => {
      await create(candidate({ stardustCollection: 999_999_950 }), 'alice')
      await afterCommit()

      assert.match(sentMails()[0].text, /1000000000 units \(including a 50-unit starter pack\)/)
    })

    it('sends nothing when the candidate is invalid', async () => {
      await create(candidate({ stardustCollection: -1 }), 'alice')
      await afterCommit()
      assert.equal(sentMails().length, 0)
    })

    it('sends nothing when the candidate is rejected for another planet', async () => {
      await create(candidate({ originPlanet_code: 'Y' }), 'xavier')
      await afterCommit()
      assert.equal(sentMails().length, 0)
    })

    it('sends nothing when a spacefarer is updated', async () => {
      await update(EXISTING_SPACEFARER, { stardustCollection: 2000 }, 'alice')
      await afterCommit()
      assert.equal(sentMails().length, 0)
    })

    it('sends nothing when the creation is rolled back with its changeset', async () => {
      // One atomic group: a valid creation followed by an update that fails
      const batch = await POST(
        '/$batch',
        {
          requests: [
            {
              id: 'create',
              atomicityGroup: 'launch',
              method: 'POST',
              url: 'Spacefarers',
              headers: { 'content-type': 'application/json' },
              body: { ...candidate({ originPlanet_code: 'X' }), IsActiveEntity: true },
            },
            {
              id: 'failing-update',
              atomicityGroup: 'launch',
              method: 'PATCH',
              url: `Spacefarers(ID=${EXISTING_SPACEFARER},IsActiveEntity=true)`,
              headers: { 'content-type': 'application/json' },
              body: { stardustCollection: -1 },
            },
          ],
        },
        as('alice'),
      )
      await afterCommit()

      assert.equal(batch.status, 200)
      const count = await GET('/Spacefarers/$count?$filter=IsActiveEntity eq true', as('alice'))
      assert.equal(count.data, 80)
      assert.equal(sentMails().length, 0)
    })

    it('does not make the user wait for the email', async () => {
      let delivered = () => {}
      send.mock.mockImplementation(() => new Promise<void>(resolve => (delivered = resolve)))

      const response = await create(candidate(), 'alice')

      assert.equal(response.status, 201)
      assert.equal(send.mock.callCount(), 1) // sending has started, but has not finished
      delivered()
    })

    it('still answers with success when sending the email throws right away', async () => {
      send.mock.mockImplementation(() => {
        throw new Error('mailer is misconfigured')
      })

      const response = await create(candidate(), 'alice')

      assert.equal(response.status, 201)
    })

    it('keeps the spacefarer when the email cannot be sent', async () => {
      send.mock.mockImplementation(async () => {
        throw new Error('SMTP server unreachable')
      })

      const response = await create(candidate(), 'alice')
      await afterCommit()

      assert.equal(response.status, 201)
      assert.equal(send.mock.callCount(), 1)
      const stored = await GET(`/Spacefarers(${response.data.ID})`, as('alice'))
      assert.equal(stored.status, 200)
    })
  })
})
