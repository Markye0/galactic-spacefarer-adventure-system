import cds from '@sap/cds'
import { CurrentUser, Spacefarer, Spacefarers } from '#cds-models/SpacefarerService'
import { applyDefaults, describeBonuses, enhanceCandidate, validateCandidate } from './lib/candidate.js'
import { mailer } from './lib/mailer.js'
import { readOriginPlanet } from './lib/origin-planet.js'
import { buildWelcomeEmail, type NewSpacefarer } from './lib/welcome-email.js'

const LOG = cds.log('spacefarers')

/**
 * The planets a user is bound to. Mocked users carry a single value; XSUAA and IAS deliver
 * attributes as lists, also when there is only one value.
 */
function planetsOf(user: cds.User): string[] {
  const planet: string | string[] | undefined = user.attr.planet
  return planet === undefined ? [] : [...new Set([planet].flat())]
}

export default class SpacefarerService extends cds.ApplicationService {
  init() {
    this.before('READ', '*', req => this.authorizeNavigation(req))
    this.before('NEW', Spacefarers.drafts, req => this.prefillOriginPlanet(req))
    this.before('CREATE', Spacefarers, req => this.prepareCandidate(req))
    this.before('UPDATE', Spacefarers, req => this.checkUpdate(req))
    this.after('CREATE', Spacefarers, (_, req) => this.sendWelcomeEmail(req, req.data as NewSpacefarer))
    this.on('READ', CurrentUser, req => this.describeCurrentUser(req))
    return super.init()
  }

  /**
   * For a path such as Spacefarers(<ID>)/department, CAP authorizes only the entity the path
   * ends at. Master data is readable by everyone, so the record the path starts from has to
   * be checked here: it must be one the user is allowed to read. This runs for every read,
   * whatever entity the path ends at, so entities added later are covered as well.
   */
  private async authorizeNavigation(req: cds.Request) {
    const [start, ...navigation] = req.query.SELECT?.from?.ref ?? []
    if (navigation.length === 0) return

    // Reading through the service applies the restrictions of the current user
    const startingPoint = await this.run(SELECT.one.from({ ref: [start] }))
    if (!startingPoint) req.reject(404)
  }

  /**
   * The `where` conditions of @restrict filter existing records only. This closes the gap for
   * incoming data. Whenever a request carries an origin planet, in either of its two forms, it
   * has to name one, and nobody but a galactic admin may create a spacefarer on, or move one
   * to, a planet other than their own.
   */
  private checkOriginPlanet(req: cds.Request<Spacefarer>) {
    const origin = readOriginPlanet(req.data)
    if (!origin.given) return

    if ('problem' in origin) {
      const message = origin.problem === 'missing' ? 'An origin planet is required.' : 'The origin planet is given twice, with different values.'
      return req.reject(400, message, 'originPlanet_code')
    }

    // Continue with one form only, so nothing downstream can read the two differently
    delete req.data.originPlanet
    req.data.originPlanet_code = origin.planet

    if (!req.user.is('GalacticAdmin') && !planetsOf(req.user).includes(origin.planet)) {
      req.reject(403, 'You can only manage spacefarers of your own planet.')
    }
  }

  /** A new spacefarer starts on the planet of the user creating it, if the user has exactly one. */
  private prefillOriginPlanet(req: cds.Request<Spacefarer>) {
    const planets = planetsOf(req.user)
    if (planets.length === 1) req.data.originPlanet_code ??= planets[0]
  }

  private describeCurrentUser({ user }: cds.Request) {
    const isAdmin = user.is('GalacticAdmin')
    const planets = planetsOf(user)
    return {
      id: user.id,
      // A manager who is not bound to any planet has no spacefarers to manage
      canManageSpacefarers: isAdmin || (user.is('SpacefarerManager') && planets.length > 0),
      // With exactly one planet there is nothing to choose: it is prefilled and locked
      canChoosePlanet: isAdmin || (user.is('SpacefarerManager') && planets.length > 1),
    }
  }

  /**
   * Validates a new candidate and, if valid, enhances their stardust collection and skill.
   * The checks run one after the other in a single handler: separate `before` handlers for
   * the same event are not guaranteed to run in sequence.
   */
  private prepareCandidate(req: cds.Request<Spacefarer>) {
    this.checkOriginPlanet(req)
    applyDefaults(req.data)
    if (!this.validate(req)) return

    const granted = describeBonuses(enhanceCandidate(req.data))
    if (granted) req.info(granted)
  }

  private checkUpdate(req: cds.Request<Spacefarer>) {
    this.checkOriginPlanet(req)
    this.validate(req)
  }

  /** Records one error per invalid field, so the client receives all of them at once. */
  private validate(req: cds.Request<Spacefarer>): boolean {
    const errors = validateCandidate(req.data)
    for (const { target, message } of errors) req.error(400, message, target)
    return errors.length === 0
  }

  /**
   * Sends the email only after the transaction has committed, so nobody is congratulated on a
   * creation that was rolled back. Sending runs in the background: the user does not wait for
   * the mail server, and a failed email is logged without affecting the spacefarer.
   */
  private sendWelcomeEmail(req: cds.Request, spacefarer: NewSpacefarer) {
    req.on('succeeded', () => {
      // Started from a promise chain, so that not even a synchronous error reaches the request
      Promise.resolve()
        .then(() => mailer.send(buildWelcomeEmail(spacefarer)))
        .catch(error => LOG.error(`Welcome email to ${spacefarer.email} could not be sent:`, error))
    })
  }
}
