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
  getMatchWinner,
} from "./trueskill";
import type { TeamMember, User } from "./types";

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

export async function ensureUserProfile(params: {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}): Promise<void> {
  if (!isFirebaseConfigured() || !db) {
    return;
  }

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

export async function recordDoublesMatch(params: {
  firestore?: Firestore;
  teamAIds: [string, string];
  teamBIds: [string, string];
  scoreA: number;
  scoreB: number;
}): Promise<string> {
  if (!isFirebaseConfigured() || !db || !auth) {
    throw new Error("FIREBASE_UNAVAILABLE");
  }

  const firestore = params.firestore ?? db;
  const { teamAIds, teamBIds, scoreA, scoreB } = params;

  if (!auth.currentUser) {
    throw new Error("UNAUTHENTICATED");
  }

  assertScore(scoreA);
  assertScore(scoreB);
  if (scoreA === scoreB) {
    throw new Error("TIE");
  }

  const playerIds = [...teamAIds, ...teamBIds];
  if (new Set(playerIds).size !== 4) {
    throw new Error("DUPLICATE_PLAYERS");
  }

  const userDocs = await Promise.all(
    playerIds.map((id) => getDoc(doc(firestore, USERS_COLLECTION, id))),
  );

  const users = userDocs.map((snapshot, index) => {
    if (!snapshot.exists()) {
      throw new Error(`MISSING_PLAYER:${playerIds[index]}`);
    }
    return mapUser(snapshot.id, snapshot.data() as Record<string, unknown>);
  });

  const teamAPlayers = [users[0], users[1]];
  const teamBPlayers = [users[2], users[3]];

  const result = calculateMatchResult(
    teamAPlayers,
    teamBPlayers,
    scoreA,
    scoreB,
  );
  const winner = getMatchWinner(scoreA, scoreB);

  const teamA: TeamMember[] = teamAPlayers.map((player, index) => ({
    userId: player.id,
    preRank: player.displayRank,
    postRank: calculateDisplayRank(
      result.teamA[index].mu,
      result.teamA[index].sigma,
    ),
  }));

  const teamB: TeamMember[] = teamBPlayers.map((player, index) => ({
    userId: player.id,
    preRank: player.displayRank,
    postRank: calculateDisplayRank(
      result.teamB[index].mu,
      result.teamB[index].sigma,
    ),
  }));

  const batch = writeBatch(firestore);
  const matchRef = doc(collection(firestore, MATCHES_COLLECTION));

  batch.set(matchRef, {
    id: matchRef.id,
    createdAt: serverTimestamp(),
    teamA,
    teamB,
    scoreA,
    scoreB,
    winner,
  });

  const applyTeam = (
    players: User[],
    ratings: { mu: number; sigma: number }[],
    won: boolean,
  ) => {
    players.forEach((player, index) => {
      const next = ratings[index];
      batch.update(doc(firestore, USERS_COLLECTION, player.id), {
        mu: next.mu,
        sigma: next.sigma,
        displayRank: calculateDisplayRank(next.mu, next.sigma),
        matchesPlayed: player.matchesPlayed + 1,
        wins: player.wins + (won ? 1 : 0),
        losses: player.losses + (won ? 0 : 1),
      });
    });
  };

  applyTeam(teamAPlayers, result.teamA, winner === "teamA");
  applyTeam(teamBPlayers, result.teamB, winner === "teamB");

  await batch.commit();
  return matchRef.id;
}
