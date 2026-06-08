/**
 * Flag emoji per football-data.org team TLA.
 * football-data uses its own 3-letter codes (e.g. "RSA" not ISO "ZAF",
 * "SUI" not "CHE"), so this map is keyed off their codes, not ISO 3166.
 * England and Scotland use Unicode tag sequences (subdivision flags).
 */
export const FLAG_EMOJI: Record<string, string> = {
  // Group A
  MEX: "🇲🇽",
  RSA: "🇿🇦",
  KOR: "🇰🇷",
  CZE: "🇨🇿",
  // Group B
  CAN: "🇨🇦",
  BIH: "🇧🇦",
  QAT: "🇶🇦",
  SUI: "🇨🇭",
  // Group C
  BRA: "🇧🇷",
  HAI: "🇭🇹",
  MAR: "🇲🇦",
  SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  // Group D
  AUS: "🇦🇺",
  PAR: "🇵🇾",
  TUR: "🇹🇷",
  USA: "🇺🇸",
  // Group E
  CIV: "🇨🇮",
  CUW: "🇨🇼",
  ECU: "🇪🇨",
  GER: "🇩🇪",
  // Group F
  JPN: "🇯🇵",
  NED: "🇳🇱",
  SWE: "🇸🇪",
  TUN: "🇹🇳",
  // Group G
  BEL: "🇧🇪",
  EGY: "🇪🇬",
  IRN: "🇮🇷",
  NZL: "🇳🇿",
  // Group H
  CPV: "🇨🇻",
  ESP: "🇪🇸",
  KSA: "🇸🇦",
  URY: "🇺🇾",
  // Group I
  FRA: "🇫🇷",
  IRQ: "🇮🇶",
  NOR: "🇳🇴",
  SEN: "🇸🇳",
  // Group J
  ALG: "🇩🇿",
  ARG: "🇦🇷",
  AUT: "🇦🇹",
  JOR: "🇯🇴",
  // Group K
  COD: "🇨🇩",
  COL: "🇨🇴",
  POR: "🇵🇹",
  UZB: "🇺🇿",
  // Group L
  CRO: "🇭🇷",
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  GHA: "🇬🇭",
  PAN: "🇵🇦",
};
