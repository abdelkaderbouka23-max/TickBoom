(() => {
  const socket = io({ transports: ["websocket", "polling"] });
  const VOTE_MS = 9000;

  const screens = {
    home: document.getElementById("screen-home"),
    lobby: document.getElementById("screen-lobby"),
    vote: document.getElementById("screen-vote"),
    game: document.getElementById("screen-game"),
    boom: document.getElementById("screen-boom"),
    victory: document.getElementById("screen-victory")
  };

  const els = {
    playerName: document.getElementById("playerName"),
    joinCode: document.getElementById("joinCode"),
    createBtn: document.getElementById("createBtn"),
    joinBtn: document.getElementById("joinBtn"),
    homeForm: document.getElementById("homeForm"),
    roomCode: document.getElementById("roomCode"),
    playerGrid: document.getElementById("playerGrid"),
    hostNote: document.getElementById("hostNote"),
    readyLine: document.getElementById("readyLine"),
    startBtn: document.getElementById("startBtn"),
    copyCodeBtn: document.getElementById("copyCodeBtn"),
    leaveLobbyBtn: document.getElementById("leaveLobbyBtn"),
    closeRoomBtn: document.getElementById("closeRoomBtn"),
    themeGrid: document.getElementById("themeGrid"),
    voteClock: document.getElementById("voteClock"),
    voteBar: document.getElementById("voteBar"),
    voteKicker: document.getElementById("voteKicker"),
    voteFoot: document.getElementById("voteFoot"),
    timer: document.getElementById("timer"),
    timerFill: document.getElementById("timerFill"),
    whoChip: document.getElementById("whoChip"),
    aliveChip: document.getElementById("aliveChip"),
    bomb: document.getElementById("bomb"),
    particles: document.getElementById("particles"),
    youBanner: document.getElementById("youBanner"),
    questCard: document.getElementById("questCard"),
    waitCard: document.getElementById("waitCard"),
    questKicker: document.getElementById("questKicker"),
    questQuestion: document.getElementById("questQuestion"),
    questVisual: document.getElementById("questVisual"),
    questAnswers: document.getElementById("questAnswers"),
    boomSub: document.getElementById("boomSub"),
    winnerName: document.getElementById("winnerName"),
    winLine: document.getElementById("winLine"),
    winStats: document.getElementById("winStats"),
    rematchBtn: document.getElementById("rematchBtn"),
    leaveWinBtn: document.getElementById("leaveWinBtn"),
    muteBtn: document.getElementById("muteBtn"),
    cover: document.getElementById("cover"),
    toast: document.getElementById("toast")
  };

  const ICONS = {
    quiz: '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 4.2 1.8c-.8.7-1.7 1.2-1.7 2.7"/><circle cx="12" cy="17" r=".8" fill="currentColor"/></svg>',
    brands: '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 14l3-6 3 6M9.2 12h3.6"/></svg>',
    memory: '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="7" cy="12" r="3"/><rect x="13" y="9" width="6" height="6" rx="1"/><path d="M7 15v4M16 15v4"/></svg>',
    visual: '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/></svg>'
  };

  const SESSION_KEY = "bombtag-session";
  const MUTE_KEY = "bombtag-mute";

  const state = {
    playerId: null,
    name: "",
    room: null,
    lastQuestId: null,
    lastHolder: null,
    muted: localStorage.getItem(MUTE_KEY) === "1",
    cover: false,
    audio: null,
    answering: false,
    voteBuilt: false,
    lastPhase: null
  };

  function sessionSave() {
    if (!state.playerId || !state.room) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      playerId: state.playerId,
      name: state.name,
      code: state.room.code
    }));
  }
  function sessionLoad() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); }
    catch { return null; }
  }
  function sessionClear() { sessionStorage.removeItem(SESSION_KEY); }

  function showToast(text) {
    els.toast.hidden = false;
    els.toast.textContent = text;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { els.toast.hidden = true; }, 1700);
  }

  function press(btn) {
    if (!btn) return;
    btn.classList.add("is-pressed");
    setTimeout(() => btn.classList.remove("is-pressed"), 110);
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([key, node]) => {
      const on = key === name;
      node.classList.toggle("active", on);
      node.hidden = !on;
    });
  }

  function audioCtx() {
    if (state.cover || state.muted) return null;
    if (!state.audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      state.audio = new Ctx();
    }
    if (state.audio.state === "suspended") state.audio.resume();
    return state.audio;
  }
  function beep(freq, dur, type, gain) {
    const ctx = audioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || "triangle";
    osc.frequency.value = freq;
    g.gain.value = gain || 0.04;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.stop(ctx.currentTime + dur);
  }
  const sfx = {
    click() { beep(520, 0.06, "sine", 0.03); },
    good() { beep(620, 0.08, "triangle"); setTimeout(() => beep(880, 0.1, "sine"), 70); },
    bad() { beep(170, 0.14, "sawtooth", 0.04); },
    catch() { beep(280, 0.07, "triangle"); setTimeout(() => beep(500, 0.09, "sine"), 60); },
    tick() { beep(840, 0.025, "sine", 0.015); },
    danger() { beep(210, 0.07, "triangle", 0.03); },
    boom() { beep(80, 0.32, "sawtooth", 0.06); },
    win() { [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.14, "sine", 0.04), i * 100)); },
    out() { beep(180, 0.18, "triangle", 0.04); },
    vote() { beep(440, 0.05, "sine", 0.03); }
  };

  function updateMuteUi() {
    els.muteBtn.setAttribute("aria-label", state.muted ? "Unmute" : "Mute");
    els.muteBtn.style.opacity = state.muted || state.cover ? "0.55" : "1";
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function geoEl(shape, color) {
    const n = document.createElement("span");
    n.className = `geo ${shape}`;
    n.style.setProperty("--c", color || "#5B8CFF");
    return n;
  }

  function renderPlayers(room, mount) {
    mount.innerHTML = "";
    room.players.forEach((p) => {
      const card = document.createElement("article");
      card.className = "player-card"
        + (p.id === state.playerId ? " is-you" : "")
        + (!p.alive ? " is-out" : "");
      card.innerHTML = `
        <div class="ava" style="background:${p.color}">${escapeHtml(p.avatar || p.initials || "?")}</div>
        <strong>${escapeHtml(p.name)}</strong>
        <small>${p.isHost ? "Host" : p.connected ? "Ready" : "Away"}</small>
      `;
      mount.appendChild(card);
    });
  }

  function renderLobby(room) {
    showScreen("lobby");
    document.body.dataset.phase = "lobby";
    document.body.dataset.danger = "calm";
    state.voteBuilt = false;
    els.roomCode.textContent = room.code;
    const youHost = room.hostId === state.playerId;
    const connected = room.players.filter((p) => p.connected);
    els.startBtn.hidden = !youHost;
    els.closeRoomBtn.hidden = !youHost;
    els.startBtn.disabled = connected.length < 2;
    els.readyLine.textContent = `${connected.length} player${connected.length === 1 ? "" : "s"} ready`;
    els.hostNote.textContent = youHost ? "Start when the lobby feels full." : "Waiting for the host.";
    renderPlayers(room, els.playerGrid);
  }

  function themeMeta(id, themes) {
    return (themes || []).find((t) => t.id === id) || { id, title: id, description: "" };
  }

  function renderVote(room, extra = {}) {
    showScreen("vote");
    document.body.dataset.phase = room.phase;
    document.body.dataset.danger = "calm";
    const locked = room.phase === "theme_reveal";
    const remain = Math.max(0, room.voteRemaining || 0);
    els.voteClock.textContent = locked ? "0.0" : remain.toFixed(1);
    els.voteBar.style.transform = `scaleX(${locked ? 0 : Math.min(1, remain / (VOTE_MS / 1000))})`;
    els.voteKicker.textContent = locked ? "Votes locked" : "Choose your challenge";
    els.voteFoot.textContent = locked
      ? "Selecting the winning theme…"
      : (room.yourVote ? "Vote registered." : "One vote per player.");

    const themes = room.themes || [];
    if (!state.voteBuilt || extra.event === "vote_started" || extra.event === "votes_locked") {
      els.themeGrid.innerHTML = "";
      themes.forEach((t) => {
        const n = (room.votes && room.votes[t.id]) || 0;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "theme-card";
        btn.dataset.id = t.id;
        btn.innerHTML = `
          <span class="vote-count" data-count>${n} vote${n === 1 ? "" : "s"}</span>
          <div class="theme-ico">${ICONS[t.id] || ""}</div>
          <h3>${escapeHtml(t.title)}</h3>
          <p>${escapeHtml(t.description)}</p>
        `;
        btn.addEventListener("click", () => {
          if (locked || room.yourVote) return;
          press(btn);
          sfx.vote();
          socket.emit("vote_theme", { themeId: t.id }, (res) => {
            if (res?.error) showToast(res.error);
          });
        });
        els.themeGrid.appendChild(btn);
      });
      state.voteBuilt = true;
    }

    [...els.themeGrid.children].forEach((card) => {
      const id = card.dataset.id;
      const n = (room.votes && room.votes[id]) || 0;
      const count = card.querySelector("[data-count]");
      if (count) count.textContent = `${n} vote${n === 1 ? "" : "s"}`;
      card.classList.toggle("selected", room.yourVote === id);
      card.classList.toggle("locked", locked || Boolean(room.yourVote));
      if (locked) {
        card.classList.toggle("winner", id === room.theme);
        card.classList.toggle("lost", id !== room.theme);
      }
    });
  }

  function spawnParticles() {
    els.particles.innerHTML = "";
    for (let i = 0; i < 8; i += 1) {
      const s = document.createElement("span");
      s.style.left = "48%";
      s.style.top = "42%";
      s.style.setProperty("--x", `${(Math.random() * 140) - 70}px`);
      s.style.setProperty("--y", `${(Math.random() * 120) - 80}px`);
      els.particles.appendChild(s);
    }
    setTimeout(() => { els.particles.innerHTML = ""; }, 700);
  }

  function flashYou() {
    els.youBanner.hidden = false;
    els.youBanner.classList.remove("turn-banner");
    void els.youBanner.offsetWidth;
    els.youBanner.classList.add("turn-banner");
    spawnParticles();
    setTimeout(() => { els.youBanner.hidden = true; }, 820);
  }

  function renderTimer(room) {
    const sec = Math.max(0, room.remaining);
    els.timer.textContent = sec.toFixed(1);
    els.timer.className = "timer-num " + (room.danger || "calm");
    const ratio = Math.max(0, Math.min(1, sec / 20));
    els.timerFill.setAttribute("width", String(120 * ratio));
    els.bomb.classList.remove("warm", "hot", "critical");
    if (room.danger && room.danger !== "calm") els.bomb.classList.add(room.danger);
    if (room.danger === "critical" && !state.cover) sfx.danger();
    else if (room.danger === "hot" && Math.random() < 0.06) sfx.tick();
  }

  function shapeRow(items) {
    const row = document.createElement("div");
    row.className = "mem-row";
    items.forEach((item) => row.appendChild(geoEl(item.shape, item.color)));
    return row;
  }

  function renderQuest(quest) {
    els.waitCard.hidden = true;
    els.questCard.hidden = false;
    els.questCard.classList.remove("wrong", "ok");
    els.questQuestion.textContent = quest.question;
    els.questVisual.innerHTML = "";
    els.questAnswers.innerHTML = "";
    els.questAnswers.className = "answers";

    const kickers = {
      quiz: "Quick quiz",
      brands: "Brand guess",
      memory: "Memory",
      visual: "Visual"
    };
    els.questKicker.textContent = kickers[quest.type] || "Your challenge";

    if (quest.type === "brands" && quest.extra.logo) {
      const frame = document.createElement("div");
      frame.className = "logo-frame";
      const img = document.createElement("img");
      img.src = quest.extra.logo;
      img.alt = "Brand mark";
      frame.appendChild(img);
      els.questVisual.appendChild(frame);
    }

    if (quest.type === "visual" && quest.extra.variant === "color" && quest.extra.swatch) {
      const d = document.createElement("div");
      d.className = "swatch";
      d.style.background = quest.extra.swatch;
      els.questVisual.appendChild(d);
    }

    if ((quest.type === "memory" || quest.extra.variant === "pattern") && quest.extra.combo) {
      if (quest.type === "memory" && quest.phase === "show") {
        els.questQuestion.textContent = "Memorize this";
        els.questVisual.appendChild(shapeRow(quest.extra.combo));
        return;
      }
      if (quest.extra.variant === "pattern") {
        const seq = quest.extra.combo.concat([{ shape: "circle", color: "transparent" }]);
        const row = shapeRow(quest.extra.combo);
        const q = document.createElement("span");
        q.style.fontWeight = "800";
        q.style.fontSize = "22px";
        q.textContent = "?";
        row.appendChild(q);
        els.questVisual.appendChild(row);
      }
    }

    if (quest.type === "visual" && quest.extra.variant === "spot") {
      const wrap = document.createElement("div");
      wrap.style.display = "grid";
      wrap.style.gap = "10px";
      wrap.appendChild(shapeRow(quest.extra.left || []));
      wrap.appendChild(shapeRow(quest.extra.right || []));
      els.questVisual.appendChild(wrap);
    }

    if (quest.type === "visual" && quest.extra.variant === "odd") {
      const grid = document.createElement("div");
      grid.className = "odd-grid";
      (quest.extra.cells || []).forEach((cell, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        btn.appendChild(geoEl(cell.shape, cell.color));
        btn.addEventListener("click", () => {
          press(btn);
          sfx.click();
          submitAnswer(index, btn);
        });
        grid.appendChild(btn);
      });
      els.questVisual.appendChild(grid);
      return;
    }

    if (quest.type === "visual" && quest.extra.variant === "tap") {
      const wait = quest.phase !== "go";
      els.questQuestion.textContent = wait ? "Wait…" : "Tap the highlight";
      const grid = document.createElement("div");
      grid.className = "tap-grid";
      (quest.extra.cells || []).forEach((cell, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell" + (quest.extra.active === index ? " active" : "");
        btn.appendChild(geoEl(cell.shape, quest.extra.active === index ? "#083028" : cell.color));
        btn.addEventListener("click", () => {
          press(btn);
          sfx.click();
          submitAnswer(index, btn);
        });
        grid.appendChild(btn);
      });
      els.questVisual.appendChild(grid);
      return;
    }

    const colorMode = quest.extra.colorAnswers;
    (quest.answers || []).forEach((label, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ans" + (colorMode ? " swatch-ans" : "");
      if (colorMode && /^#/.test(label)) {
        btn.style.background = label;
        btn.textContent = "";
        btn.setAttribute("aria-label", "Color option");
      } else {
        btn.textContent = label;
      }
      btn.addEventListener("click", () => {
        press(btn);
        sfx.click();
        submitAnswer(index, btn);
      });
      els.questAnswers.appendChild(btn);
    });
  }

  function renderWait(room) {
    els.questCard.hidden = true;
    els.waitCard.hidden = false;
    const theme = themeMeta(room.theme, room.themes);
    els.waitCard.querySelector(".quest-kicker").textContent = theme.title || "Live";
    document.getElementById("waitText").textContent = room.spectatorHint || `${room.bombHolderName} has the bomb.`;
  }

  function renderGame(room, extra = {}) {
    showScreen("game");
    document.body.dataset.phase = "playing";
    document.body.dataset.danger = room.danger || "calm";
    renderTimer(room);
    const alive = room.players.filter((p) => p.alive).length;
    els.aliveChip.textContent = `${alive} alive`;
    els.whoChip.textContent = room.youAreHolder ? "Your move" : (room.bombHolderName || "Bomb");

    if (extra.event === "bomb_received" || (room.youAreHolder && state.lastHolder !== room.bombHolderId)) {
      els.bomb.classList.remove("pass");
      els.bomb.classList.add("catch");
      setTimeout(() => els.bomb.classList.remove("catch"), 560);
      if (room.youAreHolder) {
        sfx.catch();
        flashYou();
      }
    }
    state.lastHolder = room.bombHolderId;

    if (room.youAreHolder && room.quest) {
      if (room.quest.id !== state.lastQuestId || extra.event === "quest_go" || extra.event === "quest_ready") {
        state.lastQuestId = room.quest.id;
        state.answering = false;
        renderQuest(room.quest);
      }
    } else {
      state.lastQuestId = null;
      renderWait(room);
    }
  }

  function renderBoom(room) {
    showScreen("boom");
    document.body.dataset.phase = "exploding";
    document.body.classList.add("shake-screen");
    setTimeout(() => document.body.classList.remove("shake-screen"), 420);
    els.boomSub.textContent = `${room.eliminatedName || "Player"} is out`;
    if (state.lastPhase !== "exploding") sfx.boom();
  }

  function fmtMs(ms) {
    if (ms == null) return "—";
    return `${(ms / 1000).toFixed(1)}s`;
  }

  function renderVictory(room) {
    showScreen("victory");
    document.body.dataset.phase = "victory";
    document.body.dataset.danger = "calm";
    const winner = room.players.find((p) => p.id === room.winnerId);
    els.winnerName.textContent = (winner?.name || room.winnerName || "Player").toUpperCase();
    els.winLine.textContent = winner?.id === state.playerId
      ? "Last player standing"
      : `${winner?.name || "A player"} takes the round`;
    const you = room.players.find((p) => p.id === state.playerId);
    const s = you?.stats || {};
    els.winStats.innerHTML = `
      <div class="stat"><b>${s.questsSucceeded || 0}</b><span>Challenges cleared</span></div>
      <div class="stat"><b>${s.bombsReceived || 0}</b><span>Bombs survived</span></div>
      <div class="stat"><b>${fmtMs(s.fastestMs)}</b><span>Fastest clear</span></div>
    `;
    els.rematchBtn.hidden = room.hostId !== state.playerId;
    if (state.lastPhase !== "victory") sfx.win();
  }

  function applyState(room, extra = {}) {
    state.room = room;
    sessionSave();
    if (!room || state.cover) {
      state.lastPhase = room?.phase || null;
      return;
    }
    if (room.phase === "lobby") renderLobby(room);
    else if (room.phase === "voting" || room.phase === "theme_reveal") renderVote(room, extra);
    else if (room.phase === "exploding") renderBoom(room);
    else if (room.phase === "victory") renderVictory(room);
    else renderGame(room, extra);
    state.lastPhase = room.phase;
  }

  function submitAnswer(answerIndex, btn) {
    if (!state.room || state.answering) return;
    if (!state.room.youAreHolder || !state.room.quest) return;
    state.answering = true;
    socket.emit("submit_quest", {
      questId: state.room.quest.id,
      answerIndex
    }, (res) => {
      if (res?.error) {
        state.answering = false;
        showToast(res.error);
        return;
      }
      if (res && res.correct === false) {
        state.answering = false;
        sfx.bad();
        els.questCard.classList.remove("wrong");
        void els.questCard.offsetWidth;
        els.questCard.classList.add("wrong");
        if (btn) {
          btn.classList.add("bad");
          setTimeout(() => btn.classList.remove("bad"), 360);
        }
      }
    });
  }

  function createRoom() {
    const name = els.playerName.value.trim();
    if (!name) { els.playerName.focus(); return; }
    state.name = name;
    socket.emit("create_room", { name }, (res) => {
      if (res?.error) return showToast(res.error);
      state.playerId = res.playerId;
      applyState(res.state);
    });
  }

  function joinRoom(code, name, playerId) {
    const n = (name || els.playerName.value).trim();
    const c = String(code || els.joinCode.value).trim().toUpperCase();
    if (!n) { els.playerName.focus(); showToast("Enter a name"); return; }
    if (!c || c.length < 4) { els.joinCode.focus(); showToast("4-character code"); return; }
    state.name = n;
    socket.emit("join_room", { code: c, name: n, playerId }, (res) => {
      if (res?.error) { showToast(res.error); return; }
      state.playerId = res.playerId;
      applyState(res.state);
    });
  }

  function leaveRoom() {
    socket.emit("leave_room");
    sessionClear();
    state.playerId = null;
    state.room = null;
    state.voteBuilt = false;
    showScreen("home");
    document.body.dataset.phase = "home";
  }

  function tryReconnect() {
    const saved = sessionLoad();
    if (!saved?.playerId || !saved.code) return;
    if (saved.name) els.playerName.value = saved.name;
    joinRoom(saved.code, saved.name, saved.playerId);
  }

  els.homeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    press(els.createBtn);
    sfx.click();
    createRoom();
  });
  els.joinBtn.addEventListener("click", () => {
    press(els.joinBtn);
    sfx.click();
    joinRoom();
  });
  els.joinCode.addEventListener("input", () => {
    els.joinCode.value = els.joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  });
  els.copyCodeBtn.addEventListener("click", async () => {
    press(els.copyCodeBtn);
    sfx.click();
    const code = state.room?.code || "";
    try {
      await navigator.clipboard.writeText(code);
      showToast("Copied");
    } catch { showToast(code); }
  });
  els.startBtn.addEventListener("click", () => {
    press(els.startBtn);
    sfx.click();
    socket.emit("start_game", {}, (res) => { if (res?.error) showToast(res.error); });
  });
  els.leaveLobbyBtn.addEventListener("click", () => { press(els.leaveLobbyBtn); sfx.click(); leaveRoom(); });
  els.closeRoomBtn.addEventListener("click", () => {
    press(els.closeRoomBtn);
    sfx.click();
    socket.emit("close_room", {}, (res) => {
      if (res?.error) showToast(res.error);
      else leaveRoom();
    });
  });
  els.rematchBtn.addEventListener("click", () => {
    press(els.rematchBtn);
    sfx.click();
    socket.emit("rematch", {}, (res) => { if (res?.error) showToast(res.error); });
  });
  els.leaveWinBtn.addEventListener("click", () => { sfx.click(); leaveRoom(); });
  els.muteBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    localStorage.setItem(MUTE_KEY, state.muted ? "1" : "0");
    updateMuteUi();
    if (!state.muted) sfx.click();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    state.cover = !state.cover;
    els.cover.hidden = !state.cover;
    updateMuteUi();
    if (!state.cover && state.room) applyState(state.room);
  });

  socket.on("connect", () => {
    if (!state.playerId) tryReconnect();
    else socket.emit("sync_state");
  });
  socket.on("game_state", (room) => applyState(room, { event: room.event }));
  socket.on("quest_result", (data) => {
    if (data.playerId && data.playerId !== state.playerId) return;
    if (data.correct) {
      sfx.good();
      els.questCard.classList.add("ok");
      els.bomb.classList.add("pass");
      spawnParticles();
    }
  });
  socket.on("pass_bomb", () => els.bomb.classList.add("pass"));
  socket.on("player_eliminated", () => sfx.out());
  socket.on("game_over", (room) => applyState(room));
  socket.on("room_closed", () => { showToast("Room closed"); leaveRoom(); });
  socket.on("left_room", () => showScreen("home"));

  updateMuteUi();
  const saved = sessionLoad();
  if (saved?.name) els.playerName.value = saved.name;
})();
