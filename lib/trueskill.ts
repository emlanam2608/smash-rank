import { TrueSkill, Rating } from "ts-trueskill";
import type { MatchResult, PlayerRatingInput } from "./types";

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

function toRatings(players: PlayerRatingInput[]): Rating[] {
  if (players.length !== 2) {
    throw new Error("TrueSkill doubles requires exactly two players per team.");
  }
  return players.map((player) => env.createRating(player.mu, player.sigma));
}

/**
 * Updates 2v2 doubles ratings. Lower TrueSkill rank number is the winning team.
 * Equal scores are rejected — SmashRank matches always have a winner.
 */
export function calculateMatchResult(
  teamAPlayers: PlayerRatingInput[],
  teamBPlayers: PlayerRatingInput[],
  scoreA: number,
  scoreB: number,
): MatchResult {
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
    throw new Error("Match scores must be numbers.");
  }
  if (scoreA === scoreB) {
    throw new Error("Matches cannot end in a tie.");
  }

  const teamAList = toRatings(teamAPlayers);
  const teamBList = toRatings(teamBPlayers);

  const ranks: [number, number] = scoreA > scoreB ? [0, 1] : [1, 0];
  const [newTeamA, newTeamB] = env.rate([teamAList, teamBList], ranks);

  return {
    teamA: newTeamA.map((rating: Rating) => ({
      mu: rating.mu,
      sigma: rating.sigma,
    })),
    teamB: newTeamB.map((rating: Rating) => ({
      mu: rating.mu,
      sigma: rating.sigma,
    })),
  };
}

export function getMatchWinner(
  scoreA: number,
  scoreB: number,
): "teamA" | "teamB" {
  if (scoreA === scoreB) {
    throw new Error("Matches cannot end in a tie.");
  }
  return scoreA > scoreB ? "teamA" : "teamB";
}
