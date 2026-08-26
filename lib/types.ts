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
  createdAt: number;
  updatedAt: number;
}

export interface TeamMember {
  userId: string;
  displayName: string;
  preRank: number;
  postRank: number;
}

export interface Match {
  id: string;
  createdAt: number;
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
