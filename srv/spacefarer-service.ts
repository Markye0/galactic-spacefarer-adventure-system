import cds from '@sap/cds'
import { Spacefarer, Spacefarers } from '#cds-models/SpacefarerService'

export default class SpacefarerService extends cds.ApplicationService {
  init() {
    this.before(['CREATE', 'UPDATE'], Spacefarers, req => this.rejectForeignPlanet(req))
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
}
