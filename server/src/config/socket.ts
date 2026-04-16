import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import * as redisService from '../services/redisService';
import * as gameService   from '../services/gameService';
import * as wordService   from '../services/wordService';

let io: SocketServer;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });

  // WHY: Authenticate socket connection via JWT
  // Prevents unauthorized users from playing
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
    if (!token) 
        return next(new Error("No token"));
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
        socket.data.userId = decoded.userId;
      next();
    } catch {
         next(new Error("Invalid token"));
    }
});

  io.on("connection", (socket) => {
    const userId = socket.data.userId as number;
    console.log(`Player ${userId} connected: ${socket.id}`);

    // ── JOIN ROOM ──────────────────────────────────
    socket.on("join_room", async (roomId: string) => {
      try {
        const joined = await redisService.joinRoom(roomId, userId);
        if (!joined) {
          socket.emit("error", { message: "Room not found or full" });
          return;
        }

        socket.join(roomId);
        socket.data.roomId = roomId;

        const room = await redisService.getRoom(roomId);

        // WHY: Notify both players when room is full
        if (room.player1 && room.player2) {
          // Pick random word and start game
          const word = wordService.getRandomWord();
          await redisService.startGame(
            roomId,
            word,
            parseInt(room.player1),
            parseInt(room.player2)
          );

          // Notify both players game started
          io.to(roomId).emit("game_start", {
            roomId,
            startedAt: Date.now(),
          });
        } else {
          socket.emit("room_joined", { roomId, waiting: true });
        }
      } catch (err) {
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // ── MAKE GUESS ─────────────────────────────────
    socket.on("make_guess", async (data: { guess: string }) => {
      try {
        const roomId = socket.data.roomId as string;
        if (!roomId) return;

        // Rate limit: max 2 guesses per second
        const allowed = await redisService.checkRateLimit(userId, 2, 1);
        if (!allowed) {
          socket.emit("error", { message: "Slow down!" });
          return;
        }

        const guess = data.guess.toUpperCase();

        // Validate word length
        if (guess.length !== 5) {
          socket.emit("error", { message: "Word must be 5 letters" });
          return;
        }

        // Validate word is real
        if (!wordService.isValidWord(guess)) {
          socket.emit("error", { message: "Not a valid word" });
          return;
        }

        const word     = await redisService.getGame(roomId);
        const answer   = word.word;
        const result   = wordService.evaluateGuess(guess, answer);
        const isWin    = result.every(t => t.color === "green");

        // Save guess to Redis
        await redisService.saveGuess(roomId, userId, guess);
        const guessCount = await redisService.getGuessCount(roomId, userId);

        // Send result to THIS player
        socket.emit("guess_result", {
          guess,
          result,
          guessNumber: guessCount,
          isWin,
        });

        // WHY: Tell OPPONENT how many guesses this player has made
        // without revealing the actual guess
        socket.to(roomId).emit("opponent_guessed", {
          guessCount,
        });

        // Check win
        if (isWin) {
          // WHY: Atomic SET NX prevents double winner
          const won = await redisService.setWinner(roomId, userId);
          if (won) {
            const game     = await redisService.getGame(roomId);
            const startedAt = parseInt(game.startedAt);
            const duration  = Date.now() - startedAt;

            // Add points to leaderboard
            const points = Math.max(100 - (guessCount * 10), 10);
            await redisService.addScore(userId, points);

            // Save to PostgreSQL
            await gameService.saveResult({
              roomId,
              word: answer,
              winnerId:      userId,
              loserId:       parseInt(game.player1Id) === userId
                ? parseInt(game.player2Id)
                : parseInt(game.player1Id),
              winnerGuesses: guessCount,
              durationMs:    duration,
              player1Id:     parseInt(game.player1Id),
              player2Id:     parseInt(game.player2Id),
            });

            // Notify both players
            io.to(roomId).emit("game_over", {
              winnerId:  userId,
              word:      answer,
              guessCount,
              duration,
              points,
            });
          }
        }

        // Check if max guesses reached (6 guesses)
        if (guessCount >= 6 && !isWin) {
          const existingWinner = await redisService.getWinner(roomId);
          if (!existingWinner) {
            const game = await redisService.getGame(roomId);
            io.to(roomId).emit("game_over", {
              winnerId:  null,
              word:      game.word,
              guessCount: 6,
              isDraw:    true,
            });
          }
        }

      } catch (err) {
        socket.emit("error", { message: "Failed to process guess" });
      }
    });

    // ── DISCONNECT ─────────────────────────────────
    socket.on("disconnect", () => {
      const roomId = socket.data.roomId;
      if (roomId) {
        socket.to(roomId).emit("player_left", { userId });
      }
      console.log(`Player ${userId} disconnected`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};


