import type { Match } from "@/types/home";

export const todaysMatches: Match[] = [
  {
    id: "arsenal-liverpool",
    competition: "Premier League",
    dateLabel: "Today",
    time: "18:30",
    venue: "Emirates Stadium",
    homeTeam: { name: "Arsenal", shortName: "ARS", accent: "#ef4444" },
    awayTeam: { name: "Liverpool", shortName: "LIV", accent: "#dc2626" },
    status: "Live",
    score: "1 — 1",
  },
  {
    id: "barcelona-atletico",
    competition: "La Liga",
    dateLabel: "Today",
    time: "20:00",
    venue: "Estadi Olímpic",
    homeTeam: { name: "Barcelona", shortName: "BAR", accent: "#2563eb" },
    awayTeam: { name: "Atlético", shortName: "ATM", accent: "#ef4444" },
    status: "Today",
  },
  {
    id: "inter-juventus",
    competition: "Serie A",
    dateLabel: "Today",
    time: "20:45",
    venue: "San Siro",
    homeTeam: { name: "Inter Milan", shortName: "INT", accent: "#3b82f6" },
    awayTeam: { name: "Juventus", shortName: "JUV", accent: "#d1d5db" },
    status: "Today",
  },
];
