import { CREATE_LEVEL_CHOICES, selectedStage } from './engine/stageSelection.js';
import { createChallengeValidator } from './challenges/challengeValidation.js';
import { CHALLENGE_LEVEL_CONFIG } from './challenges/challengeLevelConfig.js';
import { selectChallengeLevel } from './challenges/challengeSelection.js';
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
import { mountSuccessUI } from './challenges/SuccessUI.js';

// ===== Application State =====
const AppState = {
  mode: 'create', // 'create' | 'challenge'
  gameType: 'first-person',
  level: 1,
  challengeLevel: 1,

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

  setChallengeLevel(level) {
    this.challengeLevel = level;
    document.getElementById('btn-challenge-level').textContent = `Challenge Level ${level} ▾`;
    document.querySelectorAll('#challenge-level-menu button').forEach(b => b.classList.toggle('active', Number(b.dataset.challengeLevel) === level));
  },
};

AppState.setMode('create');
AppState.setGameType('first-person');
AppState.setLevel(1);

// ===== Shared Dropdown Helper =====
const TOOLBAR_DROPDOWN_IDS = ['mode-menu', 'game-type-menu', 'level-menu', 'challenge-level-menu'];

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
levelMenu.replaceChildren(...CREATE_LEVEL_CHOICES.map(({ level, label }) => {
  const button = document.createElement('button');
  button.dataset.level = level;
  button.textContent = label;
  button.classList.toggle('active', level === AppState.level);
  return button;
}));
levelBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpening = !levelMenu.classList.contains('hidden');
  closeAllToolbarDropdowns(isOpening ? null : 'level-menu');
  if (!isOpening) _openDropdownMenu = levelMenu;
  else _openDropdownMenu = null;
  levelMenu.classList.toggle('hidden');
});

const challengeLevelMenu = document.getElementById('challenge-level-menu');
document.getElementById('btn-challenge-level').addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpening = challengeLevelMenu.classList.contains('hidden');
  closeAllToolbarDropdowns(isOpening ? 'challenge-level-menu' : null);
  _openDropdownMenu = isOpening ? challengeLevelMenu : null;
  challengeLevelMenu.classList.toggle('hidden', !isOpening);
});

// Outside-click: close all open dropdown menus (but not the one being opened by its button)
document.addEventListener('click', (e) => {
  if (_openDropdownMenu && !_openDropdownMenu.contains(e.target)) {
    _openDropdownMenu.classList.add('hidden');
    _openDropdownMenu = null;
  }
});

// Challenge mode controls
const challengeRunBtn = document.getElementById('btn-challenge-run');
const challengeStopBtn = document.getElementById('btn-challenge-stop');
const challengeResetBtn = document.getElementById('btn-challenge-reset');

