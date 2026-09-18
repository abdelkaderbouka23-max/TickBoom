const path = require("path");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const { Server } = require("socket.io");
const { THEMES, createQuest, publicQuest, randomInt: questRandomInt } = require("./quests");

const PORT = Number(process.env.PORT) || 3000;
const ROUND_MS = 20000;
const TICK_MS = 100;
const PROTECT_MS = 1100;
const EXPLODE_MS = 2600;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 12;
const ANSWER_COOLDOWN_MS = 280;
const VOTE_MS = 9000;
const REVEAL_MS = 2800;
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PLAYER_COLORS = [
  "#7B5CFF",
  "#2D9CDB",
  "#FF5FA2",
  "#FFC53D",
  "#22C55E",
  "#FF6B4A",
  "#00C2C7",
  "#F45B69",
  "#A855F7",
  "#38BDF8",
  "#FB923C",
  "#84CC16"
];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: false }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const rooms = new Map();
const socketToRoom = new Map();

function randomId() {
  return crypto.randomUUID();
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeRoomCode() {
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  if (rooms.has(code)) return makeRoomCode();
  return code;
}

function now() {
  return Date.now();
}

function cleanName(raw) {
  const name = String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 14);
  return name || "Joueur";
}

function publicPlayers(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    avatar: p.avatar,
    alive: p.alive,
    connected: p.connected,
    isHost: p.id === room.hostId,
    initials: p.avatar,
    stats: { ...p.stats }
  }));
}

function alivePlayers(room) {
  return [...room.players.values()].filter((p) => p.alive && p.connected);
}

function remainingMs(room) {
  if (!room.timerEndsAt) return ROUND_MS;
  return Math.max(0, room.timerEndsAt - now());
}

function dangerLevel(ms) {
  const ratio = ms / ROUND_MS;
  if (ratio <= 0.1) return "critical";
  if (ratio <= 0.3) return "hot";
  if (ratio <= 0.5) return "warm";
  return "calm";
}

function publicState(room, forPlayerId) {
  const holder = room.players.get(room.bombHolderId);
  const you = room.players.get(forPlayerId);
  const ms = remainingMs(room);
  const isHolder = Boolean(you && you.id === room.bombHolderId && you.alive);
  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    round: room.round,
    bombHolderId: room.bombHolderId,
    bombHolderName: holder ? holder.name : null,
    remainingMs: ms,
    remaining: Math.max(0, ms / 1000),
    danger: dangerLevel(ms),
    players: publicPlayers(room),
    quest: isHolder && room.phase === "playing" ? publicQuest(room.quest) : null,
    spectatorHint: !isHolder && room.phase === "playing" ? spectatorHint(room) : null,
    lastEvent: room.lastEvent,
    winnerId: room.winnerId,
    winnerName: room.winnerId ? room.players.get(room.winnerId)?.name : null,
    eliminatedName: room.eliminatedName,
    youAreHolder: isHolder,
    serverNow: now(),
    theme: room.theme || null,
    themes: THEMES,
    votes: room.votes || {},
    yourVote: you?.vote || null,
    voteEndsAt: room.voteEndsAt || null,
    voteRemaining: room.phase === "voting" && room.voteEndsAt ? Math.max(0, (room.voteEndsAt - now()) / 1000) : 0
  };
}

function spectatorHint(room) {
  const holder = room.players.get(room.bombHolderId);
  if (!holder) return "The bomb is in play.";
  if (room.quest?.type === "memory" && room.quest.phase === "show") {
    return `${holder.name} is memorizing the sequence.`;
  }
  if (room.quest?.extra?.variant === "tap") {
    return `${holder.name} must tap at the right moment.`;
  }
  return `${holder.name} has the bomb.`;
}

function emitRoom(room, extra = {}) {
  for (const player of room.players.values()) {
    if (!player.socketId) continue;
    const sock = io.sockets.sockets.get(player.socketId);
    if (!sock) continue;
    sock.emit("game_state", { ...publicState(room, player.id), ...extra });
  }
}

function emitToPlayer(room, playerId, event, payload) {
  const player = room.players.get(playerId);
  if (!player?.socketId) return;
  const sock = io.sockets.sockets.get(player.socketId);
  if (sock) sock.emit(event, payload);
}

