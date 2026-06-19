/**
 * "What beers do I still need for this country?" - the shared bit behind the
 * plan-ahead surfaces (match page "beers to try", passport "Up Next"). A beer
 * is needed if it's on the country's curated list and the user hasn't stamped
 * it yet (lifetime, across any match). Mirrors the stamp rule in scoring.ts.
 */
import { COUNTRY_BEERS, type CountryBeer } from "@/data/country-beers";

export type BeerNeeds = {
  total: number;
  done: number;
  needed: CountryBeer[];
};

export function beerNeedsFor(
  code: string,
  stamped: Set<string> | undefined,
): BeerNeeds {
  const list = COUNTRY_BEERS[code] ?? [];
  const have = stamped ?? new Set<string>();
  const needed = list.filter((b) => !have.has(b.name));
  return { total: list.length, done: list.length - needed.length, needed };
}
