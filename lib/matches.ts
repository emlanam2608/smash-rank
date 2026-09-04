import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebase";
import {
  DEFAULT_MU,
  DEFAULT_SIGMA,
  calculateDisplayRank,
  calculateMatchResult,
  calculateMovMultiplier,
  getMatchWinner,
  isValidBadmintonScore,
} from "./trueskill";
import type { Match, MatchType, TeamMember, User } from "./types";

export const USERS_COLLECTION = "users";
export const MATCHES_COLLECTION = "matches";

function assertMatchScore(scoreA: number, scoreB: number) {
  if (!isValidBadmintonScore(scoreA, scoreB)) throw new Error("INVALID_SCORE_RANGE");
}

function expectedPlayersPerTeam(matchType: MatchType) {
  return matchType === "1v1" ? 1 : 2;
}

export async function ensureUserProfile(params: {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}): Promise<void> {
  if (!isFirebaseConfigured() || !db) return;

  const userRef = doc(db, USERS_COLLECTION, params.uid);
  const snapshot = await getDoc(userRef);
  const displayName = params.displayName?.trim() || "Player";
  const photoURL = params.photoURL || "";

  if (snapshot.exists()) {
    await updateDoc(userRef, {
      displayName: displayName || snapshot.data().displayName || "Player",
      photoURL: photoURL || snapshot.data().photoURL || "",
    });
    return;
  }

  const mu = DEFAULT_MU;
  const sigma = DEFAULT_SIGMA;
  await setDoc(userRef, {
    id: params.uid,
    displayName,
    photoURL,
    mu,
    sigma,
    displayRank: calculateDisplayRank(mu, sigma),
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
  });
}

function mapUser(id: string, data: Record<string, unknown>): User {
  const mu = typeof data.mu === "number" ? data.mu : DEFAULT_MU;
  const sigma = typeof data.sigma === "number" ? data.sigma : DEFAULT_SIGMA;
  return {
    id,
    displayName:
      typeof data.displayName === "string" ? data.displayName : "Player",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : "",
    mu,
    sigma,
    displayRank:
      typeof data.displayRank === "number"
        ? data.displayRank
        : calculateDisplayRank(mu, sigma),
    matchesPlayed:
      typeof data.matchesPlayed === "number" ? data.matchesPlayed : 0,
    wins: typeof data.wins === "number" ? data.wins : 0,
    losses: typeof data.losses === "number" ? data.losses : 0,
  };
}

export function userFromSnapshot(
  id: string,
  data: Record<string, unknown>,
): User {
  return mapUser(id, data);
}

export async function recordMatch(params: {
  firestore?: Firestore;
  matchType: MatchType;
  teamAIds: string[];
  teamBIds: string[];
  scoreA: number;
  scoreB: number;
  sessionId?: string;
}): Promise<string> {
  if (!isFirebaseConfigured() || !db || !auth) {
    throw new Error("FIREBASE_UNAVAILABLE");
  }
  if (!auth.currentUser) throw new Error("UNAUTHENTICATED");

  const { matchType, teamAIds, teamBIds, scoreA, scoreB } = params;
  const teamSize = expectedPlayersPerTeam(matchType);
  if (teamAIds.length !== teamSize || teamBIds.length !== teamSize) {
    throw new Error("INVALID_TEAM_SIZE");
  }
  assertMatchScore(scoreA, scoreB);

  const playerIds = [...teamAIds, ...teamBIds];
  if (new Set(playerIds).size !== playerIds.length || playerIds.some((id) => !id)) {
    throw new Error("DUPLICATE_PLAYERS");
  }

  const firestore = params.firestore ?? db;
  const userDocs = await Promise.all(
    playerIds.map((id) => getDoc(doc(firestore, USERS_COLLECTION, id))),
  );
  const users = userDocs.map((snapshot, index) => {
    if (!snapshot.exists()) throw new Error(`MISSING_PLAYER:${playerIds[index]}`);
    return mapUser(snapshot.id, snapshot.data() as Record<string, unknown>);
  });
  const teamAPlayers = users.slice(0, teamSize);
  const teamBPlayers = users.slice(teamSize);
  const result = calculateMatchResult(
    matchType,
    teamAPlayers,
    teamBPlayers,
    scoreA,
    scoreB,
  );

  const toMembers = (
    players: User[],
    ratings: { mu: number; sigma: number }[],
  ): TeamMember[] =>
    players.map((player, index) => ({
      userId: player.id,
      displayName: player.displayName,
      preRank: player.displayRank,
      postRank: calculateDisplayRank(ratings[index].mu, ratings[index].sigma),
    }));
  const teamA = toMembers(teamAPlayers, result.teamA);
  const teamB = toMembers(teamBPlayers, result.teamB);

  const batch = writeBatch(firestore);
  const matchRef = doc(collection(firestore, MATCHES_COLLECTION));
  batch.set(matchRef, {
    id: matchRef.id,
    createdAt: serverTimestamp(),
    matchType,
    teamA,
    teamB,
    scoreA,
    scoreB,
    winner: result.winner,
    movMultiplier: result.movMultiplier,
    ...(params.sessionId ? { sessionId: params.sessionId } : {}),
  });

  const updateTeam = (
    players: User[],
    ratings: { mu: number; sigma: number }[],
    outcome: "won" | "lost" | "draw",
  ) => {
    players.forEach((player, index) => {
      const next = ratings[index];
      batch.update(doc(firestore, USERS_COLLECTION, player.id), {
        mu: next.mu,
        sigma: next.sigma,
        displayRank: calculateDisplayRank(next.mu, next.sigma),
        matchesPlayed: player.matchesPlayed + 1,
        wins: player.wins + (outcome === "won" ? 1 : 0),
        losses: player.losses + (outcome === "lost" ? 1 : 0),
      });
    });
  };

  const teamAOutcome =
    result.winner === "teamA" ? "won" : result.winner === "teamB" ? "lost" : "draw";
  const teamBOutcome =
    result.winner === "teamB" ? "won" : result.winner === "teamA" ? "lost" : "draw";
  updateTeam(teamAPlayers, result.teamA, teamAOutcome);
  updateTeam(teamBPlayers, result.teamB, teamBOutcome);

  await batch.commit();
  return matchRef.id;
}

