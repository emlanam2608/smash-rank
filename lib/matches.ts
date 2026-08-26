import {
  collection,
  doc,
  getDoc,
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
  MAX_MATCH_SCORE,
  MIN_MATCH_SCORE,
  calculateDisplayRank,
  calculateMatchResult,
} from "./trueskill";
import type { MatchType, TeamMember, User } from "./types";

export const USERS_COLLECTION = "users";
export const MATCHES_COLLECTION = "matches";

function assertScore(score: number) {
  if (
    !Number.isInteger(score) ||
    score < MIN_MATCH_SCORE ||
    score > MAX_MATCH_SCORE
  ) {
    throw new Error("INVALID_SCORE_RANGE");
  }
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
  assertScore(scoreA);
  assertScore(scoreB);

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