function stopTick(room) {
  if (room.tickTimer) {
    clearInterval(room.tickTimer);
    room.tickTimer = null;
  }
  if (room.explodeTimer) {
    clearTimeout(room.explodeTimer);
    room.explodeTimer = null;
  }
  if (room.questTimer) {
    clearTimeout(room.questTimer);
    room.questTimer = null;
  }
  if (room.voteTimer) {
    clearTimeout(room.voteTimer);
    room.voteTimer = null;
  }
  if (room.revealTimer) {
    clearTimeout(room.revealTimer);
    room.revealTimer = null;
  }
}

function destroyRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  stopTick(room);
  if (room.disconnectTimers) {
    for (const t of room.disconnectTimers.values()) clearTimeout(t);
    room.disconnectTimers.clear();
  }
  rooms.delete(code);
}

function maybeCleanup(room) {
  const anyone = [...room.players.values()].some((p) => p.connected);
  if (!anyone) destroyRoom(room.code);
}

function pickColor(room) {
  const used = new Set([...room.players.values()].map((p) => p.color));
  return PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[room.players.size % PLAYER_COLORS.length];
}

function pickAvatar(name) {
  const parts = String(name || "P").trim().split(/\s+/);
  const a = (parts[0] || "P").charAt(0);
  const b = (parts[1] ? parts[1].charAt(0) : (parts[0] || "P").charAt(1) || a);
  return (a + b).toUpperCase();
}

function attachQuestTimers(room) {
  if (room.questTimer) {
    clearTimeout(room.questTimer);
    room.questTimer = null;
  }
  const quest = room.quest;
  if (!quest) return;
  if (quest.type === "memory" && quest.phase === "show") {
    room.questTimer = setTimeout(() => {
      if (room.quest?.id !== quest.id) return;
      room.quest.phase = "play";
      emitRoom(room, { event: "quest_ready" });
    }, quest.extra.showMs || 1700);
  }
  if (quest.type === "visual" && quest.extra?.variant === "tap" && quest.phase === "wait") {
    const wait = Math.max(0, quest.goAt - now());
    room.questTimer = setTimeout(() => {
      if (room.quest?.id !== quest.id || room.phase !== "playing") return;
      room.quest.phase = "go";
      room.quest.extra = { ...room.quest.extra, active: room.quest.revealActive };
      emitRoom(room, { event: "quest_go" });
    }, wait);
  }
}

function giveBomb(room, exceptId, reason) {
  const candidates = alivePlayers(room).filter((p) => {
    if (exceptId && p.id === exceptId) return false;
    const protectedUntil = room.protectUntil.get(p.id) || 0;
    return now() >= protectedUntil;
  });
  let pool = candidates;
  if (!pool.length) {
    pool = alivePlayers(room).filter((p) => !exceptId || p.id !== exceptId);
  }
  if (!pool.length) {
    pool = alivePlayers(room);
  }
  if (!pool.length) {
    finishGame(room);
    return;
  }
  const holder = pool[randomInt(0, pool.length - 1)];
  room.bombHolderId = holder.id;
  holder.stats.bombsReceived += 1;
  room.quest = createQuest(room);
  room.quest.answered = false;
  holder.questStartedAt = now();
  room.timerEndsAt = now() + ROUND_MS;
  room.lastEvent = { type: "bomb_received", playerId: holder.id, reason };
  attachQuestTimers(room);
  emitRoom(room, { event: "bomb_received", playerId: holder.id });
  emitToPlayer(room, holder.id, "bomb_received", {
    playerId: holder.id,
    quest: publicQuest(room.quest)
  });
}

function startTick(room) {
  stopTick(room);
  room.tickTimer = setInterval(() => {
    if (room.phase !== "playing") return;
    const ms = remainingMs(room);
    emitRoom(room, { event: "tick" });
    if (ms <= 0) {
      explode(room);
    }
  }, TICK_MS);
}

