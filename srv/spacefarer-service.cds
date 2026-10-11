using { sap.galaxy.spacefarers as db } from '../db/schema';

service SpacefarerService @(requires: 'authenticated-user') {

  entity Spacefarers @(restrict: [
    { grant: 'READ', to: 'SpacefarerViewer',  where: (originPlanet.code = $user.planet) },
    { grant: '*',    to: 'SpacefarerManager', where: (originPlanet.code = $user.planet) },
    { grant: '*',    to: 'GalacticAdmin' }
  ]) as projection on db.Spacefarers {
    *,
    // Derived on read, so the status can never drift from the stardust collection
    case
      when stardustCollection >= 1000 then 'Master'
      when stardustCollection >= 500  then 'Collector'
      else 'Novice'
    end as stardustStatus : String(20),
    // UI criticality: 3 = positive, 5 = information, 0 = neutral
    case
      when stardustCollection >= 1000 then 3
      when stardustCollection >= 500  then 5
      else 0
    end as stardustStatusCriticality : Integer
  };

  annotate Spacefarers with @cds.search: { name, email } @odata.draft.enabled;

  // The backlinks to spacefarers are left out: $expand does not apply the planet restriction
  @readonly entity Departments     as projection on db.Departments excluding { spacefarers };
  @readonly entity Positions       as projection on db.Positions   excluding { spacefarers };
  @readonly entity Planets         as projection on db.Planets;
  @readonly entity SpacesuitColors as projection on db.SpacesuitColors;
}
