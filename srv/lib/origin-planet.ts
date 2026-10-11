/** The two forms in which a request can carry the origin planet of a spacefarer. */
export interface OriginPlanetInput {
  originPlanet_code?: string | null
  originPlanet?: { code?: string | null } | null
}

export type OriginPlanet =
  | { given: false }
  | { given: true; planet: string }
  | { given: true; problem: 'missing' | 'ambiguous' }

/**
 * Reads the origin planet from whichever form the request uses. A form that is present has to
 * name a planet, and two forms have to agree. Looking at presence rather than at the value is
 * what keeps `originPlanet: null` from slipping past as "no planet given".
 */
export function readOriginPlanet(data: OriginPlanetInput): OriginPlanet {
  const given: (string | null | undefined)[] = []
  if ('originPlanet_code' in data) given.push(data.originPlanet_code)
  if ('originPlanet' in data) given.push(data.originPlanet?.code)

  if (given.length === 0) return { given: false }
  if (given.some(planet => !planet)) return { given: true, problem: 'missing' }

  const [planet, ...others] = given as string[]
  return others.every(other => other === planet) ? { given: true, planet } : { given: true, problem: 'ambiguous' }
}
