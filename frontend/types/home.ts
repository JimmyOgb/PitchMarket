export type Team = {
  name: string;
  shortName: string;
  accent: string;
  logo?: string;
};

export type Match = {
  id: string;
  fixtureId?: string;
  kickoffTime?: string;
  competition: string;
  competitionId?: number;
  competitionLogo?: string;
  competitionCountry?: string;
  dateLabel: string;
  time: string;
  kickoffTimestamp?: number;
  minute?: number;
  venue: string;
  homeTeam: Team;
  awayTeam: Team;
  status: "Live" | "Today" | "Upcoming";
  score?: string;
};

export type MarketOption = {
  label: string;
  probability: number;
};

export type PredictionMarket = {
  id: string;
  category: string;
  question: string;
  closes: string;
  volume: string;
  options: MarketOption[];
};
