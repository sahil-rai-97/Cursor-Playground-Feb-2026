const GRID_SIZE = 4;
const TARGET_TILE = 1024;
const KNOWN_TILE_CLASSES = new Set([
  0,
  2,
  4,
  8,
  16,
  32,
  64,
  128,
  256,
  512,
  1024,
  2048,
  4096,
]);

let boardElement;
let scoreElement;
let bestScoreElement;
let statusElement;
let newGameButton;

let board = [];
let tileElements = [];
let score = 0;
let bestScore = readBestScore();
let hasWon = false;
let isGameOver = false;
let touchStartX = 0;
let touchStartY = 0;
let statusTimerId = null;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}

function bootstrap() {
  boardElement = document.getElementById("board");
  scoreElement = document.getElementById("score");
  bestScoreElement = document.getElementById("best-score");
  statusElement = document.getElementById("status");
  newGameButton = document.getElementById("new-game-btn");

  if (!boardElement || !scoreElement || !bestScoreElement || !statusElement || !newGameButton) {
    console.error("Game initialization failed: missing required DOM elements.");
    return;
  }

  initializeBoardUI();
  startNewGame(false);
  registerEventHandlers();
}

function initializeBoardUI() {
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i += 1) {
    const tile = document.createElement("div");
    tile.className = "tile tile-0";
    tile.textContent = "";
    boardElement.appendChild(tile);
  }

  tileElements = Array.from(boardElement.children);
  bestScoreElement.textContent = String(bestScore);
}

function startNewGame(showFeedback = false) {
  const previousSnapshot = board.length === GRID_SIZE ? snapshotBoard(board) : null;
  let rerollAttempts = 0;

  do {
    board = createEmptyBoard();
    addRandomTile();
    addRandomTile();
    rerollAttempts += 1;
  } while (previousSnapshot && snapshotBoard(board) === previousSnapshot && rerollAttempts < 8);

  score = 0;
  hasWon = false;
  isGameOver = false;
  renderBoard();

  if (showFeedback) {
    setTemporaryStatus("Started a new game.", "win", 900);
  } else {
    setStatus("", "");
  }
}

function registerEventHandlers() {
  document.addEventListener("keydown", handleKeydown);
  newGameButton.addEventListener("click", handleNewGameClick);

  boardElement.addEventListener(
    "touchstart",
    (event) => {
      const firstTouch = event.changedTouches[0];
      touchStartX = firstTouch.clientX;
      touchStartY = firstTouch.clientY;
    },
    { passive: true }
  );

  boardElement.addEventListener(
    "touchend",
    (event) => {
      if (isGameOver) {
        return;
      }

      const lastTouch = event.changedTouches[0];
      const deltaX = lastTouch.clientX - touchStartX;
      const deltaY = lastTouch.clientY - touchStartY;
      const threshold = 30;

      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) {
        return;
      }

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        performMove(deltaX > 0 ? "right" : "left");
      } else {
        performMove(deltaY > 0 ? "down" : "up");
      }
    },
    { passive: true }
  );
}

function handleNewGameClick(event) {
  event.preventDefault();
  startNewGame(true);
}

function handleKeydown(event) {
  if (event.key === "r" || event.key === "R") {
    event.preventDefault();
    startNewGame(true);
    return;
  }

  const directionByKey = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
    a: "left",
    d: "right",
    w: "up",
    s: "down",
    A: "left",
    D: "right",
    W: "up",
    S: "down",
  };

  const direction = directionByKey[event.key];
  if (!direction) {
    return;
  }

  event.preventDefault();
  if (isGameOver) {
    return;
  }

  performMove(direction);
}

