import type { Match } from "./types";

type MvpStats = {
  id: string;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  ratingGain: number;
  pointDifference: number;
};

/** Selects a reliable session MVP from performance, rating gain, and participation. */
export function getSessionMvp(matches: Match[]): string | undefined {
  const players = new Map<string, MvpStats>();

  for (const match of matches) {
    const teams = [match.teamA, match.teamB] as const;
    teams.forEach((team, teamIndex) => {
      const won = match.winner === (teamIndex === 0 ? "teamA" : "teamB");
      const lost = match.winner === (teamIndex === 0 ? "teamB" : "teamA");
      const scoreDifference = teamIndex === 0 ? match.scoreA - match.scoreB : match.scoreB - match.scoreA;
      team.forEach((member) => {
        const current = players.get(member.userId) ?? { id: member.userId, name: member.displayName ?? member.userId, matches: 0, wins: 0, losses: 0, ratingGain: 0, pointDifference: 0 };
        current.matches += 1;
        current.wins += won ? 1 : 0;
        current.losses += lost ? 1 : 0;
        current.ratingGain += member.postRank - member.preRank;
        current.pointDifference += scoreDifference;
        players.set(member.userId, current);
      });
    });
  }

  const all = [...players.values()];
  if (!all.length) return undefined;
  const maxMatches = Math.max(...all.map((player) => player.matches));
  const eligible = all.filter((player) => player.matches >= Math.max(2, Math.ceil(maxMatches * 0.5)));
  const candidates = eligible.length ? eligible : all;
  const gains = candidates.map((player) => player.ratingGain / player.matches);
  const minGain = Math.min(...gains);
  const maxGain = Math.max(...gains);
  const normalizedGain = (player: MvpStats) => maxGain === minGain ? 0.5 : ((player.ratingGain / player.matches) - minGain) / (maxGain - minGain);
  const mvpScore = (player: MvpStats) => 0.55 * (player.wins / player.matches) + 0.3 * normalizedGain(player) + 0.15 * (player.matches / maxMatches);

  return candidates.sort((a, b) => mvpScore(b) - mvpScore(a) || b.wins - a.wins || b.pointDifference - a.pointDifference || a.losses - b.losses || a.name.localeCompare(b.name))[0]?.name;
}
