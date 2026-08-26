import { Rating, TrueSkill } from "ts-trueskill";
import type {
  MatchResult,
  MatchType,
  MatchWinner,
  PlayerRatingInput,
} from "./types";

const env = new TrueSkill();

export const DEFAULT_MU = 25.0;
export const DEFAULT_SIGMA = 8.333;
export const MIN_MATCH_SCORE = 0;
export const MAX_MATCH_SCORE = 30;

export function createRating(
  mu: number = DEFAULT_MU,
  sigma: number = DEFAULT_SIGMA,
): Rating {
  return env.createRating(mu, sigma);
}

export function calculateDisplayRank(mu: number, sigma: number): number {
  return Math.round((mu - 3 * sigma) * 100);
}

export function getMatchWinner(scoreA: number, scoreB: number): MatchWinner {
  if (scoreA === scoreB) return "draw";
  return scoreA > scoreB ? "teamA" : "teamB";
}

export function calculateMovMultiplier(scoreA: number, scoreB: number): number {
  if (scoreA === scoreB) return 1;
  const pointDiff = Math.abs(scoreA - scoreB);
  const maxScore = Math.max(scoreA, scoreB, 1);
  return 0.75 + 0.5 * (pointDiff / maxScore);
}

function expectedTeamSize(matchType: MatchType): number {
  return matchType === "1v1" ? 1 : 2;
}

function toRatings(
  matchType: MatchType,
  players: PlayerRatingInput[],
): Rating[] {
  const size = expectedTeamSize(matchType);
  if (players.length !== size) {
    throw new Error(
      `${matchType} requires exactly ${size} player${size === 1 ? "" : "s"} per team.`,
    );
  }
  return players.map((player) => env.createRating(player.mu, player.sigma));
}

/**
 * Calculates a 1v1 or 2v2 TrueSkill update and scales each player's mu change
 * by the margin of victory. Sigma remains the uncertainty returned by TrueSkill.
 */
export function calculateMatchResult(
  matchType: MatchType,
  teamAPlayers: PlayerRatingInput[],
  teamBPlayers: PlayerRatingInput[],
  scoreA: number,
  scoreB: number,
): MatchResult {
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
    throw new Error("Match scores must be numbers.");
  }

  const teamA = toRatings(matchType, teamAPlayers);
  const teamB = toRatings(matchType, teamBPlayers);
  const winner = getMatchWinner(scoreA, scoreB);
  const ranks: [number, number] =
    winner === "teamA" ? [0, 1] : winner === "teamB" ? [1, 0] : [0, 0];
  const [ratedTeamA, ratedTeamB] = env.rate([teamA, teamB], ranks);
  const movMultiplier = calculateMovMultiplier(scoreA, scoreB);

  const scaleRatings = (before: PlayerRatingInput[], after: Rating[]) =>
    after.map((rating, index) => ({
      mu: before[index].mu + (rating.mu - before[index].mu) * movMultiplier,
      sigma: rating.sigma,
    }));

  return {
    teamA: scaleRatings(teamAPlayers, ratedTeamA),
    teamB: scaleRatings(teamBPlayers, ratedTeamB),
    winner,
    movMultiplier,
  };
}