function explode(room) {
  if (room.phase !== "playing") return;
  room.phase = "exploding";
  if (room.questTimer) {
    clearTimeout(room.questTimer);
    room.questTimer = null;
  }
  const holder = room.players.get(room.bombHolderId);
    room.eliminatedName = holder ? holder.name : "Player";
  room.lastEvent = { type: "explosion", playerId: holder?.id };
  emitRoom(room, { event: "explosion" });
  io.to(room.code).emit("player_eliminated_pending", { name: room.eliminatedName });

  room.explodeTimer = setTimeout(() => {
    if (holder) {
      holder.alive = false;
      holder.stats.explosions += 1;
    }
    room.quest = null;
    const left = alivePlayers(room);
    io.to(room.code).emit("player_eliminated", {
      playerId: holder?.id,
      name: room.eliminatedName,
      remaining: left.length
    });
    if (left.length <= 1) {
      finishGame(room);
      return;
    }
    room.phase = "playing";
    room.round += 1;
    giveBomb(room, holder?.id, "after_explosion");
    startTick(room);
    emitRoom(room);
  }, EXPLODE_MS);
}

function finishGame(room) {
  stopTick(room);
  room.phase = "victory";
  room.quest = null;
  const left = [...room.players.values()].filter((p) => p.alive);
  const winner = left[0] || [...room.players.values()].sort((a, b) => b.stats.questsSucceeded - a.stats.questsSucceeded)[0];
  room.winnerId = winner ? winner.id : null;
  room.bombHolderId = null;
  room.lastEvent = { type: "game_over", winnerId: room.winnerId };
  emitRoom(room, { event: "game_over" });
  io.to(room.code).emit("game_over", publicState(room, room.winnerId));
}

function startVoting(room) {
  const ready = [...room.players.values()].filter((p) => p.connected);
  if (ready.length < MIN_PLAYERS) return { error: `Need at least ${MIN_PLAYERS} players.` };
  stopTick(room);
  room.phase = "voting";
  room.votes = Object.fromEntries(THEMES.map((t) => [t.id, 0]));
  room.voteByPlayer = new Map();
  room.voteEndsAt = now() + VOTE_MS;
  room.theme = null;
  room.winnerId = null;
  room.eliminatedName = null;
  room.bombHolderId = null;
  room.quest = null;
  room.usedKeys = new Set();
  for (const p of room.players.values()) {
    p.alive = p.connected;
    p.vote = null;
    p.stats = { bombsReceived: 0, questsSucceeded: 0, explosions: 0, fastestMs: null };
  }
  emitRoom(room, { event: "vote_started" });
  room.tickTimer = setInterval(() => {
    if (room.phase !== "voting") return;
    emitRoom(room, { event: "vote_tick" });
  }, 200);
  room.voteTimer = setTimeout(() => closeVoting(room), VOTE_MS);
  return { ok: true };
}

function closeVoting(room) {
  if (room.phase !== "voting") return;
  if (room.voteTimer) {
    clearTimeout(room.voteTimer);
    room.voteTimer = null;
  }
  if (room.tickTimer) {
    clearInterval(room.tickTimer);
    room.tickTimer = null;
  }
  const counts = THEMES.map((t) => ({ id: t.id, n: room.votes[t.id] || 0 }));
  const max = Math.max(0, ...counts.map((c) => c.n));
  const pool = max === 0 ? counts : counts.filter((c) => c.n === max);
  room.theme = pool[randomInt(0, pool.length - 1)].id;
  room.phase = "theme_reveal";
  room.lastEvent = { type: "theme_selected", theme: room.theme };
  emitRoom(room, { event: "votes_locked" });
  room.revealTimer = setTimeout(() => beginMatch(room), REVEAL_MS);
}

function beginMatch(room) {
  const ready = [...room.players.values()].filter((p) => p.connected);
  if (ready.length < MIN_PLAYERS) {
    room.phase = "lobby";
    emitRoom(room, { event: "vote_cancelled" });
    return;
  }
  room.phase = "playing";
  room.round = 1;
  room.protectUntil.clear();
  giveBomb(room, null, "start");
  startTick(room);
  io.to(room.code).emit("game_started");
  emitRoom(room, { event: "game_started" });
}

function startGame(room) {
  return startVoting(room);
}

function resetLobby(room) {
  stopTick(room);
  room.phase = "lobby";
  room.bombHolderId = null;
  room.quest = null;
  room.timerEndsAt = null;
  room.winnerId = null;
  room.eliminatedName = null;
  room.round = 0;
  room.theme = null;
  room.votes = {};
  room.voteEndsAt = null;
  room.protectUntil.clear();
  for (const p of room.players.values()) {
    p.alive = true;
    p.vote = null;
  }
  emitRoom(room, { event: "rematch" });
}