// ===== Bootstrap =====
(async function main() {
  // DOM refs
  const editorContainer = document.getElementById('editor-container');
  const gameContainer = document.getElementById('game-container');
  gameContainer.tabIndex = -1;
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
  const editor = new EditorManager(editorContainer, { getPlayerPosition: () => engine.getPlayer()?.position });

  // ---- Engine ----
  const engine = new GameEngine(gameContainer);
  await engine.init();
  engine.loadLevel(selectedStage(AppState).levelId);

  // ---- API ----
  const api = new GameAPI(engine, hudOverlay, logToConsole, () => {
    consoleOutput.innerHTML = '';
  });

  if (engine.modelLoadError) {
    logToConsole('⚠️ A 3D model did not load: ' + engine.modelLoadError.message, 'error');
  }

  let successUI = null;
  function updateMusicVolume() {
    const playing = engine.running && document.hasFocus()
      && document.pointerLockElement === gameContainer
      && !editorContainer.contains(document.activeElement);
    engine.audio.setMusicVolume(playing ? 0.5 : 0.2);
  }
  window.addEventListener('blur', () => engine.audio.setMusicVolume(0.2));
  window.addEventListener('focus', updateMusicVolume);
  document.addEventListener('focusin', updateMusicVolume);
  function stopGame({ preserveSuccess = false, stopMusic = false } = {}) {
    if (!preserveSuccess) successUI?.cancel();
    currentChallengeRun = null;
    const wasRunning = engine.running;
    if (stopMusic) engine.audio.stopMusic();
    engine.stop();
    updateMusicVolume();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    playOverlay.classList.remove('hidden');
    if (wasRunning) logToConsole('⏹ Stopped. Press ▶ Run or click the viewport to play.', 'warn');
  }

  // ---- Pointer lock ----
  // Clicking the play overlay OR the game container requests pointer lock
  const requestLock = () => {
    gameContainer.focus({ preventScroll: true });
    engine.audio.playMusic();
    engine.resume();
    updateMusicVolume();
    if (!document.pointerLockElement) {
      gameContainer.requestPointerLock();
    }
  };
  playOverlay.addEventListener('click', requestLock);
  gameContainer.addEventListener('click', requestLock);

  document.addEventListener('pointerlockchange', () => {
    const locked = !!document.pointerLockElement;
    const viewportPane = document.getElementById('viewport-pane');
    const waterDebugPointerFree = document.fullscreenElement === viewportPane
      && viewportPane?.dataset.waterDebugPointerFree === 'true';
    updateMusicVolume();
    playOverlay.classList.toggle('hidden', locked || waterDebugPointerFree);
    if (!locked && !waterDebugPointerFree) {
      stopGame({ preserveSuccess: true });
    }
  });

  // ---- Code execution ----
  let currentChallengeRun = null;
  let challengeStar = null;
  const selectedLevelId = () => selectedStage(AppState).levelId;
  async function runCode() {
    engine.audio.playMusic();
    successUI?.cancel();
    // Select the environment before creating a run: switching invalidates runs.
    engine.loadLevel(selectedLevelId());
    // Clean up previous run
    const run = engine.beginStudentRun();
    challengeStar = null;
    currentChallengeRun = AppState.mode === 'challenge' ? run : null;
    challengeUI.setComplete(false);
    api.reset();
    consoleOutput.innerHTML = '';
    editor._clearDecorations();

    engine.resume();
    updateMusicVolume();

    const code = editor.getCode();
    const challenge = challengeUI.currentChallenge;
    const validChallenge = () => run.active && currentChallengeRun === run
      && AppState.mode === 'challenge' && challengeUI.currentChallenge === challenge;
    const validator = currentChallengeRun === run ? createChallengeValidator(challenge, code, {
      isCurrent: validChallenge,
      onComplete: () => {
        challengeUI.setComplete(true);
        try {
          challengeStar = api.models.createGoldStar(CHALLENGE_LEVEL_CONFIG[AppState.challengeLevel].goldStar);
        } catch (error) {
          logToConsole('Could not place the challenge Gold Star: ' + error.message, 'error');
        }
      },
    }) : null;
    const scope = api.buildScope(run, currentChallengeRun === run ? {
      onCall: validator.observe,
    } : undefined);

    await run.execute(code, scope, {
      success: () => {
        validator?.succeeded();
        logToConsole('✅ Code is running!', 'info');
      },
      error: (err) => {
        const { friendly, line } = formatFriendlyError(err, code);
        logToConsole(friendly, 'error');
        editor.highlightError(line);
      },
    });
    if (validChallenge() && !validator.complete) challengeUI.setComplete(false, true);
  }

  // ---- Toolbar buttons ----
  const challengeUI = mountChallengeUI({
    viewport: document.getElementById('viewport-pane'),
    editor,
    runCode,
    getChallengeId: () => AppState.challengeLevel,
    onAdvance: selectChallenge,
  });
  function resetGame({ runStudentCode = true } = {}) {
    successUI?.cancel();
    challengeUI.close();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    playOverlay.classList.remove('hidden');
    currentChallengeRun = null;
    challengeStar = null;
    engine.reset(selectedLevelId());
    if (runStudentCode) return runCode();
    api.reset();
    consoleOutput.innerHTML = '';
    editor._clearDecorations();
    challengeUI.setComplete(false);
  }
  successUI = mountSuccessUI({
    stop: () => stopGame({ preserveSuccess: true }),
    reset: resetGame,
    challengeUI,
    isChallenge: () => AppState.mode === 'challenge',
  });
  engine.onGoldStarCollected = star => {
    if (!selectedStage(AppState).challenge || star !== challengeStar) return;
    void successUI.collect();
  };

  function runAction() {
    engine.audio.playMusic();
    successUI.cancel();
    engine.loadLevel(selectedLevelId());
    if (AppState.mode === 'challenge') {
      stopGame();
      challengeUI.show();
    }
    else runCode();
  }
  document.getElementById('btn-run').addEventListener('click', runAction);
  modeMenu.addEventListener('click', (event) => {
    if (event.target.closest('[data-mode]')) {
      successUI.cancel();
      currentChallengeRun = null;
      challengeStar?.destroy();
      challengeStar = null;
      challengeUI.setComplete(false);
      challengeUI.close();
      resetGame({ runStudentCode: false });
      stopGame();
    }
  });

  challengeLevelMenu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-challenge-level]');
    if (!button) return;
    const level = Number(button.dataset.challengeLevel);
    if (!Number.isInteger(level) || !Object.hasOwn(CHALLENGE_LEVEL_CONFIG, level)) return;
    challengeLevelMenu.classList.add('hidden');
    _openDropdownMenu = null;
    selectChallenge(level);
  });

  function selectChallenge(level) {
    return selectChallengeLevel(level, {
      setLevel: level => AppState.setChallengeLevel(level),
      reset: () => resetGame({ runStudentCode: false }),
      stop: stopGame,
      show: () => challengeUI.show(),
    });
  }

  document.getElementById('btn-stop').addEventListener('click', () => stopGame({ stopMusic: true }));
  document.getElementById('btn-reset').addEventListener('click', resetGame);

  levelMenu.addEventListener('click', event => {
    const button = event.target.closest('[data-level]');
    if (!button || AppState.mode !== 'create') return;
    const level = Number(button.dataset.level);
    if (!CREATE_LEVEL_CHOICES.some(choice => choice.level === level)) return;
    AppState.setLevel(level);
    levelMenu.classList.add('hidden');
    _openDropdownMenu = null;
    resetGame({ runStudentCode: false });
    stopGame();
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

  // ---- Challenge mode controls ----
  challengeRunBtn?.addEventListener('click', runAction);
  challengeStopBtn?.addEventListener('click', () => stopGame({ stopMusic: true }));
  challengeResetBtn?.addEventListener('click', resetGame);

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