function performMove(direction) {
  let moved = false;
  let scoreGained = 0;
  let reachedTarget = false;

  if (direction === "left" || direction === "right") {
    for (let row = 0; row < GRID_SIZE; row += 1) {
      const originalLine = [...board[row]];
      const workingLine = direction === "right" ? [...originalLine].reverse() : originalLine;
      const result = collapseLine(workingLine);
      const newLine = direction === "right" ? result.line.reverse() : result.line;

      if (!arraysEqual(originalLine, newLine)) {
        moved = true;
      }

      board[row] = newLine;
      scoreGained += result.scoreDelta;
      reachedTarget = reachedTarget || result.reachedTarget;
    }
  } else {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const originalLine = [];
      for (let row = 0; row < GRID_SIZE; row += 1) {
        originalLine.push(board[row][col]);
      }

      const workingLine = direction === "down" ? [...originalLine].reverse() : originalLine;
      const result = collapseLine(workingLine);
      const newLine = direction === "down" ? result.line.reverse() : result.line;

      if (!arraysEqual(originalLine, newLine)) {
        moved = true;
      }

      for (let row = 0; row < GRID_SIZE; row += 1) {
        board[row][col] = newLine[row];
      }

      scoreGained += result.scoreDelta;
      reachedTarget = reachedTarget || result.reachedTarget;
    }
  }

  if (!moved) {
    return;
  }

  score += scoreGained;
  updateBestScore();
  addRandomTile();

  if (reachedTarget && !hasWon) {
    hasWon = true;
    setStatus("You reached 1024! Keep going.", "win");
  } else {
    setStatus("", "");
  }

  if (!hasMovesAvailable()) {
    isGameOver = true;
    setStatus("Game over! Press New Game to play again.", "lose");
  }

  renderBoard();
}

function collapseLine(line) {
  const compact = line.filter((value) => value !== 0);
  const merged = [];
  let scoreDelta = 0;
  let reachedTarget = false;

  for (let i = 0; i < compact.length; i += 1) {
    if (compact[i] !== undefined && compact[i] === compact[i + 1]) {
      const mergedValue = compact[i] * 2;
      merged.push(mergedValue);
      scoreDelta += mergedValue;
      if (mergedValue >= TARGET_TILE) {
        reachedTarget = true;
      }
      i += 1;
    } else {
      merged.push(compact[i]);
    }
  }

  while (merged.length < GRID_SIZE) {
    merged.push(0);
  }

  return {
    line: merged,
    scoreDelta,
    reachedTarget,
  };
}

function addRandomTile() {
  const emptyCells = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (board[row][col] === 0) {
        emptyCells.push({ row, col });
      }
    }
  }

  if (emptyCells.length === 0) {
    return false;
  }

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  board[randomCell.row][randomCell.col] = Math.random() < 0.9 ? 2 : 4;
  return true;
}

function hasMovesAvailable() {
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const current = board[row][col];

      if (current === 0) {
        return true;
      }

      if (col + 1 < GRID_SIZE && board[row][col + 1] === current) {
        return true;
      }

      if (row + 1 < GRID_SIZE && board[row + 1][col] === current) {
        return true;
      }
    }
  }

  return false;
}

function renderBoard() {
  let index = 0;
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const value = board[row][col];
      const tile = tileElements[index];
      const classValue = KNOWN_TILE_CLASSES.has(value) ? value : 4096;

      tile.className = `tile tile-${classValue}`;
      tile.textContent = value === 0 ? "" : String(value);
      index += 1;
    }
  }

  scoreElement.textContent = String(score);
  bestScoreElement.textContent = String(bestScore);
}

function setStatus(message, state) {
  clearStatusTimer();
  statusElement.textContent = message;
  statusElement.className = state ? `status ${state}` : "status";
}

function setTemporaryStatus(message, state, durationMs) {
  setStatus(message, state);
  statusTimerId = window.setTimeout(() => {
    statusTimerId = null;
    setStatus("", "");
  }, durationMs);
}

function clearStatusTimer() {
  if (statusTimerId === null) {
    return;
  }

  window.clearTimeout(statusTimerId);
  statusTimerId = null;
}

function createEmptyBoard() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function arraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }

  return true;
}

function snapshotBoard(grid) {
  return grid.flat().join(",");
}

function readBestScore() {
  try {
    return Number.parseInt(localStorage.getItem("best-1024-score") || "0", 10) || 0;
  } catch (_error) {
    return 0;
  }
}

function updateBestScore() {
  if (score <= bestScore) {
    return;
  }

  bestScore = score;
  try {
    localStorage.setItem("best-1024-score", String(bestScore));
  } catch (_error) {
    // Ignore storage failures.
  }
}
