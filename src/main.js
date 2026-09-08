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

// Examples
import cubeExample from './examples/cube.js';
import physicsExample from './examples/physics.js';
import animationExample from './examples/animation.js';
import towerExample from './examples/tower.js';
import coinExample from './examples/coin.js';
import cakeExample from './examples/cake.js';

const EXAMPLES = {
  cube: cubeExample,
  physics: physicsExample,
  animation: animationExample,
  tower: towerExample,
  coin: coinExample,
  cake: cakeExample,
};

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
  async function runCode() {
    // Clean up previous run
    engine.clearUserObjects();
    api.reset();
    consoleOutput.innerHTML = '';
    editor._clearDecorations();

    // Make sure level is loaded
    if (!engine.levelLoaded) engine.loadLevel();
    engine.resume();

    const code = editor.getCode();
    const scope = api.buildScope();

    // Build function argument names and values
    const argNames = Object.keys(scope);
    const argValues = Object.values(scope);

    try {
      // Wrap in async function so kids can use `await`
      const asyncWrapper = new Function(
        ...argNames,
        `"use strict"; return (async () => {\n${code}\n})();`
      );
      await asyncWrapper(...argValues);
      logToConsole('✅ Code is running!', 'info');
    } catch (err) {
      const { friendly, line } = formatFriendlyError(err, code);
      logToConsole(friendly, 'error');
      editor.highlightError(line);
    }
  }

  // ---- Toolbar buttons ----
  document.getElementById('btn-run').addEventListener('click', runCode);

  document.getElementById('btn-stop').addEventListener('click', () => {
    stopGame();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    engine.reset();
    api.reset();
    consoleOutput.innerHTML = '';
    logToConsole('↻ Reset!', 'info');
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    engine.clearScene();
    api.reset();
    logToConsole('🗑 Scene cleared.', 'info');
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

  // ---- Example dropdown ----
  const exampleBtn = document.getElementById('btn-example');
  const exampleMenu = document.getElementById('example-menu');

  exampleBtn.addEventListener('click', () => {
    exampleMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!exampleBtn.contains(e.target) && !exampleMenu.contains(e.target)) {
      exampleMenu.classList.add('hidden');
    }
  });

  exampleMenu.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.example;
      if (EXAMPLES[key]) {
        editor.setCode(EXAMPLES[key]);
        logToConsole(`📄 Loaded "${btn.textContent.trim()}" example.`, 'info');
      }
      exampleMenu.classList.add('hidden');
    });
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
