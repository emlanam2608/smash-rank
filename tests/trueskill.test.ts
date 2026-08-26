import { describe, expect, it } from "vitest";
import {
  DEFAULT_MU,
  DEFAULT_SIGMA,
  calculateDisplayRank,
  calculateMatchResult,
  calculateMovMultiplier,
  getMatchWinner,
} from "@/lib/trueskill";

const newPlayer = () => ({ mu: DEFAULT_MU, sigma: DEFAULT_SIGMA });

describe("TrueSkill ranking", () => {
  it("calculates a conservative display rank", () => {
    expect(calculateDisplayRank(25, 8.333)).toBe(0);
    expect(calculateDisplayRank(30, 5)).toBe(1500);
  });

  it("updates a singles match and raises the winning player's rating", () => {
    const result = calculateMatchResult("1v1", [newPlayer()], [newPlayer()], 21, 16);

    expect(result.winner).toBe("teamA");
    expect(result.teamA[0].mu).toBeGreaterThan(DEFAULT_MU);
    expect(result.teamB[0].mu).toBeLessThan(DEFAULT_MU);
    expect(result.teamA[0].sigma).toBeLessThan(DEFAULT_SIGMA);
  });

  it("updates both players on each doubles team", () => {
    const result = calculateMatchResult(
      "2v2",
      [newPlayer(), newPlayer()],
      [newPlayer(), newPlayer()],
      21,
      16,
    );

    for (const winner of result.teamA) expect(winner.mu).toBeGreaterThan(DEFAULT_MU);
    for (const loser of result.teamB) expect(loser.mu).toBeLessThan(DEFAULT_MU);
  });

  it("supports draws with an unchanged MoV multiplier", () => {
    const result = calculateMatchResult("1v1", [newPlayer()], [newPlayer()], 21, 21);

    expect(result.winner).toBe("draw");
    expect(result.movMultiplier).toBe(1);
    expect(getMatchWinner(21, 21)).toBe("draw");
  });

  it("scales rating movement by the score margin", () => {
    expect(calculateMovMultiplier(21, 20)).toBeCloseTo(0.7738, 3);
    expect(calculateMovMultiplier(21, 0)).toBe(1.25);
  });

  it("rejects teams with the wrong number of players", () => {
    expect(() => calculateMatchResult("1v1", [newPlayer(), newPlayer()], [newPlayer()], 21, 19)).toThrow(
      "1v1 requires exactly 1 player per team.",
    );
    expect(() => calculateMatchResult("2v2", [newPlayer()], [newPlayer(), newPlayer()], 21, 19)).toThrow(
      "2v2 requires exactly 2 players per team.",
    );
  });
});
