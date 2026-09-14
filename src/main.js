/**
 * main.js – Application entry point. Wires together the editor, engine,
 * API, and UI controls.
 */
import { EditorManager } from './editor/EditorManager.js';
import { GameEngine } from './engine/GameEngine.js';
import { GameAPI } from './api/GameAPI.js';
import { formatFriendlyError } from './editor/ErrorHandler.js';
import { appSettings } from './settings/appSettings.js';
import { mountSettingsPanel } from './settings/SettingsPanel.js';
import { mountChallengeUI } from './challenges/ChallengeUI.js';

// ===== Application State =====
const AppState = {
  mode: 'create', // 'create' | 'challenge'
  gameType: 'first-person',
  level: 1,

  setMode(mode) {
    this.mode = mode;
    const btn = document.getElementById('btn-mode');
    if (btn) {
      btn.textContent = `${mode.charAt(0).toUpperCase() + mode.slice(1)} ▾`;
      btn.title = `${mode} — ${mode === 'create' ? 'build your own game' : 'complete a pre-built game'}`;
    }
    // Game type and Create level selectors are visible only in Create mode.
    const gameTypeDropdown = document.getElementById('game-type-dropdown');
    if (gameTypeDropdown) gameTypeDropdown.style.display = mode === 'create' ? '' : 'none';
    const levelDropdown = document.getElementById('level-dropdown');
    if (levelDropdown) levelDropdown.style.display = mode === 'create' ? '' : 'none';

    // Challenge controls hidden by default via CSS; show during challenge mode
    document.getElementById('challenge-controls').classList.toggle('hidden', mode !== 'challenge');
  },

  setGameType(type) {
    this.gameType = type;
    const btn = document.getElementById('btn-game-type');
    if (type === 'first-person') btn.textContent = 'First Person ▾';
    // Future: add other game types
    document.querySelectorAll('#game-type-menu button').forEach(b => b.classList.toggle('active', b.dataset.gameType === type));
  },

  setLevel(level) {
    this.level = level;
    const btn = document.getElementById('btn-level');
    btn.textContent = `Level ${level} ▾`;
    document.querySelectorAll('#level-menu button').forEach(b => b.classList.toggle('active', parseInt(b.dataset.level) === level));
  },
};

AppState.setMode('create');
AppState.setGameType('first-person');
AppState.setLevel(1);

// ===== Shared Dropdown Helper =====
const TOOLBAR_DROPDOWN_IDS = ['mode-menu', 'game-type-menu', 'level-menu'];

let _openDropdownMenu = null; // tracks which menu is currently open (null = none)

function closeAllToolbarDropdowns(exceptId = null) {
  TOOLBAR_DROPDOWN_IDS.forEach(id => {
    if (id !== exceptId) {
      const m = document.getElementById(id);
      if (m) m.classList.add('hidden');
    }
  });
}

// ===== Mode Navigation =====
const modeMenu = document.getElementById('mode-menu');
document.getElementById('btn-mode').addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpening = !modeMenu.classList.contains('hidden');
  closeAllToolbarDropdowns(isOpening ? null : 'mode-menu');
  if (!isOpening) _openDropdownMenu = modeMenu;
  else _openDropdownMenu = null;
  modeMenu.classList.toggle('hidden');
});

// Mode option selection — click on a button inside the mode menu
modeMenu.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-mode]');
  if (!btn) return;
  AppState.setMode(btn.dataset.mode);
  modeMenu.classList.add('hidden');
});

// Game type dropdown
const gameTypeBtn = document.getElementById('btn-game-type');
const gameTypeMenu = document.getElementById('game-type-menu');
gameTypeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpening = !gameTypeMenu.classList.contains('hidden');
  closeAllToolbarDropdowns(isOpening ? null : 'game-type-menu');
  if (!isOpening) _openDropdownMenu = gameTypeMenu;
  else _openDropdownMenu = null;
  gameTypeMenu.classList.toggle('hidden');
});

// Level dropdown
const levelBtn = document.getElementById('btn-level');
const levelMenu = document.getElementById('level-menu');
levelBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpening = !levelMenu.classList.contains('hidden');
  closeAllToolbarDropdowns(isOpening ? null : 'level-menu');
  if (!isOpening) _openDropdownMenu = levelMenu;
  else _openDropdownMenu = null;
  levelMenu.classList.toggle('hidden');
});

// Outside-click: close all open dropdown menus (but not the one being opened by its button)
document.addEventListener('click', (e) => {
  if (_openDropdownMenu && !_openDropdownMenu.contains(e.target)) {
    _openDropdownMenu.classList.add('hidden');
    _openDropdownMenu = null;
  }
});

// Challenge mode controls (stub — no functionality yet)
const challengeRunBtn = document.getElementById('btn-challenge-run');
const challengeStopBtn = document.getElementById('btn-challenge-stop');
const challengeResetBtn = document.getElementById('btn-challenge-reset');

