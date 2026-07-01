// Log a message to the console to ensure the script is linked correctly
console.log('JavaScript file is linked correctly.');

//Game State
const gameState = {
  score: 0,
  lives: 6, //Easy is 6, Medium is 4, Hard is 2
  timeLeft: 90,
  isRunning: false,
  isInvincible: false,
  cleanRatio: 0.7, //Easy is 0.7, Medium is 0.5, Hard is 0.3
};

//Screen Management
const screens = document.querySelectorAll(".screen");
const charityFooter = document.getElementById("charity-footer");

function showScreen(screenId) {
  screens.forEach((s) => s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
  charityFooter.style.display = screenId === "game-screen" ? "none" : "flex";
}

// Difficulty Buttons
document.getElementById("play-easy-btn").addEventListener("click", () => {
    startGame("easy");
});
document.getElementById("play-medium-btn").addEventListener("click", () => {
    startGame("medium");
});
document.getElementById("play-hard-btn").addEventListener("click", () => {
    startGame("hard");
});


document.getElementById("play-again-btn").addEventListener("click", () => {
  showScreen("title-screen");
});

//Player
const arena = document.getElementById("arena");
const playerEl = document.getElementById("player");

const player = {
  x: 0, // set dynamically in startGame() once arena is visible
  y: 0,
  size: 30,
  speed: 200,
};

//Keyboard Input
const keysHeld = {};

document.addEventListener("keydown", (e) => {
  keysHeld[e.key] = true;
});
document.addEventListener("keyup", (e) => {
  keysHeld[e.key] = false;
});

//Joystick (For Mobile Devices)
const joystickBase = document.getElementById("joystick-base");
const joystickKnob = document.getElementById("joystick-knob");

const joystick = {
  active: false,
  dirX: 0,
  dirY: 0,
};

joystickBase.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    joystick.active = true;
    updateJoystick(e.touches[0]);
  },
  { passive: false },
);

joystickBase.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    updateJoystick(e.touches[0]);
  },
  { passive: false },
);

joystickBase.addEventListener("touchend", resetJoystick);
joystickBase.addEventListener("touchcancel", resetJoystick);

