import { redis } from '../config/redis';

// ── KEY PATTERNS ──────────────────────────────────
// WHY: Consistent key naming prevents collisions
const KEYS = {
  room:        (roomId: string) => `room:${roomId}`,
  game:        (roomId: string) => `game:${roomId}`,
  word:        (roomId: string) => `game:${roomId}:word`,
  guesses:     (roomId: string, userId: number) => `game:${roomId}:${userId}:guesses`,
  winner:      (roomId: string) => `game:${roomId}:winner`,
  leaderboard: () => "leaderboard:global",
  session:     (userId: number) => `session:${userId}`,
  rateLimit:   (userId: number) => `ratelimit:${userId}`,
};

const EXPIRY = {
  room:    3600,  // 1 hour
  game:    1800,  // 30 minutes
  session: 86400, // 24 hours
};

// ── ROOM OPERATIONS ────────────────────────────────
export const createRoom = async (roomId: string, hostId: number): Promise<void> => {
  await redis.hset(KEYS.room(roomId), {
    roomId,
    hostId:   hostId.toString(),
    status:   "waiting",
    player1:  hostId.toString(),
    player2:  "",
    createdAt: Date.now().toString(),
  });
  await redis.expire(KEYS.room(roomId), EXPIRY.room);
};

export const joinRoom = async (roomId: string, userId: number): Promise<boolean> => {
  const room = await redis.hgetall(KEYS.room(roomId));
  if (!room || !room.roomId) return false;
  if (room.status !== "waiting") return false;
  if (room.player2) return false;

  await redis.hset(KEYS.room(roomId), {
    player2: userId.toString(),
    status:  "ready",
  });
  return true;
};

export const getRoom = async (roomId: string) => {
  return redis.hgetall(KEYS.room(roomId));
};

// ── GAME OPERATIONS ────────────────────────────────
export const startGame = async (
  roomId: string,
  word: string,
  player1Id: number,
  player2Id: number
): Promise<void> => {
  // WHY: Store word separately for easy access
  await redis.set(KEYS.word(roomId), word, "EX", EXPIRY.game);

  await redis.hset(KEYS.game(roomId), {
    status:    "playing",
    word,
    player1Id: player1Id.toString(),
    player2Id: player2Id.toString(),
    startedAt: Date.now().toString(),
  });
  await redis.expire(KEYS.game(roomId), EXPIRY.game);
};

export const saveGuess = async (
  roomId: string,
  userId: number,
  guess: string
): Promise<void> => {
  // WHY: LPUSH adds to front — latest guess is first
  await redis.lpush(KEYS.guesses(roomId, userId), guess);
  await redis.expire(KEYS.guesses(roomId, userId), EXPIRY.game);
};

export const getGuesses = async (
  roomId: string,
  userId: number
): Promise<string[]> => {
  return redis.lrange(KEYS.guesses(roomId, userId), 0, -1);
};

export const getGuessCount = async (
  roomId: string,
  userId: number
): Promise<number> => {
  return redis.llen(KEYS.guesses(roomId, userId));
};

// WHY: SET NX = atomic "set if not exists"
// Prevents two players winning simultaneously
export const setWinner = async (
  roomId: string,
  userId: number
): Promise<boolean> => {
  const result = await redis.set(
    KEYS.winner(roomId),
    userId.toString(),
    "NX",
    "EX",
    EXPIRY.game
  );
  return result === "OK";
};

export const getWinner = async (roomId: string): Promise<string | null> => {
  return redis.get(KEYS.winner(roomId));
};

export const getGame = async (roomId: string) => {
  return redis.hgetall(KEYS.game(roomId));
};

// ── LEADERBOARD ────────────────────────────────────
export const addScore = async (
  userId: number,
  points: number
): Promise<void> => {
  await redis.zincrby(KEYS.leaderboard(), points, userId.toString());
};

export const getTopPlayers = async (count = 10) => {
  // WHY: zrange with rev:true = highest score first
  return redis.zrange(KEYS.leaderboard(), 0, count - 1, {
    rev:        true,
    withScores: true,
  });
};

export const getPlayerRank = async (userId: number) => {
  // WHY: zrevrank = rank from top (0 = #1)
  return redis.zrevrank(KEYS.leaderboard(), userId.toString());
};

export const getPlayerScore = async (userId: number) => {
  return redis.zscore(KEYS.leaderboard(), userId.toString());
};

// ── RATE LIMITING ──────────────────────────────────
// WHY: Prevent players from spamming guesses
export const checkRateLimit = async (
  userId: number,
  maxRequests = 10,
  windowSeconds = 10
): Promise<boolean> => {
  const key     = KEYS.rateLimit(userId);
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }
  return current <= maxRequests;
};
