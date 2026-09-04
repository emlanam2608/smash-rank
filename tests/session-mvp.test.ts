import { describe, expect, it } from "vitest";
import { getSessionMvp } from "@/lib/session-mvp";
import type { Match } from "@/lib/types";

const match = (id: string, winner: Match["winner"], scoreA: number, scoreB: number, aGain: number, bGain: number): Match => ({
  id, createdAt: null, matchType: "1v1", scoreA, scoreB, winner, movMultiplier: 1,
  teamA: [{ userId: "a", displayName: "An", preRank: 100, postRank: 100 + aGain }],
  teamB: [{ userId: "b", displayName: "Binh", preRank: 100, postRank: 100 + bGain }],
});

describe("getSessionMvp", () => {
  it("requires meaningful participation before selecting an MVP", () => {
    const matches = [
      match("1", "teamA", 21, 19, 10, -10),
      match("2", "teamB", 19, 21, -8, 8),
      { ...match("3", "teamA", 21, 10, 30, -30), teamA: [{ userId: "c", displayName: "Chi", preRank: 100, postRank: 130 }] },
    ];
    expect(getSessionMvp(matches)).not.toBe("Chi");
  });

  it("prioritizes win rate, then rating gain and participation", () => {
    expect(getSessionMvp([match("1", "teamA", 21, 12, 15, -15), match("2", "teamA", 21, 18, 12, -12)])).toBe("An");
  });
});