function createRoom(socket, name) {
  const code = makeRoomCode();
  const playerId = randomId();
  const room = {
    code,
    hostId: playerId,
    phase: "lobby",
    players: new Map(),
    bombHolderId: null,
    timerEndsAt: null,
    quest: null,
    tickTimer: null,
    explodeTimer: null,
    questTimer: null,
    voteTimer: null,
    revealTimer: null,
    votes: {},
    voteByPlayer: new Map(),
    voteEndsAt: null,
    theme: null,
    usedKeys: new Set(),
    protectUntil: new Map(),
    round: 0,
    lastEvent: { type: "created" },
    winnerId: null,
    eliminatedName: null,
    createdAt: now(),
    disconnectTimers: new Map()
  };
  const player = {
    id: playerId,
    name: cleanName(name),
    color: pickColor(room),
    avatar: pickAvatar(cleanName(name)),
    socketId: socket.id,
    alive: true,
    connected: true,
    lastAnswerAt: 0,
    vote: null,
    stats: { bombsReceived: 0, questsSucceeded: 0, explosions: 0, fastestMs: null }
  };
  room.players.set(playerId, player);
  rooms.set(code, room);
  socket.join(code);
  socketToRoom.set(socket.id, { code, playerId });
  return { room, player };
}

function joinRoom(socket, code, name, existingId) {
  const room = rooms.get(String(code || "").trim().toUpperCase());
  if (!room) return { error: "This room does not exist." };

  if (existingId && room.players.has(existingId)) {
    const player = room.players.get(existingId);
    const pending = room.disconnectTimers.get(existingId);
    if (pending) {
      clearTimeout(pending);
      room.disconnectTimers.delete(existingId);
    }
    player.connected = true;
    player.socketId = socket.id;
    if (name) {
      player.name = cleanName(name);
      player.avatar = pickAvatar(player.name);
    }
    socket.join(room.code);
    socketToRoom.set(socket.id, { code: room.code, playerId: player.id });
    if (room.phase === "playing" && alivePlayers(room).length >= 1 && !room.bombHolderId) {
      giveBomb(room, null, "reconnect");
    }
    emitRoom(room, { event: "player_rejoined", playerId: player.id });
    return { room, player, rejoined: true };
  }

  if (room.players.size >= MAX_PLAYERS) return { error: "This room is full." };
  if (room.phase !== "lobby" && room.phase !== "voting") {
    return { error: "The match has already started." };
  }

  const player = {
    id: randomId(),
    name: cleanName(name),
    color: pickColor(room),
    avatar: pickAvatar(cleanName(name)),
    socketId: socket.id,
    alive: true,
    connected: true,
    lastAnswerAt: 0,
    vote: null,
    stats: { bombsReceived: 0, questsSucceeded: 0, explosions: 0, fastestMs: null }
  };
  room.players.set(player.id, player);
  socket.join(room.code);
  socketToRoom.set(socket.id, { code: room.code, playerId: player.id });
  io.to(room.code).emit("player_joined", publicPlayers(room).find((p) => p.id === player.id));
  emitRoom(room, { event: "player_joined", playerId: player.id });
  return { room, player };
}

function finalizeLeave(room, player) {
  const wasHolder = room.bombHolderId === player.id;
  const wasHost = room.hostId === player.id;

  if (room.phase === "lobby" || room.phase === "voting") {
    if (room.phase === "voting" && player.vote && room.votes[player.vote] > 0) {
      room.votes[player.vote] -= 1;
    }
    room.players.delete(player.id);
    if (wasHost) {
      const next = [...room.players.values()][0];
      room.hostId = next ? next.id : null;
    }
    emitRoom(room, { event: "player_left", playerId: player.id });
    maybeCleanup(room);
    return;
  }

  player.connected = false;
  player.alive = false;
  if (wasHost) {
    const next = [...room.players.values()].find((p) => p.connected);
    if (next) room.hostId = next.id;
  }

  if (room.phase === "playing") {
    if (wasHolder) {
      const left = alivePlayers(room);
      if (left.length <= 1) {
        finishGame(room);
      } else {
        giveBomb(room, player.id, "disconnect");
      }
    } else if (alivePlayers(room).length <= 1) {
      finishGame(room);
    } else {
      emitRoom(room, { event: "player_left", playerId: player.id });
    }
  } else {
    emitRoom(room, { event: "player_left", playerId: player.id });
  }
  maybeCleanup(room);
}

