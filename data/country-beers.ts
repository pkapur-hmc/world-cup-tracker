export type CountryBeer = {
  name: string;
  style: string;
  note?: string;
};

/**
 * Curated 3-6 iconic beers per WC 2026 country.
 * Selection rule: either (a) findable in US/CA bottle shops, OR
 * (b) culturally iconic enough that the country is recognized by it.
 *
 * Dry/restricted-alcohol countries (QAT, KSA, IRN) use the country's
 * actual non-alcoholic malt beverages - respectful and stampable.
 */
export const COUNTRY_BEERS: Record<string, CountryBeer[]> = {
  // ---- Group A ----
  MEX: [
    { name: "Modelo Especial", style: "Pilsner" },
    { name: "Corona Extra", style: "Pale Lager" },
    { name: "Pacifico Clara", style: "Pilsner" },
    { name: "Tecate", style: "Pale Lager" },
    { name: "Dos Equis", style: "Vienna Lager" },
    { name: "Victoria", style: "Vienna Lager" },
  ],
  RSA: [
    { name: "Castle Lager", style: "Lager" },
    { name: "Black Label", style: "Lager" },
    { name: "Hansa Pilsener", style: "Pilsner" },
    { name: "Windhoek", style: "Lager" },
  ],
  KOR: [
    { name: "Cass Fresh", style: "Pale Lager" },
    { name: "Hite", style: "Pale Lager" },
    { name: "Kloud", style: "Pilsner" },
    { name: "Terra", style: "Pale Lager" },
  ],
  CZE: [
    { name: "Pilsner Urquell", style: "Pilsner" },
    { name: "Budweiser Budvar", style: "Pale Lager" },
    { name: "Staropramen", style: "Pale Lager" },
    { name: "Krušovice", style: "Pilsner" },
  ],

  // ---- Group B ----
  CAN: [
    { name: "Molson Canadian", style: "Pale Lager" },
    { name: "Labatt Blue", style: "Pilsner" },
    { name: "Moosehead", style: "Lager" },
    { name: "Alexander Keith's IPA", style: "IPA" },
    { name: "Steam Whistle", style: "Pilsner" },
  ],
  BIH: [
    { name: "Sarajevsko", style: "Lager" },
    { name: "Nektar", style: "Lager" },
    { name: "Preminger", style: "Pilsner" },
    { name: "Tuzlanski Pilsner", style: "Pilsner" },
  ],
  QAT: [
    { name: "Barbican Malt", style: "Non-alcoholic malt", note: "alcohol-free" },
    { name: "Moussy", style: "Non-alcoholic malt", note: "alcohol-free" },
    { name: "Heineken 0.0", style: "Non-alcoholic lager", note: "Qatar 2022 stadium pour" },
  ],
  SUI: [
    { name: "Feldschlösschen", style: "Lager" },
    { name: "Calanda", style: "Lager" },
    { name: "Cardinal", style: "Pilsner" },
    { name: "Eichhof", style: "Lager" },
  ],

  // ---- Group C ----
  BRA: [
    { name: "Brahma", style: "Pale Lager" },
    { name: "Skol", style: "Pale Lager" },
    { name: "Antarctica", style: "Pilsner" },
    { name: "Bohemia", style: "Pilsner" },
    { name: "Itaipava", style: "Pale Lager" },
  ],
  HAI: [
    { name: "Prestige", style: "Pilsner", note: "the iconic Haitian beer" },
  ],
  MAR: [
    { name: "Casablanca", style: "Lager" },
    { name: "Flag Spéciale", style: "Lager" },
    { name: "Stork", style: "Pilsner" },
    { name: "Castel", style: "Lager" },
  ],
  SCO: [
    { name: "Tennent's", style: "Lager" },
    { name: "BrewDog Punk IPA", style: "IPA" },
    { name: "Belhaven Best", style: "Scottish Ale" },
    { name: "Innis & Gunn", style: "Scottish Ale" },
    { name: "Caledonian 80/-", style: "Scottish Ale" },
  ],

  // ---- Group D ----
  AUS: [
    { name: "Victoria Bitter", style: "Lager" },
    { name: "Foster's", style: "Lager" },
    { name: "XXXX Gold", style: "Lager" },
    { name: "Coopers Pale Ale", style: "Pale Ale" },
    { name: "Carlton Draught", style: "Lager" },
    { name: "James Squire 150 Lashes", style: "Pale Ale" },
  ],
  PAR: [
    { name: "Pilsen", style: "Pale Lager" },
    { name: "Brahma Chopp", style: "Pale Lager" },
    { name: "Bavaria", style: "Pilsner" },
  ],
  TUR: [
    { name: "Efes Pilsen", style: "Pilsner" },
    { name: "Bomonti", style: "Lager" },
    { name: "Tuborg Gold", style: "Pilsner", note: "brewed under license in Turkey" },
  ],
  USA: [
    { name: "Budweiser", style: "American Lager" },
    { name: "Coors Light", style: "Light Lager" },
    { name: "Miller Lite", style: "Light Lager" },
    { name: "Sam Adams Boston Lager", style: "Vienna Lager" },
    { name: "Sierra Nevada Pale Ale", style: "Pale Ale" },
    { name: "Pabst Blue Ribbon", style: "American Lager" },
  ],

  // ---- Group E ----
  CIV: [
    { name: "Ivoire", style: "Lager" },
    { name: "Bock Solibra", style: "Lager" },
    { name: "Tuborg", style: "Pilsner", note: "brewed by Solibra locally" },
  ],
  CUW: [
    { name: "Amstel Bright", style: "Pale Lager", note: "Curaçao's iconic local version" },
    { name: "Polar", style: "Pilsner", note: "regional Venezuelan staple" },
    { name: "Heineken", style: "Lager" },
  ],
  ECU: [
    { name: "Pilsener", style: "Pale Lager", note: "Cervecería Nacional flagship" },
    { name: "Club Premium", style: "Pilsner" },
    { name: "Brahma", style: "Pale Lager", note: "brewed in Ecuador" },
  ],
  GER: [
    { name: "Bitburger Pils", style: "Pilsner" },
    { name: "Beck's", style: "Pilsner" },
    { name: "Paulaner Hefeweizen", style: "Hefeweizen" },
    { name: "Erdinger Weissbier", style: "Hefeweizen" },
    { name: "Warsteiner", style: "Pilsner" },
    { name: "Krombacher", style: "Pilsner" },
  ],

  // ---- Group F ----
  JPN: [
    { name: "Asahi Super Dry", style: "Pale Lager" },
    { name: "Sapporo Premium", style: "Pale Lager" },
    { name: "Kirin Ichiban", style: "Pale Lager" },
    { name: "Yebisu", style: "Lager" },
    { name: "Suntory Premium Malt's", style: "Pilsner" },
  ],
  NED: [
    { name: "Heineken", style: "Pale Lager" },
    { name: "Amstel Light", style: "Light Lager" },
    { name: "Grolsch Premium Pilsner", style: "Pilsner" },
    { name: "Bavaria Premium", style: "Pilsner" },
    { name: "La Trappe Quadrupel", style: "Trappist" },
  ],
  SWE: [
    { name: "Carnegie Porter", style: "Baltic Porter" },
    { name: "Norrlands Guld", style: "Pale Lager" },
    { name: "Pripps Blå", style: "Pale Lager" },
    { name: "Mariestads", style: "Lager" },
  ],
  TUN: [
    { name: "Celtia", style: "Pale Lager", note: "the iconic Tunisian beer" },
    { name: "Berber", style: "Lager" },
  ],

  // ---- Group G ----
  BEL: [
    { name: "Stella Artois", style: "Pilsner" },
    { name: "Duvel", style: "Belgian Strong Ale" },
    { name: "Chimay Blue", style: "Trappist" },
    { name: "Leffe Blonde", style: "Belgian Pale Ale" },
    { name: "Hoegaarden", style: "Witbier" },
    { name: "Westmalle Tripel", style: "Trappist" },
  ],
  EGY: [
    { name: "Stella", style: "Pale Lager", note: "the Egyptian Stella - not the Belgian one" },
    { name: "Sakara Gold", style: "Pale Lager" },
    { name: "Luxor", style: "Lager" },
  ],
  IRN: [
    { name: "Delster", style: "Non-alcoholic malt", note: "alcohol-free" },
    { name: "Behnoush", style: "Non-alcoholic malt", note: "alcohol-free" },
    { name: "Istak", style: "Non-alcoholic malt", note: "alcohol-free" },
  ],
  NZL: [
    { name: "Steinlager", style: "Pilsner" },
    { name: "Speight's Gold Medal", style: "Pale Ale" },
    { name: "Tui", style: "East India Pale Ale" },
    { name: "Monteith's Original", style: "Amber Ale" },
    { name: "Macs Gold", style: "Lager" },
  ],

  // ---- Group H ----
  CPV: [
    { name: "Strela", style: "Lager", note: "the iconic Cape Verdean beer" },
  ],
  ESP: [
    { name: "Estrella Damm", style: "Lager" },
    { name: "Mahou Cinco Estrellas", style: "Lager" },
    { name: "Cruzcampo", style: "Pilsner" },
    { name: "San Miguel Especial", style: "Lager" },
    { name: "Alhambra Reserva 1925", style: "Lager" },
    { name: "Estrella Galicia", style: "Pilsner" },
  ],
  KSA: [
    { name: "Moussy", style: "Non-alcoholic malt", note: "alcohol-free" },
    { name: "Barbican Malt", style: "Non-alcoholic malt", note: "alcohol-free" },
    { name: "Birell", style: "Non-alcoholic malt", note: "alcohol-free" },
  ],
  URY: [
    { name: "Pilsen", style: "Pale Lager" },
    { name: "Patricia", style: "Pilsner" },
    { name: "Norteña", style: "Pale Lager" },
    { name: "Zillertal", style: "Lager" },
  ],

  // ---- Group I ----
  FRA: [
    { name: "Kronenbourg 1664", style: "Pale Lager" },
    { name: "1664 Blanc", style: "Witbier" },
    { name: "Pelforth Brune", style: "Brown Ale" },
    { name: "Adelscott", style: "Smoked Lager" },
  ],
  IRQ: [
    { name: "Diyana", style: "Pilsner", note: "Kurdish-region brand" },
    { name: "Ferida", style: "Lager" },
    { name: "Efes Pilsen", style: "Pilsner", note: "widely available imported" },
  ],
  NOR: [
    { name: "Mack Pilsner", style: "Pilsner" },
    { name: "Hansa Pilsner", style: "Pilsner" },
    { name: "Ringnes", style: "Pilsner" },
    { name: "Aass Bock", style: "Bock" },
    { name: "Nøgne Ø IPA", style: "IPA" },
  ],
  SEN: [
    { name: "Gazelle", style: "Lager", note: "the iconic Senegalese beer" },
    { name: "Flag", style: "Pilsner" },
    { name: "33 Export", style: "Lager" },
  ],

  // ---- Group J ----
  ALG: [
    { name: "Tango Pilsner", style: "Pilsner" },
    { name: "33 Export", style: "Lager" },
    { name: "Skol", style: "Pale Lager", note: "brewed in Algeria" },
  ],
  ARG: [
    { name: "Quilmes Cristal", style: "Pale Lager" },
    { name: "Patagonia Amber Lager", style: "Amber Lager" },
    { name: "Imperial", style: "Pilsner" },
    { name: "Brahma", style: "Pale Lager", note: "brewed in Argentina" },
    { name: "Andes Origen", style: "Pilsner" },
  ],
  AUT: [
    { name: "Stiegl Goldbräu", style: "Lager" },
    { name: "Gösser", style: "Pale Lager" },
    { name: "Edelweiss Hefetrüb", style: "Hefeweizen" },
    { name: "Ottakringer", style: "Vienna Lager" },
    { name: "Zipfer Urtyp", style: "Pilsner" },
  ],
  JOR: [
    { name: "Petra", style: "Pale Lager", note: "the local Jordanian beer" },
    { name: "Carakale", style: "Craft Ale" },
    { name: "Amstel", style: "Pale Lager", note: "brewed in Jordan under license" },
  ],

  // ---- Group K ----
  COD: [
    { name: "Primus", style: "Pale Lager", note: "the iconic Bralima beer" },
    { name: "Skol", style: "Pale Lager" },
    { name: "Ngok", style: "Lager" },
    { name: "Tembo", style: "Pilsner" },
  ],
  COL: [
    { name: "Águila", style: "Pale Lager" },
    { name: "Club Colombia Dorada", style: "Pilsner" },
    { name: "Poker", style: "Pale Lager" },
    { name: "Costeña", style: "Pilsner" },
    { name: "Bavaria Premium", style: "Lager" },
  ],
  POR: [
    { name: "Sagres", style: "Lager" },
    { name: "Super Bock", style: "Pilsner" },
    { name: "Cristal", style: "Pilsner" },
    { name: "Coral", style: "Lager" },
  ],
  UZB: [
    { name: "Sarbast", style: "Pale Lager", note: "the main Uzbek beer" },
    { name: "Pulsar", style: "Pilsner" },
    { name: "Qibray", style: "Lager" },
  ],

  // ---- Group L ----
  CRO: [
    { name: "Karlovačko", style: "Pale Lager" },
    { name: "Ožujsko", style: "Pale Lager" },
    { name: "Pan", style: "Pilsner" },
    { name: "Velebitsko", style: "Pilsner" },
    { name: "Tomislav", style: "Strong Dark Lager" },
  ],
  ENG: [
    { name: "London Pride", style: "Bitter" },
    { name: "Newcastle Brown Ale", style: "Brown Ale" },
    { name: "Hobgoblin", style: "Ruby Ale" },
    { name: "Boddingtons Pub Ale", style: "Pale Ale" },
    { name: "Carling", style: "Lager" },
    { name: "John Smith's Extra Smooth", style: "Bitter" },
  ],
  GHA: [
    { name: "Star", style: "Lager", note: "the iconic Ghanaian beer" },
    { name: "Club", style: "Pilsner" },
    { name: "Stone Lager", style: "Lager" },
    { name: "Castle Milk Stout", style: "Stout" },
  ],
  PAN: [
    { name: "Balboa", style: "Pilsner" },
    { name: "Atlas Golden Light", style: "Light Lager" },
    { name: "Soberana", style: "Pilsner" },
    { name: "Cerveza Panamá", style: "Lager" },
  ],
};
