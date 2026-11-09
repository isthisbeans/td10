/**
 * TRIAMDOD 10 — Nokia 3310 Retro Snake Game Engine
 * Authentic 8-bit Dot-Matrix Monochrome LCD Snake II
 * Controls:
 * - Keypad 2 / ArrowUp / W : UP
 * - Keypad 8 / ArrowDown / S : DOWN
 * - Keypad 4 / ArrowLeft / A : LEFT
 * - Keypad 6 / ArrowRight / D : RIGHT
 * - Keypad 5 / Navi Button : START / PAUSE / RESTART
 * - Keypad 9 / C Button / Softkey : TOGGLE SNAKE / TIMETABLE
 * - Touch Swipe on LCD screen for Mobile devices
 */

(function() {
  const GRID_COLS = 20;
  const GRID_ROWS = 12;
  const CELL_SIZE = 9; // 180x108 px canvas

  let canvas = null;
  let ctx = null;
  let viewport = null;
  let scoreEl = null;
  let highScoreEl = null;
  let overlayEl = null;
  let msgTitleEl = null;
  let msgSubEl = null;
  let modeBadge = null;
  let softkeyLeft = null;
  let softkeyCenter = null;
  let softkeyRight = null;
  let timetableList = null;
  let pageIndicator = null;
  let modeTitle = null;
  let controlsAttached = false;

  let isSnakeModeActive = false;
  let gameInterval = null;
  let isPaused = false;
  let isGameOver = false;
  let isRunning = false;
  let isPhoneVisible = true;

  let snake = [];
  let direction = { x: 1, y: 0 };
  let nextDirection = { x: 1, y: 0 };
  let food = { x: 10, y: 6 };
  let score = 0;
  let highScore = 0;
  let blinkCounter = 0;

  // Touch Swipe tracking
  let touchStartX = 0;
  let touchStartY = 0;

  function loadHighScore() {
    try {
      const saved = localStorage.getItem('TD10_SNAKE_HI');
      if (saved) {
        highScore = parseInt(saved, 10) || 0;
      }
    } catch(e) {}
    if (highScoreEl) {
      highScoreEl.textContent = String(highScore).padStart(2, '0');
    }
  }

  function saveHighScore() {
    if (score > highScore) {
      highScore = score;
      try {
        localStorage.setItem('TD10_SNAKE_HI', highScore);
      } catch(e) {}
    }
    if (highScoreEl) {
      highScoreEl.textContent = String(highScore).padStart(2, '0');
    }
  }

  function initElements() {
    canvas = document.getElementById('nokiaSnakeCanvas');
    if (canvas) ctx = canvas.getContext('2d');
    viewport = document.getElementById('nokiaSnakeViewport');
    scoreEl = document.getElementById('snakeScore');
    highScoreEl = document.getElementById('snakeHighScore');
    overlayEl = document.getElementById('snakeOverlay');
    msgTitleEl = document.getElementById('snakeMsgTitle');
    msgSubEl = document.getElementById('snakeMsgSub');
    modeBadge = document.getElementById('nokiaModeBadge');
    softkeyLeft = document.getElementById('nokiaSoftkeyLeft');
    softkeyCenter = document.getElementById('nokiaSoftkeyCenter');
    softkeyRight = document.getElementById('nokiaSoftkeyRight');
    timetableList = document.getElementById('nokiaScheduleList');
    pageIndicator = document.getElementById('nokiaPageIndicator');
    modeTitle = document.getElementById('nokiaModeTitle');

    loadHighScore();
  }

  function stopGameTimer() {
    clearInterval(gameInterval);
    gameInterval = null;
  }

  function resetGame() {
    stopGameTimer();
    snake = [
      { x: 5, y: 6 },
      { x: 4, y: 6 },
      { x: 3, y: 6 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    isGameOver = false;
    isPaused = false;
    isRunning = false;
    if (scoreEl) scoreEl.textContent = '00';
    spawnFood();
    draw();
    showOverlay('SNAKE II', 'PRESS 5 OR NAVI');
  }

  function spawnFood() {
    let valid = false;
    let attempts = 0;
    while (!valid && attempts < 100) {
      attempts++;
      const fx = Math.floor(Math.random() * (GRID_COLS - 2)) + 1;
      const fy = Math.floor(Math.random() * (GRID_ROWS - 2)) + 1;
      const onSnake = snake.some(seg => seg.x === fx && seg.y === fy);
      if (!onSnake) {
        food = { x: fx, y: fy };
        valid = true;
      }
    }
  }

  function startGame() {
    if (!isSnakeModeActive || document.hidden || !isPhoneVisible || window.TD_Performance.isDialogOpen()) return;
    if (isRunning && !isPaused) return;
    if (isGameOver) {
      resetGame();
    }
    isRunning = true;
    isPaused = false;
    hideOverlay();

    if (softkeyCenter) softkeyCenter.textContent = 'PAUSE (5)';
    if (softkeyRight) softkeyRight.textContent = 'Restart';

    stopGameTimer();
    gameInterval = setInterval(gameTick, 115);
  }

  function pauseGame() {
    if (!isRunning || isGameOver) return;
    if (isPaused && (document.hidden || !isPhoneVisible || window.TD_Performance.isDialogOpen())) return;
    isPaused = !isPaused;
    if (isPaused) {
      stopGameTimer();
      showOverlay('PAUSED', 'PRESS 5 OR NAVI');
      if (softkeyCenter) softkeyCenter.textContent = 'RESUME';
    } else {
      hideOverlay();
      if (softkeyCenter) softkeyCenter.textContent = 'PAUSE (5)';
      gameInterval = setInterval(gameTick, 115);
    }
  }

  function togglePause() {
    if (!isRunning || isGameOver) startGame();
    else pauseGame();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isRunning && !isPaused) pauseGame();
  });
  window.TD_Performance.subscribe(() => {
    if (window.TD_Performance.isDialogOpen() && isRunning && !isPaused) pauseGame();
  });

  function gameOver() {
    isGameOver = true;
    isRunning = false;
    stopGameTimer();
    saveHighScore();

    if (window.TD_Audio && window.TD_Audio.playSnakeDie) {
      window.TD_Audio.playSnakeDie();
    }

    showOverlay('GAME OVER', `SCORE: ${score} • RETRY`);
    if (softkeyCenter) softkeyCenter.textContent = 'RETRY (5)';
  }

  function showOverlay(title, sub) {
    if (!overlayEl) return;
    overlayEl.style.display = 'flex';
    if (msgTitleEl) msgTitleEl.textContent = title;
    if (msgSubEl) msgSubEl.textContent = sub;
  }

  function hideOverlay() {
    if (!overlayEl) return;
    overlayEl.style.display = 'none';
  }

  function changeDirection(dx, dy) {
    if (!isSnakeModeActive || document.hidden || !isPhoneVisible || window.TD_Performance.isDialogOpen()) return;
    // Prevent 180 reverse
    if (direction.x + dx === 0 && direction.y + dy === 0) return;
    nextDirection = { x: dx, y: dy };

    if (!isRunning && !isGameOver) {
      startGame();
    }
  }

  function gameTick() {
    if (!isSnakeModeActive || document.hidden || !isPhoneVisible || window.TD_Performance.isDialogOpen()) {
      if (isRunning && !isPaused) pauseGame();
      return;
    }
    direction = { ...nextDirection };
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    // Wall collision (authentic solid wall boundary)
    if (head.x < 0 || head.x >= GRID_COLS || head.y < 0 || head.y >= GRID_ROWS) {
      gameOver();
      draw();
      return;
    }

    // Self collision
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      gameOver();
      draw();
      return;
    }

    snake.unshift(head);

    // Food collision
    if (head.x === food.x && head.y === food.y) {
      score += 1;
      if (scoreEl) scoreEl.textContent = String(score).padStart(2, '0');
      saveHighScore();
      if (window.TD_Audio && window.TD_Audio.playSnakeBeep) {
        window.TD_Audio.playSnakeBeep();
      }
      spawnFood();
    } else {
      snake.pop();
    }

    blinkCounter = (blinkCounter + 1) % 4;
    draw();
  }

  function draw() {
    if (!ctx || !canvas) return;

    // Clear with retro Nokia LCD phosphor olive-green
    ctx.fillStyle = '#98ab82';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw retro dotted border around the playfield
    ctx.strokeStyle = '#1e2d14';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

    // Draw Food (Classic blinking 2x2 dot)
    if (!isGameOver || blinkCounter > 1) {
      ctx.fillStyle = '#1e2d14';
      const fx = food.x * CELL_SIZE + 1;
      const fy = food.y * CELL_SIZE + 1;
      ctx.fillRect(fx, fy, CELL_SIZE - 2, CELL_SIZE - 2);
      // Small hollow center for iconic insect food look
      ctx.fillStyle = '#98ab82';
      ctx.fillRect(fx + 2, fy + 2, CELL_SIZE - 6, CELL_SIZE - 6);
    }

    // Draw Snake
    ctx.fillStyle = '#1e2d14';
    snake.forEach((seg, index) => {
      const sx = seg.x * CELL_SIZE + 1;
      const sy = seg.y * CELL_SIZE + 1;
      const sz = CELL_SIZE - 2;

      ctx.fillStyle = '#1e2d14';
      ctx.fillRect(sx, sy, sz, sz);

      // Head distinctive pixel eyes
      if (index === 0) {
        ctx.fillStyle = '#98ab82';
        if (direction.x === 1) {
          ctx.fillRect(sx + 4, sy + 1, 2, 2);
          ctx.fillRect(sx + 4, sy + sz - 3, 2, 2);
        } else if (direction.x === -1) {
          ctx.fillRect(sx + 1, sy + 1, 2, 2);
          ctx.fillRect(sx + 1, sy + sz - 3, 2, 2);
        } else if (direction.y === 1) {
          ctx.fillRect(sx + 1, sy + 4, 2, 2);
          ctx.fillRect(sx + sz - 3, sy + 4, 2, 2);
        } else {
          ctx.fillRect(sx + 1, sy + 1, 2, 2);
          ctx.fillRect(sx + sz - 3, sy + 1, 2, 2);
        }
      }
    });
  }

  function setSnakeMode(active) {
    isSnakeModeActive = active;

    if (active) {
      if (timetableList) timetableList.style.display = 'none';
      if (viewport) viewport.style.display = 'flex';
      if (pageIndicator) pageIndicator.style.display = 'none';
      if (modeTitle) modeTitle.textContent = 'GAMES // SNAKE II';
      if (modeBadge) {
        modeBadge.classList.add('mode-active');
        modeBadge.innerHTML = '<span class="snake-icon-dot"></span>LINEUP (C)';
      }
      if (softkeyLeft) softkeyLeft.textContent = 'Exit (C)';
      if (softkeyCenter) softkeyCenter.textContent = isRunning ? (isPaused ? 'RESUME' : 'PAUSE (5)') : 'START (5)';
      if (softkeyRight) softkeyRight.textContent = 'Restart';

      resetGame();
    } else {
      stopGameTimer();
      isRunning = false;
      isPaused = false;

      if (timetableList) timetableList.style.display = 'block';
      if (viewport) viewport.style.display = 'none';
      if (pageIndicator) pageIndicator.style.display = 'inline';
      if (modeTitle) modeTitle.textContent = 'RUN OF SHOW // LINEUP';
      if (modeBadge) {
        modeBadge.classList.remove('mode-active');
        modeBadge.innerHTML = '<span class="snake-icon-dot"></span>SNAKE [9]';
      }
      if (softkeyLeft) softkeyLeft.textContent = 'Options';
      if (softkeyCenter) softkeyCenter.textContent = '▲▼ SCROLL';
      if (softkeyRight) softkeyRight.textContent = 'Snake';
    }
  }

  function toggleSnakeMode() {
    setSnakeMode(!isSnakeModeActive);
  }

  // Key Event listener for classic Snake keys & Arrows
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || document.hidden ||
        e.target.closest?.('input, textarea, select, [contenteditable], button, a, [role="button"]') ||
        document.querySelector('#authModal.active, #payphoneModal.active, #polaroidLightboxModal.active')) return;
    // Only capture when Snake Mode is active or when user presses 9
    if (e.key === '9') {
      if (!e.repeat) toggleSnakeMode();
      return;
    }

    if (!isSnakeModeActive) return;

    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === '2') {
      e.preventDefault();
      changeDirection(0, -1);
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' || e.key === '8') {
      e.preventDefault();
      changeDirection(0, 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === '4') {
      e.preventDefault();
      changeDirection(-1, 0);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === '6') {
      e.preventDefault();
      changeDirection(1, 0);
    } else if (e.key === '5' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      if (!isRunning || isGameOver) {
        startGame();
      } else {
        pauseGame();
      }
    } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      setSnakeMode(false);
    }
  });

  // Attach controls to phone keypad and D-Pad
  function attachControls() {
    if (controlsAttached) return;
    controlsAttached = true;
    initElements();

    const section = document.getElementById('scheduleSection');
    if (section && 'IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        isPhoneVisible = entries[0].isIntersecting;
        if (!isPhoneVisible && isRunning && !isPaused) pauseGame();
      }).observe(section);
    }

    if (modeBadge) {
      modeBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSnakeMode();
      });
    }

    if (softkeyRight) {
      softkeyRight.addEventListener('click', () => {
        if (!isSnakeModeActive) {
          setSnakeMode(true);
        } else {
          resetGame();
          startGame();
        }
      });
    }

    if (softkeyLeft) {
      softkeyLeft.addEventListener('click', () => {
        if (isSnakeModeActive) {
          setSnakeMode(false);
        }
      });
    }

    if (softkeyCenter) {
      softkeyCenter.addEventListener('click', () => {
        if (isSnakeModeActive) {
          if (!isRunning || isGameOver) {
            startGame();
          } else {
            pauseGame();
          }
        }
      });
    }

    // Touch Swipe gestures on Canvas for effortless mobile play
    if (canvas) {
      canvas.addEventListener('touchstart', (e) => {
        if (!isSnakeModeActive) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      }, { passive: true });

      canvas.addEventListener('touchend', (e) => {
        if (!isSnakeModeActive) return;
        const touch = e.changedTouches[0];
        const diffX = touch.clientX - touchStartX;
        const diffY = touch.clientY - touchStartY;

        // If tap (negligible swipe movement) -> toggle start/pause
        if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15) {
          if (!isRunning || isGameOver) {
            startGame();
          } else {
            pauseGame();
          }
          return;
        }

        // Horizontal swipe
        if (Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX > 0) {
            changeDirection(1, 0); // Right
          } else {
            changeDirection(-1, 0); // Left
          }
        } else {
          // Vertical swipe
          if (diffY > 0) {
            changeDirection(0, 1); // Down
          } else {
            changeDirection(0, -1); // Up
          }
        }
      }, { passive: true });
    }

    if (overlayEl) {
      overlayEl.addEventListener('click', () => {
        startGame();
      });
    }
  }

  // Export interface for nokia-3310.js to call
  window.TD_NokiaSnake = {
    init: attachControls,
    setSnakeMode,
    toggleSnakeMode,
    changeDirection,
    startGame,
    pauseGame,
    togglePause,
    isActive: () => isSnakeModeActive
  };

  document.addEventListener('DOMContentLoaded', attachControls);
})();
