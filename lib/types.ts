export interface User {
  id: string;
  displayName: string;
  photoURL: string;
  mu: number;
  sigma: number;
  displayRank: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
}

export interface TeamMember {
  userId: string;
  displayName?: string;
  preRank: number;
  postRank: number;
}

export interface Match {
  id: string;
  createdAt: unknown;
  matchType: MatchType;
  teamA: TeamMember[];
  teamB: TeamMember[];
  scoreA: number;
  scoreB: number;
  winner: MatchWinner;
  movMultiplier: number;
  sessionId?: string;
}

export interface TrueSkillRating {
  mu: number;
  sigma: number;
}

export interface MatchResult {
  teamA: TrueSkillRating[];
  teamB: TrueSkillRating[];
  winner: MatchWinner;
  movMultiplier: number;
}

export type PlayerRatingInput = TrueSkillRating;
export type MatchType = "1v1" | "2v2";
export type MatchWinner = "teamA" | "teamB" | "draw";

export interface Session {
  id: string;
  hostId: string;
  title: string;
  code: string;
  createdAt: unknown;
  closedAt: unknown;
  status: "active" | "closed";
  playerIds: string[];
}
