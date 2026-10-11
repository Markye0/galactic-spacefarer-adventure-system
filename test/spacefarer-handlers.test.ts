import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import cds from '@sap/cds'
import { mailer, type Mail } from '../srv/lib/mailer.js'

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
  const send = mock.method(mailer, 'send', async () => {})
  const sentMails = () => send.mock.calls.map(call => call.arguments[0] as Mail)
  // The email goes out after the response, once the transaction has committed
  const afterCommit = () => sleep(50)

  beforeEach(async () => {
    await test.data.reset()
    send.mock.resetCalls()
    send.mock.mockImplementation(async () => {})
  })

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
      assert.equal(count.data, 80)
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

  describe('after CREATE: welcome email', () => {
    it('sends one email to the new spacefarer', async () => {
      await POST('/Spacefarers', candidate({ stardustCollection: 250, wormholeNavigationSkill: 4 }), as('alice'))
      await afterCommit()

      const mails = sentMails()
      assert.equal(mails.length, 1)
      assert.equal(mails[0].to, 'ada.starling@spacefarers.example')
      assert.equal(mails[0].subject, 'Welcome aboard, Ada Starling – your cosmic journey begins!')
    })

    it('mentions the enhanced values', async () => {
      await POST('/Spacefarers', candidate({ stardustCollection: 1000, wormholeNavigationSkill: 4 }), as('alice'))
      await afterCommit()

      const [mail] = sentMails()
      assert.match(mail.text, /Stardust collection: 1100 units/)
      assert.match(mail.text, /level 5 of 10/)
    })

    it('sends nothing when the candidate is invalid', async () => {
      await POST('/Spacefarers', candidate({ stardustCollection: -1 }), as('alice'))
      await afterCommit()
      assert.equal(sentMails().length, 0)
    })

    it('sends nothing when the candidate is rejected for another planet', async () => {
      await POST('/Spacefarers', candidate({ originPlanet_code: 'Y' }), as('xavier'))
      await afterCommit()
      assert.equal(sentMails().length, 0)
    })

    it('sends nothing when a spacefarer is updated', async () => {
      await PATCH(`/Spacefarers(${EXISTING_SPACEFARER})`, { stardustCollection: 2000 }, as('alice'))
      await afterCommit()
      assert.equal(sentMails().length, 0)
    })

    it('keeps the spacefarer when the email cannot be sent', async () => {
      send.mock.mockImplementation(async () => {
        throw new Error('SMTP server unreachable')
      })

      const response = await POST('/Spacefarers', candidate(), as('alice'))
      await afterCommit()

      assert.equal(response.status, 201)
      const stored = await GET(`/Spacefarers(${response.data.ID})`, as('alice'))
      assert.equal(stored.status, 200)
    })
  })
})
