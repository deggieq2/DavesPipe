(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const startBtn = document.getElementById("start-btn");

  const BASE_WIDTH = 480;
  const BASE_HEIGHT = 720;
  const DPR = Math.max(1, window.devicePixelRatio || 1);

  const CONFIG = {
    gravity: 1600,
    flapVelocity: -520,
    obstacleSpeed: 180,
    obstacleGap: 180,
    obstacleWidth: 84,
    spawnInterval: 1.35,
    floorHeight: 70,
    ceilingPadding: 50,
    gapPadding: 120,
  };

  const state = {
    mode: "title",
    time: 0,
    lastSpawn: 0,
    score: 0,
    best: 0,
    globalBest: null,
    globalTop10: [],
    globalSubmitPending: false,
    player: {
      x: 150,
      y: 300,
      vy: 0,
      r: 18,
      tilt: 0,
    },
    obstacles: [],
    splashOffset: 0,
  };

  const GLOBAL_SCORE_URL = window.FLAPPY_DAVE_GLOBAL_SCORE_URL || "";
  const PLAYER_IMAGE_URL = window.FLAPPY_DAVE_PLAYER_IMAGE_URL || "assets/hazard.png";
  const PLAYER_IMAGE_FLIP_X = /hazard\.png$/i.test(PLAYER_IMAGE_URL);
  const playerImage = new Image();
  let playerImageReady = false;

  const logoImage = new Image();
  let logoImageReady = false;
  logoImage.onload = () => {
    logoImageReady = true;
  };
  logoImage.src = "assets/dave.png";

  playerImage.onload = () => {
    playerImageReady = true;
  };
  playerImage.src = PLAYER_IMAGE_URL;

  const leaderboardList = document.getElementById("leaderboard-list");

  function resizeCanvas() {
    canvas.width = Math.round(BASE_WIDTH * DPR);
    canvas.height = Math.round(BASE_HEIGHT * DPR);
    canvas.style.width = `${BASE_WIDTH}px`;
    canvas.style.height = `${BASE_HEIGHT}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function loadLocalBest() {
    const stored = Number(localStorage.getItem("flappy-dave-best"));
    if (!Number.isNaN(stored)) state.best = stored;
  }

  function saveLocalBest() {
    localStorage.setItem("flappy-dave-best", String(state.best));
  }

  function normalizeTop10(list) {
    return list
      .map((entry) => {
        if (typeof entry === "number") return { score: entry, name: "Dave" };
        if (!entry || typeof entry.score !== "number") return null;
        return { score: entry.score, name: entry.name || "Dave" };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  function renderLeaderboard() {
    if (!leaderboardList) return;
    leaderboardList.innerHTML = "";
    if (!state.globalTop10.length) {
      const empty = document.createElement("li");
      empty.textContent = "No scores yet";
      leaderboardList.appendChild(empty);
      return;
    }
    for (const entry of state.globalTop10) {
      const item = document.createElement("li");
      item.textContent = entry.name ? `${entry.name} — ${entry.score}` : `${entry.score}`;
      leaderboardList.appendChild(item);
    }
  }

  async function fetchGlobalLeaderboard() {
    if (!GLOBAL_SCORE_URL) return;
    try {
      const res = await fetch(GLOBAL_SCORE_URL, { method: "GET" });
      if (!res.ok) return;
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : data.top10;
      if (!Array.isArray(rawList)) return;
      state.globalTop10 = normalizeTop10(rawList);
      state.globalBest = state.globalTop10[0]?.score ?? null;
      renderLeaderboard();
    } catch (err) {
      // Ignore fetch failures; local best still works.
    }
  }

  async function submitGlobalScore(score) {
    if (!GLOBAL_SCORE_URL || state.globalSubmitPending) return;
    state.globalSubmitPending = true;
    try {
      await fetch(GLOBAL_SCORE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });
      await fetchGlobalLeaderboard();
    } catch (err) {
      // Ignore submit failures.
    } finally {
      state.globalSubmitPending = false;
    }
  }

  function resetPlayer() {
    state.player.x = 150;
    state.player.y = 300;
    state.player.vy = 0;
    state.player.tilt = 0;
  }

  function resetGame() {
    state.time = 0;
    state.lastSpawn = 0;
    state.score = 0;
    state.obstacles = [];
    resetPlayer();
  }

  function startGame() {
    resetGame();
    state.mode = "play";
  }

  function endGame() {
    state.mode = "gameover";
    if (state.score > state.best) {
      state.best = state.score;
      saveLocalBest();
    }
    if (state.score > 0) {
      submitGlobalScore(state.score);
    }
    if (state.globalBest !== null && state.score > state.globalBest) {
      state.globalBest = state.score;
    }
  }

  function flap() {
    if (state.mode === "title") {
      startGame();
    }
    if (state.mode !== "play") return;
    state.player.vy = CONFIG.flapVelocity;
  }

  function spawnObstacle() {
    const gapCenter =
      CONFIG.ceilingPadding +
      CONFIG.gapPadding +
      Math.random() *
        (BASE_HEIGHT -
          CONFIG.floorHeight -
          CONFIG.ceilingPadding -
          CONFIG.gapPadding * 2);
    state.obstacles.push({
      x: BASE_WIDTH + 40,
      gapCenter,
      gapSize: CONFIG.obstacleGap,
      width: CONFIG.obstacleWidth,
      scored: false,
    });
  }

  function update(dt) {
    state.time += dt;
    if (state.mode !== "play") {
      state.splashOffset = (state.splashOffset + dt * 0.7) % (Math.PI * 2);
      return;
    }

    state.player.vy += CONFIG.gravity * dt;
    state.player.y += state.player.vy * dt;
    state.player.tilt = Math.max(-0.6, Math.min(0.9, state.player.vy / 600));

    if (state.time - state.lastSpawn > CONFIG.spawnInterval) {
      state.lastSpawn = state.time;
      spawnObstacle();
    }

    for (const obstacle of state.obstacles) {
      obstacle.x -= CONFIG.obstacleSpeed * dt;
      if (!obstacle.scored && obstacle.x + obstacle.width < state.player.x) {
        obstacle.scored = true;
        state.score += 1;
      }
    }

    state.obstacles = state.obstacles.filter((o) => o.x + o.width > -20);

    if (state.player.y - state.player.r < 0) endGame();
    if (state.player.y + state.player.r > BASE_HEIGHT - CONFIG.floorHeight)
      endGame();

    for (const obstacle of state.obstacles) {
      const left = obstacle.x;
      const right = obstacle.x + obstacle.width;
      if (state.player.x + state.player.r > left && state.player.x - state.player.r < right) {
        const gapTop = obstacle.gapCenter - obstacle.gapSize / 2;
        const gapBottom = obstacle.gapCenter + obstacle.gapSize / 2;
        if (state.player.y - state.player.r < gapTop || state.player.y + state.player.r > gapBottom) {
          endGame();
          break;
        }
      }
    }
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, BASE_HEIGHT);
    gradient.addColorStop(0, "#f9f3e7");
    gradient.addColorStop(0.45, "#f0ddc6");
    gradient.addColorStop(1, "#e2c4a4");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    ctx.strokeStyle = "rgba(64, 43, 28, 0.12)";
    ctx.lineWidth = 1;
    const tileSize = 48;
    for (let x = 0; x < BASE_WIDTH; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, BASE_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < BASE_HEIGHT; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(BASE_WIDTH, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#3f2a1d";
    ctx.fillRect(0, BASE_HEIGHT - CONFIG.floorHeight, BASE_WIDTH, CONFIG.floorHeight);
    ctx.fillStyle = "#5c3b26";
    ctx.fillRect(0, BASE_HEIGHT - CONFIG.floorHeight, BASE_WIDTH, 16);

    ctx.fillStyle = "#cfa24c";
    for (let x = 20; x < BASE_WIDTH; x += 90) {
      ctx.beginPath();
      ctx.arc(x, BASE_HEIGHT - 32, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawObstacle(obstacle) {
    const gapTop = obstacle.gapCenter - obstacle.gapSize / 2;
    const gapBottom = obstacle.gapCenter + obstacle.gapSize / 2;
    drawPipeSegment(obstacle.x, 0, obstacle.width, gapTop);
    drawPipeSegment(
      obstacle.x,
      gapBottom,
      obstacle.width,
      BASE_HEIGHT - CONFIG.floorHeight - gapBottom
    );
  }

  function drawPipeSegment(x, y, w, h) {
    if (h <= 0) return;
    const capHeight = Math.min(26, Math.max(18, h * 0.18));
    const bodyGradient = ctx.createLinearGradient(x, y, x + w, y);
    bodyGradient.addColorStop(0, "#1d6b66");
    bodyGradient.addColorStop(0.5, "#2f9a90");
    bodyGradient.addColorStop(1, "#13504b");
    ctx.fillStyle = bodyGradient;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = "#0f3d39";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#4fb6aa";
    ctx.fillRect(x + 8, y + 4, 8, h - 8);

    const capY = y === 0 ? y + h - capHeight : y;
    ctx.fillStyle = "#2a8e85";
    ctx.fillRect(x - 6, capY, w + 12, capHeight);
    ctx.strokeStyle = "#0f3d39";
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 6, capY, w + 12, capHeight);
  }

  function drawPlayer() {
    const { x, y, r, tilt } = state.player;

    if (playerImageReady) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      if (PLAYER_IMAGE_FLIP_X) {
        ctx.scale(-1, 1);
      }
      ctx.drawImage(playerImage, -r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    ctx.fillStyle = "#2b7a78";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f5d7b7";
    ctx.beginPath();
    ctx.arc(r * 0.35, -r * 0.2, r * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1b1b1b";
    ctx.beginPath();
    ctx.arc(r * 0.55, -r * 0.3, r * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d0a24a";
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.6, r * 0.9, r * 0.5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-r * 0.9, -r * 0.6, r * 1.8, r * 0.25);

    ctx.strokeStyle = "#b2b2b2";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, r * 0.4);
    ctx.lineTo(-r * 1.35, r * 1.1);
    ctx.stroke();

    ctx.restore();
  }

  function drawUI() {
    ctx.fillStyle = "#2b1c12";
    ctx.font = "bold 22px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Score: ${state.score}`, 20, 34);
  }

  function drawTitle() {
    ctx.fillStyle = "#2b1c12";
    ctx.textAlign = "center";
    ctx.font = "18px 'Trebuchet MS', sans-serif";
    ctx.fillText("Tap / Space to flap", BASE_WIDTH / 2, 230);
    ctx.fillText("F toggles fullscreen", BASE_WIDTH / 2, 258);

    ctx.font = "16px 'Trebuchet MS', sans-serif";
    ctx.fillText("Avoid the pipes", BASE_WIDTH / 2, 300);

    if (state.best > 0) {
      ctx.fillText(`Local best: ${state.best}`, BASE_WIDTH / 2, 340);
    }
    if (state.globalBest !== null) {
      ctx.fillText(`Global best: ${state.globalBest}`, BASE_WIDTH / 2, 366);
    }
  }

  function drawGameOver() {
    ctx.fillStyle = "rgba(35, 24, 18, 0.5)";
    ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

    ctx.fillStyle = "#f8ead6";
    ctx.font = "bold 36px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Wipeout!", BASE_WIDTH / 2, 250);

    ctx.font = "20px 'Trebuchet MS', sans-serif";
    ctx.fillText(`Score: ${state.score}`, BASE_WIDTH / 2, 300);
    ctx.fillText(`Local best: ${state.best}`, BASE_WIDTH / 2, 330);
    if (state.globalBest !== null) {
      ctx.fillText(`Global best: ${state.globalBest}`, BASE_WIDTH / 2, 360);
    }
    ctx.fillText("Press Space or click to retry", BASE_WIDTH / 2, 410);
  }

  function render() {
    drawBackground();
    for (const obstacle of state.obstacles) {
      drawObstacle(obstacle);
    }
    drawPlayer();
    if (state.mode === "play") drawUI();
    if (state.mode === "title") drawTitle();
    if (state.mode === "gameover") drawGameOver();
  }

  function gameStep(dt) {
    update(dt);
    render();
  }

  let lastTime = 0;
  function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const delta = Math.min(0.033, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    gameStep(delta);
    requestAnimationFrame(loop);
  }

  function handleInput() {
    if (state.mode === "gameover") {
      startGame();
      return;
    }
    flap();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      canvas.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  function bindEvents() {
    canvas.addEventListener("pointerdown", handleInput);
    startBtn.addEventListener("click", handleInput);

    window.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        event.preventDefault();
        handleInput();
      }
      if (event.code === "KeyF") {
        toggleFullscreen();
      }
      if (event.code === "KeyR" && state.mode === "gameover") {
        startGame();
      }
    });

    document.addEventListener("fullscreenchange", () => {
      resizeCanvas();
    });
  }

  window.advanceTime = (ms) => {
    const step = 1 / 60;
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) {
      gameStep(step);
    }
  };

  window.render_game_to_text = () => {
    const payload = {
      mode: state.mode,
      score: state.score,
      best: state.best,
      globalBest: state.globalBest,
      coordinateSystem: {
        origin: "top-left",
        x: "right",
        y: "down",
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
      },
      player: {
        x: state.player.x,
        y: state.player.y,
        vy: state.player.vy,
        r: state.player.r,
      },
      obstacles: state.obstacles.map((o) => ({
        x: o.x,
        gapCenter: o.gapCenter,
        gapSize: o.gapSize,
        width: o.width,
      })),
      floorHeight: CONFIG.floorHeight,
    };
    return JSON.stringify(payload);
  };

  resizeCanvas();
  loadLocalBest();
  renderLeaderboard();
  fetchGlobalLeaderboard();
  bindEvents();
  requestAnimationFrame(loop);
})();