function leaveSocket(socket, immediate) {
  const ref = socketToRoom.get(socket.id);
  if (!ref) return;
  socketToRoom.delete(socket.id);
  const room = rooms.get(ref.code);
  if (!room) return;
  const player = room.players.get(ref.playerId);
  if (!player) return;
  if (player.socketId && player.socketId !== socket.id) return;

  player.connected = false;
  player.socketId = null;
  emitRoom(room, { event: "player_offline", playerId: player.id });

  if (immediate) {
    finalizeLeave(room, player);
    return;
  }

  const timer = setTimeout(() => {
    room.disconnectTimers.delete(player.id);
    const still = room.players.get(player.id);
    if (!still || still.connected) return;
    finalizeLeave(room, player);
  }, 2500);
  const prev = room.disconnectTimers.get(player.id);
  if (prev) clearTimeout(prev);
  room.disconnectTimers.set(player.id, timer);
}

function failAnswer(room, player, message) {
  emitToPlayer(room, player.id, "quest_result", { correct: false, message });
  io.to(room.code).emit("quest_result", { playerId: player.id, correct: false });
  return { ok: true, correct: false };
}

function submitAnswer(room, player, payload) {
  if (room.phase !== "playing") return { error: "The match is not running." };
  if (!player.alive) return { error: "You are out." };
  if (room.bombHolderId !== player.id) return { error: "You do not have the bomb." };
  const quest = room.quest;
  if (!quest) return { error: "No active challenge." };
  if (quest.answered) return { error: "Already answered." };
  if (payload.questId !== quest.id) return { error: "This challenge is no longer active." };
  if (now() - player.lastAnswerAt < ANSWER_COOLDOWN_MS) return { error: "Too fast." };
  player.lastAnswerAt = now();

  if (quest.type === "memory" && quest.phase !== "play") {
    return failAnswer(room, player, "Wait for the sequence.");
  }

  const isTap = quest.type === "visual" && quest.extra?.variant === "tap";
  const isTimed = quest.type === "reaction" || isTap;
  if (isTimed) {
    if (quest.phase !== "go" || now() < quest.goAt) {
      return failAnswer(room, player, "Too early");
    }
    if (now() > quest.goAt + (quest.reactionWindow || 1800)) {
      return failAnswer(room, player, "Too late");
    }
    if (isTap) {
      const index = Number(payload.answerIndex);
      if (index !== quest.correctIndex) return failAnswer(room, player, "Wrong one");
    }
    return succeedQuest(room, player);
  }

  const index = Number(payload.answerIndex);
  const max = Math.max(quest.answers.length, quest.extra?.cells?.length || 0);
  if (!Number.isInteger(index) || index < 0 || index >= max) {
    return { error: "Invalid answer." };
  }
  if (index !== quest.correctIndex) {
    return failAnswer(room, player, "Not quite");
  }
  return succeedQuest(room, player);
}

function succeedQuest(room, player) {
  const quest = room.quest;
  quest.answered = true;
  player.stats.questsSucceeded += 1;
  const elapsed = Math.max(80, now() - (player.questStartedAt || now()));
  if (player.stats.fastestMs == null || elapsed < player.stats.fastestMs) {
    player.stats.fastestMs = elapsed;
  }
  room.protectUntil.set(player.id, now() + PROTECT_MS);
  emitToPlayer(room, player.id, "quest_result", { correct: true, message: "CLEARED" });
  io.to(room.code).emit("quest_result", { playerId: player.id, correct: true });
  io.to(room.code).emit("pass_bomb", { from: player.id });
  giveBomb(room, player.id, "passed");
  return { ok: true, correct: true };
}

function castVote(room, player, themeId) {
  if (room.phase !== "voting") return { error: "Voting is closed." };
  if (!THEMES.some((t) => t.id === themeId)) return { error: "Unknown theme." };
  if (player.vote) return { error: "You already voted." };
  player.vote = themeId;
  room.votes[themeId] = (room.votes[themeId] || 0) + 1;
  room.voteByPlayer.set(player.id, themeId);
  emitRoom(room, { event: "vote_update" });
  return { ok: true, votes: room.votes };
}

