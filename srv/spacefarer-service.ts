import cds from '@sap/cds'
import { Spacefarer, Spacefarers } from '#cds-models/SpacefarerService'
import { applyDefaults, enhanceCandidate, validateCandidate } from './lib/candidate.js'

export default class SpacefarerService extends cds.ApplicationService {
  init() {
    this.before(['CREATE', 'UPDATE'], Spacefarers, req => this.rejectForeignPlanet(req))
    this.before('CREATE', Spacefarers, req => this.prepareCandidate(req))
    this.before('UPDATE', Spacefarers, req => this.validate(req))
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

  /** Validates a new candidate and, if valid, enhances their stardust collection and skill. */
  private prepareCandidate(req: cds.Request<Spacefarer>) {
    applyDefaults(req.data)
    if (this.validate(req)) enhanceCandidate(req.data)
  }

  /** Records one error per invalid field, so the client receives all of them at once. */
  private validate(req: cds.Request<Spacefarer>): boolean {
    const errors = validateCandidate(req.data)
    for (const { target, message } of errors) req.error(400, message, target)
    return errors.length === 0
  }
}