type MatchCorrection = { matchId: string; scoreA?: number; scoreB?: number; delete?: boolean };

/**
 * Corrects or removes a session match, then replays all recorded results to keep
 * the current player ratings and statistics consistent with match history.
 */
export async function correctSessionMatch(correction: MatchCorrection): Promise<void> {
  if (!isFirebaseConfigured() || !db || !auth?.currentUser) throw new Error("UNAUTHENTICATED");
  const firestore = db;
  const matchRef = doc(firestore, MATCHES_COLLECTION, correction.matchId);
  const matchSnapshot = await getDoc(matchRef);
  if (!matchSnapshot.exists()) throw new Error("MATCH_NOT_FOUND");
  const target = { id: matchSnapshot.id, ...matchSnapshot.data() } as Match;
  if (!target.sessionId) throw new Error("MATCH_NOT_IN_SESSION");

  const sessionSnapshot = await getDoc(doc(firestore, "sessions", target.sessionId));
  if (!sessionSnapshot.exists() || sessionSnapshot.data().hostId !== auth.currentUser.uid) throw new Error("FORBIDDEN");
  if (!correction.delete && (correction.scoreA === undefined || correction.scoreB === undefined)) throw new Error("INVALID_SCORE_RANGE");
  if (!correction.delete) {
    assertMatchScore(correction.scoreA!, correction.scoreB!);
  }

  const [matchesSnapshot, usersSnapshot] = await Promise.all([
    getDocs(collection(firestore, MATCHES_COLLECTION)),
    getDocs(collection(firestore, USERS_COLLECTION)),
  ]);
  const affectedIds = new Set(
    matchesSnapshot.docs.flatMap((item) => {
      const match = item.data() as Match;
      return [...match.teamA, ...match.teamB].map((member) => member.userId);
    }),
  );
  const matches = matchesSnapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }) as Match)
    .filter((match) => !(correction.delete && match.id === correction.matchId))
    .map((match) => match.id === correction.matchId ? { ...match, scoreA: correction.scoreA!, scoreB: correction.scoreB! } : match)
    .sort((a, b) => timestamp(a.createdAt) - timestamp(b.createdAt));
  const players = new Map(usersSnapshot.docs.map((item) => [item.id, mapUser(item.id, item.data() as Record<string, unknown>)]));
  const ratings = new Map<string, User>();
  const stats = new Map<string, { matchesPlayed: number; wins: number; losses: number }>();

  for (const match of matches) {
    const ids = [...match.teamA, ...match.teamB].map((member) => member.userId);
    const source = ids.map((id) => {
      const player = players.get(id);
      return ratings.get(id) ?? (player ? { ...player, mu: DEFAULT_MU, sigma: DEFAULT_SIGMA } : undefined);
    });
    if (source.some((player) => !player)) throw new Error("MISSING_PLAYER");
    const teamSize = match.matchType === "1v1" ? 1 : 2;
    const result = calculateMatchResult(match.matchType, source.slice(0, teamSize) as User[], source.slice(teamSize) as User[], match.scoreA, match.scoreB);
    [...result.teamA, ...result.teamB].forEach((rating, index) => {
      const id = ids[index];
      const player = players.get(id)!;
      ratings.set(id, { ...player, mu: rating.mu, sigma: rating.sigma, displayRank: calculateDisplayRank(rating.mu, rating.sigma), matchesPlayed: 0, wins: 0, losses: 0 });
      const current = stats.get(id) ?? { matchesPlayed: 0, wins: 0, losses: 0 };
      current.matchesPlayed += 1;
      const won = index < teamSize ? result.winner === "teamA" : result.winner === "teamB";
      const lost = index < teamSize ? result.winner === "teamB" : result.winner === "teamA";
      if (won) current.wins += 1;
      if (lost) current.losses += 1;
      stats.set(id, current);
    });
  }

  affectedIds.forEach((id) => {
    if (ratings.has(id)) return;
    const player = players.get(id);
    if (!player) return;
    ratings.set(id, { ...player, mu: DEFAULT_MU, sigma: DEFAULT_SIGMA, displayRank: calculateDisplayRank(DEFAULT_MU, DEFAULT_SIGMA), matchesPlayed: 0, wins: 0, losses: 0 });
    stats.set(id, { matchesPlayed: 0, wins: 0, losses: 0 });
  });

  const batch = writeBatch(firestore);
  if (correction.delete) batch.delete(matchRef);
  else batch.update(matchRef, { scoreA: correction.scoreA, scoreB: correction.scoreB, winner: getMatchWinner(correction.scoreA!, correction.scoreB!), movMultiplier: calculateMovMultiplier(correction.scoreA!, correction.scoreB!) });
  ratings.forEach((rating, id) => {
    const summary = stats.get(id)!;
    batch.update(doc(firestore, USERS_COLLECTION, id), { mu: rating.mu, sigma: rating.sigma, displayRank: rating.displayRank, ...summary });
  });
  await batch.commit();
}

function timestamp(value: unknown) {
  return value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function" ? value.toMillis() : 0;
}
