import { describe, expect, it } from "vitest";
import { userFromSnapshot } from "@/lib/matches";

describe("userFromSnapshot", () => {
  it("uses safe defaults for incomplete user documents", () => {
    expect(userFromSnapshot("player-1", {})).toMatchObject({
      id: "player-1",
      displayName: "Player",
      photoURL: "",
      mu: 25,
      sigma: 8.333,
      displayRank: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
    });
  });

  it("preserves valid leaderboard statistics", () => {
    expect(
      userFromSnapshot("player-2", {
        displayName: "Mai",
        photoURL: "https://example.com/mai.jpg",
        mu: 31.5,
        sigma: 4.5,
        displayRank: 1800,
        matchesPlayed: 8,
        wins: 6,
        losses: 2,
      }),
    ).toEqual({
      id: "player-2",
      displayName: "Mai",
      photoURL: "https://example.com/mai.jpg",
      mu: 31.5,
      sigma: 4.5,
      displayRank: 1800,
      matchesPlayed: 8,
      wins: 6,
      losses: 2,
    });
  });
});