// ===== Bootstrap =====
(async function main() {
  // DOM refs
  const editorContainer = document.getElementById('editor-container');
  const gameContainer = document.getElementById('game-container');
  const hudOverlay = document.getElementById('hud-overlay');
  const playOverlay = document.getElementById('play-overlay');
  const consolePanel = document.getElementById('console-panel');
  const consoleOutput = document.getElementById('console-output');

  // ---- Console helpers ----
  function logToConsole(text, type = 'info') {
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.textContent = text;
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  // ---- Editor ----
  const editor = new EditorManager(editorContainer);

  // ---- Engine ----
  const engine = new GameEngine(gameContainer);
  await engine.init();
  engine.loadLevel();

  // ---- API ----
  const api = new GameAPI(engine, hudOverlay, logToConsole, () => {
    consoleOutput.innerHTML = '';
  });

  if (engine.modelLoadError) {
    logToConsole('⚠️ A 3D model did not load: ' + engine.modelLoadError.message, 'error');
  }

  function stopGame() {
    const wasRunning = engine.running;
    engine.stop();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    playOverlay.classList.remove('hidden');
    if (wasRunning) logToConsole('⏹ Stopped. Press ▶ Run or click the viewport to play.', 'warn');
  }

  // ---- Pointer lock ----
  // Clicking the play overlay OR the game container requests pointer lock
  const requestLock = () => {
    engine.resume();
    if (!document.pointerLockElement) {
      gameContainer.requestPointerLock();
    }
  };
  playOverlay.addEventListener('click', requestLock);
  gameContainer.addEventListener('click', requestLock);

  document.addEventListener('pointerlockchange', () => {
    const locked = !!document.pointerLockElement;
    playOverlay.classList.toggle('hidden', locked);
    if (!locked) stopGame();
  });

  // ---- Code execution ----
  let currentChallengeRun = null;
  async function runCode() {
    // Clean up previous run
    const run = engine.beginStudentRun();
    currentChallengeRun = AppState.mode === 'challenge' ? run : null;
    challengeUI.setComplete(false);
    api.reset();
    consoleOutput.innerHTML = '';
    editor._clearDecorations();

    // Make sure level is loaded
    if (!engine.levelLoaded) engine.loadLevel();
    engine.resume();

    const code = editor.getCode();
    let challengePrinted = false;
    const validChallenge = () => run.active && currentChallengeRun === run && AppState.mode === 'challenge';
    const scope = api.buildScope(run, currentChallengeRun === run ? {
      onPrint: () => {
        if (validChallenge()) {
          challengePrinted = true;
          challengeUI.setComplete(true);
        }
      },
    } : undefined);

    await run.execute(code, scope, {
      success: () => {
        logToConsole('✅ Code is running!', 'info');
      },
      error: (err) => {
        const { friendly, line } = formatFriendlyError(err, code);
        logToConsole(friendly, 'error');
        editor.highlightError(line);
      },
    });
    if (validChallenge() && !challengePrinted) challengeUI.setComplete(false, true);
  }

  // ---- Toolbar buttons ----
  const challengeUI = mountChallengeUI({
    viewport: document.getElementById('viewport-pane'),
    editor,
    runCode,
  });
  document.getElementById('btn-run').addEventListener('click', () => {
    if (AppState.mode === 'challenge') challengeUI.show();
    else runCode();
  });
  modeMenu.addEventListener('click', (event) => {
    if (event.target.closest('[data-mode]')) {
      currentChallengeRun = null;
      challengeUI.setComplete(false);
      challengeUI.close();
    }
  });

  document.getElementById('btn-stop').addEventListener('click', () => {
    currentChallengeRun = null;
    stopGame();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    currentChallengeRun = null;
    challengeUI.setComplete(false);
    engine.reset();
    api.reset();
    consoleOutput.innerHTML = '';
    logToConsole('↻ Reset!', 'info');
  });

  document.getElementById('btn-level').addEventListener('click', () => {
    if (!engine.levelLoaded) {
      engine.loadLevel();
      logToConsole('📦 Default level loaded!', 'info');
    }
  });

  document.getElementById('btn-save').addEventListener('click', () => {
    editor.save();
    logToConsole('💾 Code saved!', 'info');
  });

  // ---- Console toggle ----
  document.getElementById('btn-console').addEventListener('click', () => {
    consolePanel.classList.toggle('hidden');
  });

  document.getElementById('console-clear').addEventListener('click', () => {
    consoleOutput.innerHTML = '';
  });

  // ---- Fullscreen viewport ----
  document.getElementById('btn-fs').addEventListener('click', () => {
    const vp = document.getElementById('viewport-pane');
    if (!document.fullscreenElement) {
      vp.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  });

  // ---- Challenge mode controls (stub — no functionality yet) ----
  challengeRunBtn?.addEventListener('click', () => logToConsole('Challenge run not implemented yet.', 'warn'));
  challengeStopBtn?.addEventListener('click', stopGame);
  challengeResetBtn?.addEventListener('click', () => logToConsole('Challenge reset not implemented yet.', 'warn'));

  // ---- Resize handle ----
  const resizeHandle = document.getElementById('resize-handle');
  let resizing = false;
  resizeHandle.addEventListener('mousedown', (e) => {
    resizing = true;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const editorPane = document.getElementById('editor-pane');
    const newWidth = Math.max(200, Math.min(window.innerWidth - 200, e.clientX));
    editorPane.style.width = newWidth + 'px';
  });
  document.addEventListener('mouseup', () => { resizing = false; });

  // Show console by default
  consolePanel.classList.remove('hidden');

  mountSettingsPanel(appSettings);

  logToConsole('🎮 Kids Code 3D ready! Press ▶ Run to start.', 'info');
})();
