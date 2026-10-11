import cds from '@sap/cds'
import { CurrentUser, Spacefarer, Spacefarers } from '#cds-models/SpacefarerService'
import { applyDefaults, describeBonuses, enhanceCandidate, validateCandidate } from './lib/candidate.js'
import { mailer } from './lib/mailer.js'
import { buildWelcomeEmail, type NewSpacefarer } from './lib/welcome-email.js'

const LOG = cds.log('spacefarers')

export default class SpacefarerService extends cds.ApplicationService {
  init() {
    this.before(['CREATE', 'UPDATE'], Spacefarers, req => this.rejectForeignPlanet(req))
    this.before('NEW', Spacefarers.drafts, req => this.prefillOriginPlanet(req))
    this.before('CREATE', Spacefarers, req => this.prepareCandidate(req))
    this.before('UPDATE', Spacefarers, req => this.validate(req))
    this.after('CREATE', Spacefarers, (_, req) => this.sendWelcomeEmail(req))
    this.on('READ', CurrentUser, req => this.describeCurrentUser(req))
    return super.init()
  }

  /**
   * The `where` conditions of @restrict filter existing records only. This closes the gap for
   * incoming data: nobody but a galactic admin may create a spacefarer on, or move one to,
   * a planet other than their own.
   */
  private rejectForeignPlanet(req: cds.Request<Spacefarer>) {
    if (req.user.is('GalacticAdmin')) return

    const planet = req.data.originPlanet_code ?? req.data.originPlanet?.code
    if (planet && planet !== req.user.attr.planet) {
      req.reject(403, 'You can only manage spacefarers of your own planet.')
    }
  }

  /** A new spacefarer starts on the planet of the user creating it; a galactic admin has none. */
  private prefillOriginPlanet(req: cds.Request<Spacefarer>) {
    const { planet } = req.user.attr
    if (planet) req.data.originPlanet_code ??= planet
  }

  private describeCurrentUser({ user }: cds.Request) {
    const isAdmin = user.is('GalacticAdmin')
    return {
      id: user.id,
      canManageSpacefarers: isAdmin || user.is('SpacefarerManager'),
      canChoosePlanet: isAdmin,
    }
  }

  /**
   * Validates a new candidate and, if valid, enhances their stardust collection and skill.
   * The saved values differ from the entered ones, so the user is told what was added.
   */
  private prepareCandidate(req: cds.Request<Spacefarer>) {
    applyDefaults(req.data)
    if (!this.validate(req)) return

    const bonuses = enhanceCandidate(req.data)
    req.info(describeBonuses(bonuses))
  }

  /** Records one error per invalid field, so the client receives all of them at once. */
  private validate(req: cds.Request<Spacefarer>): boolean {
    const errors = validateCandidate(req.data)
    for (const { target, message } of errors) req.error(400, message, target)
    return errors.length === 0
  }

  /**
   * Sends the email only after the transaction has committed, so nobody is congratulated on a
   * creation that was rolled back. A failed email is logged and does not affect the spacefarer.
   */
  private sendWelcomeEmail(req: cds.Request<Spacefarer>) {
    // req.data holds the candidate as stored, including the enhanced values
    const spacefarer = req.data as NewSpacefarer
    req.on('succeeded', async () => {
      try {
        await mailer.send(buildWelcomeEmail(spacefarer))
      } catch (error) {
        LOG.error(`Welcome email to ${spacefarer.email} could not be sent:`, error)
      }
    })
  }
}
