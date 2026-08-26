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
  preRank: number;
  postRank: number;
}

export interface Match {
  id: string;
  createdAt: unknown;
  teamA: TeamMember[];
  teamB: TeamMember[];
  scoreA: number;
  scoreB: number;
  winner: 'teamA' | 'teamB';
}

export interface TrueSkillRating {
  mu: number;
  sigma: number;
}

export interface MatchResult {
  teamA: TrueSkillRating[];
  teamB: TrueSkillRating[];
}

export type PlayerRatingInput = TrueSkillRating;