function updateJoystick(touch) {
  const rect = joystickBase.getBoundingClientRect();
  const baseCX = rect.left + rect.width / 2;
  const baseCY = rect.top + rect.height / 2;

  // Vector from joystick center to the touch point
  const rawDX = touch.clientX - baseCX;
  const rawDY = touch.clientY - baseCY;
  const distance = Math.sqrt(rawDX * rawDX + rawDY * rawDY);

  const joystickRadius = rect.width / 2; // 50px
  const knobHalfSize = 21; // half of the knob's 42px diameter

  // --- Visual: keep the knob inside the base circle ---
  const maxKnobTravel = joystickRadius - knobHalfSize;
  const clampedDist = Math.min(distance, maxKnobTravel);
  const angle = distance > 0 ? Math.atan2(rawDY, rawDX) : 0;
  joystickKnob.style.transform = `translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;

  // --- Direction: normalize to -1..1 based on joystick radius ---
  // Dividing by joystickRadius means the finger reaching the edge = full speed.
  joystick.dirX = Math.max(-1, Math.min(1, rawDX / joystickRadius));
  joystick.dirY = Math.max(-1, Math.min(1, rawDY / joystickRadius));
}

function resetJoystick() {
  joystick.active = false;
  joystick.dirX = 0;
  joystick.dirY = 0;
  joystickKnob.style.transform = "translate(0px, 0px)";
}

//Droplets
const droplets = [];
let spawnInterval = null;

function spawnDroplet() {
  if (!gameState.isRunning) return;

  // Use cleanRatio set by difficulty selection
  const type = Math.random() < gameState.cleanRatio ? "clean" : "polluted";
  const size = 24;

  const el = document.createElement("div");
  el.classList.add(type === "clean" ? "droplet-clean" : "droplet-polluted");

  const x = Math.random() * (arena.offsetWidth - size);
  const y = Math.random() * (arena.offsetHeight - size);

  el.style.left = x + "px";
  el.style.top = y + "px";

  arena.appendChild(el);

  const droplet = { x, y, size, type, element: el };
  droplets.push(droplet);

  setTimeout(() => {
    removeDroplet(droplet);
  }, 10000);
}

function removeDroplet(droplet) {
  const index = droplets.indexOf(droplet);
  if (index !== -1) {
    droplets.splice(index, 1);
    droplet.element.remove();
  }
}

function clearAllDroplets() {
  for (let i = droplets.length - 1; i >= 0; i--) {
    removeDroplet(droplets[i]);
  }
}

function startSpawning() {
  clearInterval(spawnInterval);
  spawnDroplet();
  spawnInterval = setInterval(spawnDroplet, 750);
}

//Collision
function checkCollisions() {
  for (let i = droplets.length - 1; i >= 0; i--) {
    const d = droplets[i];

    const playerCX = player.x + player.size / 2;
    const playerCY = player.y + player.size / 2;
    const dropletCX = d.x + d.size / 2;
    const dropletCY = d.y + d.size / 2;

    const dx = playerCX - dropletCX;
    const dy = playerCY - dropletCY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDist = player.size / 2 + d.size / 2;

    if (distance < minDist) {
      if (d.type === "clean") {
        gameState.score += 10;
        updateHUD();
        removeDroplet(d);
      } else if (d.type === "polluted" && !gameState.isInvincible) {
        removeDroplet(d);
        loseLife();
      }
    }
  }
}

//Lives and Invincibility
function loseLife() {
  gameState.lives -= 1;
  updateHUD();

  if (gameState.lives <= 0) {
    gameOver();
    return;
  }

  gameState.isInvincible = true;
  playerEl.classList.add("player-invincible");

  setTimeout(() => {
    gameState.isInvincible = false;
    playerEl.classList.remove("player-invincible");
  }, 2000);
}

//Game Loop
let lastTime = 0;
let animFrameId = null;

function gameLoop(timestamp) {
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (gameState.isRunning) {
    updatePlayer(delta);
    checkCollisions();
  }

  animFrameId = requestAnimationFrame(gameLoop);
}

//Player Movement
function updatePlayer(delta) {
  let dx = 0;
  let dy = 0;

  // Keyboard
  if (keysHeld["ArrowLeft"] || keysHeld["a"] || keysHeld["A"]) dx -= 1;
  if (keysHeld["ArrowRight"] || keysHeld["d"] || keysHeld["D"]) dx += 1;
  if (keysHeld["ArrowUp"] || keysHeld["w"] || keysHeld["W"]) dy -= 1;
  if (keysHeld["ArrowDown"] || keysHeld["s"] || keysHeld["S"]) dy += 1;

  // Joystick (overrides keyboard if active)
  if (joystick.active) {
    dx = joystick.dirX;
    dy = joystick.dirY;
  }

  player.x += dx * player.speed * delta;
  player.y += dy * player.speed * delta;

  player.x = Math.max(0, Math.min(arena.offsetWidth - player.size, player.x));
  player.y = Math.max(0, Math.min(arena.offsetHeight - player.size, player.y));

  playerEl.style.left = player.x + "px";
  playerEl.style.top = player.y + "px";
}

//Timer
let timerInterval = null;

function startTimer() {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    gameState.timeLeft -= 1;
    updateHUD();
    if (gameState.timeLeft <= 0) {
      gameOver();
    }
  }, 1000);
}

//HUD
function updateHUD() {
  document.getElementById("score-display").textContent =
    "Score: " + gameState.score;
  document.getElementById("lives-display").textContent =
    "Lives: " + "♥".repeat(gameState.lives);

  const mins = Math.floor(gameState.timeLeft / 60);
  const secs = String(Math.floor(gameState.timeLeft % 60)).padStart(2, "0");
  document.getElementById("timer-display").textContent =
    "Time: " + mins + ":" + secs;
}

//Game Start
function startGame(selectedDifficulty = "easy") {
  // Set clean droplet ratio based on chosen difficulty
  const lives = { easy: 6, medium: 4, hard: 2 };
  const ratios = { easy: 0.8, medium: 0.5, hard: 0.3 };
 
  gameState.cleanRatio = ratios[selectedDifficulty] ?? 0.8;
  gameState.score = 0;
  gameState.lives = lives[selectedDifficulty] ?? 6;
  gameState.timeLeft = 90;
  gameState.isRunning = true;
  gameState.isInvincible = false;

  playerEl.classList.remove("player-invincible");
  resetJoystick();

  //Show the screen FIRST so the arena has real dimensions
  showScreen("game-screen");

  //Calculate center of arena
  player.x = arena.offsetWidth / 2 - player.size / 2;
  player.y = arena.offsetHeight / 2 - player.size / 2;

  clearAllDroplets();
  updateHUD();
  startTimer();
  startSpawning();

  lastTime = performance.now();
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(gameLoop);
}

//Game Over
function gameOver() {
  gameState.isRunning = false;
  clearInterval(timerInterval);
  clearInterval(spawnInterval);
  clearAllDroplets();
  resetJoystick();

  document.getElementById("final-score").textContent = gameState.score;
  showScreen("gameover-screen");
}