io.on("connection", (socket) => {
  socket.on("create_room", (data = {}, cb) => {
    try {
      const { room, player } = createRoom(socket, data.name);
      const payload = {
        ok: true,
        playerId: player.id,
        you: publicPlayers(room).find((p) => p.id === player.id),
        state: publicState(room, player.id)
      };
      if (typeof cb === "function") cb(payload);
      socket.emit("room_created", payload);
    } catch (err) {
      if (typeof cb === "function") cb({ error: "Could not create the room." });
    }
  });

  socket.on("join_room", (data = {}, cb) => {
    const result = joinRoom(socket, data.code, data.name, data.playerId);
    if (result.error) {
      if (typeof cb === "function") cb({ error: result.error });
      socket.emit("join_error", { error: result.error });
      return;
    }
    const payload = {
      ok: true,
      playerId: result.player.id,
      rejoined: Boolean(result.rejoined),
      you: publicPlayers(result.room).find((p) => p.id === result.player.id),
      state: publicState(result.room, result.player.id)
    };
    if (typeof cb === "function") cb(payload);
    socket.emit("room_joined", payload);
  });

  socket.on("leave_room", () => {
    leaveSocket(socket, true);
    socket.emit("left_room");
  });

  socket.on("start_game", (_data, cb) => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) return typeof cb === "function" && cb({ error: "Pas dans une salle." });
    const room = rooms.get(ref.code);
    if (!room) return typeof cb === "function" && cb({ error: "Salle introuvable." });
    if (room.hostId !== ref.playerId) return typeof cb === "function" && cb({ error: "Only the host can start." });
    const result = startGame(room);
    if (typeof cb === "function") cb(result);
  });

  socket.on("vote_theme", (data = {}, cb) => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) return typeof cb === "function" && cb({ error: "Pas dans une salle." });
    const room = rooms.get(ref.code);
    const player = room?.players.get(ref.playerId);
    if (!room || !player) return typeof cb === "function" && cb({ error: "Salle introuvable." });
    const result = castVote(room, player, data.themeId);
    if (typeof cb === "function") cb(result);
  });

  socket.on("submit_quest", (data = {}, cb) => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) return typeof cb === "function" && cb({ error: "Pas dans une salle." });
    const room = rooms.get(ref.code);
    const player = room?.players.get(ref.playerId);
    if (!room || !player) return typeof cb === "function" && cb({ error: "Salle introuvable." });
    const result = submitAnswer(room, player, data);
    if (typeof cb === "function") cb(result);
  });

  socket.on("rematch", (_data, cb) => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) return typeof cb === "function" && cb({ error: "Pas dans une salle." });
    const room = rooms.get(ref.code);
    if (!room) return typeof cb === "function" && cb({ error: "Salle introuvable." });
    if (room.hostId !== ref.playerId) return typeof cb === "function" && cb({ error: "Seul l'hôte peut relancer." });
    resetLobby(room);
    if (alivePlayers(room).length >= MIN_PLAYERS) {
      startGame(room);
    }
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("close_room", (_data, cb) => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) return typeof cb === "function" && cb({ error: "Pas dans une salle." });
    const room = rooms.get(ref.code);
    if (!room) return typeof cb === "function" && cb({ error: "Salle introuvable." });
    if (room.hostId !== ref.playerId) return typeof cb === "function" && cb({ error: "Seul l'hôte peut fermer." });
    io.to(room.code).emit("room_closed");
    for (const p of room.players.values()) {
      if (p.socketId) socketToRoom.delete(p.socketId);
    }
    destroyRoom(room.code);
    if (typeof cb === "function") cb({ ok: true });
  });

  socket.on("sync_state", (_data, cb) => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) return typeof cb === "function" && cb({ error: "Pas dans une salle." });
    const room = rooms.get(ref.code);
    if (!room) return typeof cb === "function" && cb({ error: "Salle introuvable." });
    const state = publicState(room, ref.playerId);
    if (typeof cb === "function") cb({ ok: true, state });
    socket.emit("game_state", state);
  });

  socket.on("disconnect", () => {
    leaveSocket(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Bomb Tag prêt sur http://localhost:${PORT}`);
});
