import { TrueSkill, Rating } from 'ts-trueskill';
import { TrueSkillRating, MatchResult } from './types';

const ts = new TrueSkill();

export const DEFAULT_MU = 25.0;
export const DEFAULT_SIGMA = 8.333;

export function createRating(mu: number = DEFAULT_MU, sigma: number = DEFAULT_SIGMA): Rating {
  return ts.createRating(mu, sigma);
}

export function calculateDisplayRank(mu: number, sigma: number): number {
  return Math.round((mu - 3 * sigma) * 100);
}

export function calculateMatchResult(
  teamARatings: { mu: number; sigma: number }[],
  teamBRatings: { mu: number; sigma: number }[],
  scoreA: number,
  scoreB: number
): MatchResult {
  const teamAList: Rating[] = teamARatings.map((r) => ts.createRating(r.mu, r.sigma));
  const teamBList: Rating[] = teamBRatings.map((r) => ts.createRating(r.mu, r.sigma));

  let newTeamA: Rating[];
  let newTeamB: Rating[];

  if (scoreA > scoreB) {
    [newTeamA, newTeamB] = ts.rate([teamAList, teamBList], [0, 1]);
  } else if (scoreB > scoreA) {
    [newTeamA, newTeamB] = ts.rate([teamAList, teamBList], [1, 0]);
  } else {
    // Draw
    [newTeamA, newTeamB] = ts.rate([teamAList, teamBList], [0, 0]);
  }

  return {
    teamA: newTeamA.map((r) => ({ mu: r.mu, sigma: r.sigma })),
    teamB: newTeamB.map((r) => ({ mu: r.mu, sigma: r.sigma })),
  };
}
