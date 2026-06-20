/** Display names for the 48 finalists, keyed by FIFA code. Falls back to the
 *  code itself for anything unmapped. */
export const COUNTRY_NAMES: Record<string, string> = {
  MEX: "Mexico", RSA: "South Africa", KOR: "South Korea", CZE: "Czechia",
  CAN: "Canada", BIH: "Bosnia", QAT: "Qatar", SUI: "Switzerland",
  BRA: "Brazil", HAI: "Haiti", MAR: "Morocco", SCO: "Scotland",
  AUS: "Australia", PAR: "Paraguay", TUR: "Turkey", USA: "USA",
  CIV: "Ivory Coast", CUW: "Curaçao", ECU: "Ecuador", GER: "Germany",
  JPN: "Japan", NED: "Netherlands", SWE: "Sweden", TUN: "Tunisia",
  BEL: "Belgium", EGY: "Egypt", IRN: "Iran", NZL: "New Zealand",
  CPV: "Cape Verde", ESP: "Spain", KSA: "Saudi Arabia", URY: "Uruguay",
  FRA: "France", IRQ: "Iraq", NOR: "Norway", SEN: "Senegal",
  ALG: "Algeria", ARG: "Argentina", AUT: "Austria", JOR: "Jordan",
  COD: "Congo DR", COL: "Colombia", POR: "Portugal", UZB: "Uzbekistan",
  CRO: "Croatia", ENG: "England", GHA: "Ghana", PAN: "Panama",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}
