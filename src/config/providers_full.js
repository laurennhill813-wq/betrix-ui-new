// Canonical provider registry (expanded)
export const PROVIDERS = {
  sportradar_soccer: {
    id: "sportradar_soccer",
    type: "data",
    sports: ["soccer"],
    baseUrl: "https://api.sportradar.com/soccer/trial/v4/en",
    auth: { kind: "query", keyEnv: "SPORTRADAR_KEY", param: "api_key" },
    products: ["competitions", "seasons", "matches", "teams"],
  },

  sportradar_images: {
    id: "sportradar_images",
    type: "media",
    sports: ["all"],
    baseUrl: "https://api.sportradar.com/images/v3/en",
    auth: { kind: "query", keyEnv: "SPORTRADAR_KEY", param: "api_key" },
    products: ["flags", "logos"],
  },

  // Generic Sportradar provider for non-soccer sports (NBA, NFL, MLB, NHL, Tennis, NASCAR)
  sportradar_general: {
    id: "sportradar_general",
    type: "data",
    sports: ["nba", "nfl", "mlb", "nhl", "tennis", "nascar", "motorsports"],
    baseUrl: "https://api.sportradar.com",
    auth: { kind: "query", keyEnv: "SPORTRADAR_KEY", param: "api_key" },
    products: ["competitions", "seasons", "matches", "teams", "participants"],
  },

  reuters: {
    id: "reuters",
    type: "media",
    sports: ["soccer", "f1", "tennis", "nba", "bundesliga", "la_liga"],
    baseUrl: "https://api.reuters.com/media/v1",
    auth: { kind: "query", keyEnv: "REUTERS_KEY", param: "api_key" },
    products: ["action_shots", "headshots"],
  },

  ap_content: {
    id: "ap_content",
    type: "media",
    sports: ["soccer", "nba", "nfl", "mlb", "tennis", "olympics"],
    baseUrl: "https://api.ap.org/media/v2",
    auth: { kind: "query", keyEnv: "AP_CONTENT_KEY", param: "api_key" },
    products: ["action_shots", "editorial"],
  },

  ap_images: {
    id: "ap_images",
    type: "media",
    sports: ["nfl", "ncaa_football", "mlb", "nba"],
    baseUrl: "https://api.ap.org/media/v2",
    auth: { kind: "query", keyEnv: "AP_IMAGES_KEY", param: "api_key" },
    products: ["logos", "headshots", "action_shots"],
  },

  getty: {
    id: "getty",
    type: "media",
    sports: ["soccer", "nba", "nhl", "rugby", "tennis", "cricket"],
    baseUrl: "https://api.gettyimages.com/v3",
    auth: { kind: "header", keyEnv: "GETTY_KEY", headerName: "Api-Key" },
    products: ["action_shots", "headshots"],
  },

  imagn: {
    id: "imagn",
    type: "media",
    sports: [
      "nfl",
      "nba",
      "nhl",
      "mlb",
      "ncaa_football",
      "ncaa_basketball",
      "ufc",
    ],
    baseUrl: "https://api.imagn.com/v1",
    auth: { kind: "query", keyEnv: "IMAGN_KEY", param: "api_key" },
    products: ["action_shots", "headshots"],
  },

  college_pressbox_ncaaw: {
    id: "college_pressbox_ncaaw",
    type: "media",
    sports: ["ncaa_w_basketball"],
    baseUrl: "https://api.collegepressbox.com/v1",
    auth: {
      kind: "query",
      keyEnv: "COLLEGE_PRESSBOX_NCAAW_KEY",
      param: "api_key",
    },
    products: ["headshots"],
  },

  college_pressbox_ncaam: {
    id: "college_pressbox_ncaam",
    type: "media",
    sports: ["ncaa_m_basketball"],
    baseUrl: "https://api.collegepressbox.com/v1",
    auth: {
      kind: "query",
      keyEnv: "COLLEGE_PRESSBOX_NCAAM_KEY",
      param: "api_key",
    },
    products: ["headshots"],
  },

  college_pressbox_ncaaf: {
    id: "college_pressbox_ncaaf",
    type: "media",
    sports: ["ncaa_football"],
    baseUrl: "https://api.collegepressbox.com/v1",
    auth: {
      kind: "query",
      keyEnv: "COLLEGE_PRESSBOX_NCAAF_KEY",
      param: "api_key",
    },
    products: ["headshots"],
  },

  odds_prematch: {
    id: "odds_prematch",
    type: "odds",
    sports: ["soccer", "nba", "nfl", "tennis", "mlb"],
    baseUrl: "https://api.oddscomparison.com/v1",
    auth: { kind: "query", keyEnv: "ODDS_PREMATCH_KEY", param: "api_key" },
    products: ["prematch"],
  },

  odds_props: {
    id: "odds_props",
    type: "odds",
    sports: ["nba", "nfl", "mlb"],
    baseUrl: "https://api.oddscomparison.com/v1",
    auth: { kind: "query", keyEnv: "ODDS_PROPS_KEY", param: "api_key" },
    products: ["player_props"],
  },

  odds_futures: {
    id: "odds_futures",
    type: "odds",
    sports: ["soccer", "nba", "nfl", "mlb"],
    baseUrl: "https://api.oddscomparison.com/v1",
    auth: { kind: "query", keyEnv: "ODDS_FUTURES_KEY", param: "api_key" },
    products: ["futures"],
  },

  odds_regular: {
    id: "odds_regular",
    type: "odds",
    sports: ["soccer", "nba", "nfl", "mlb", "tennis"],
    baseUrl: "https://api.oddscomparison.com/v1",
    auth: { kind: "query", keyEnv: "ODDS_REGULAR_KEY", param: "api_key" },
    products: ["lines"],
  },

  nba_data: {
    id: "nba_data",
    type: "data",
    sports: ["nba"],
    baseUrl: "https://api.nba.com/v1",
    auth: { kind: "query", keyEnv: "NBA_API_KEY", param: "api_key" },
    products: ["games", "teams", "players", "standings"],
  },

  nhl_data: {
    id: "nhl_data",
    type: "data",
    sports: ["nhl"],
    baseUrl: "https://api.nhl.com/v1",
    auth: { kind: "query", keyEnv: "NHL_API_KEY", param: "api_key" },
    products: ["games", "teams", "players", "standings"],
  },

  nfl_data: {
    id: "nfl_data",
    type: "data",
    sports: ["nfl"],
    baseUrl: "https://api.nfl.com/v1",
    auth: { kind: "query", keyEnv: "NFL_API_KEY", param: "api_key" },
    products: ["games", "teams", "players", "standings"],
  },

  ncaamb_data: {
    id: "ncaamb_data",
    type: "data",
    sports: ["ncaa_m_basketball"],
    baseUrl: "https://api.ncaa.com/v1",
    auth: { kind: "query", keyEnv: "NCAAMB_API_KEY", param: "api_key" },
    products: ["games", "teams", "players"],
  },

  tennis_data: {
    id: "tennis_data",
    type: "data",
    sports: ["tennis"],
    baseUrl: "https://api.tennis.com/v1",
    auth: { kind: "query", keyEnv: "TENNIS_API_KEY", param: "api_key" },
    products: ["tournaments", "matches", "players", "rankings"],
  },
};

export default PROVIDERS;
