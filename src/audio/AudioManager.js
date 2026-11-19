import * as THREE from 'three';
import coin from '../assets/audio/coin.ogg?url';
import jump from '../assets/audio/jump.ogg?url';
import charging from '../assets/audio/charging.ogg?url';
import explosion from '../assets/audio/explosion.ogg?url';
import robotLoop from '../assets/audio/robot_loop.ogg?url';
import sirenUrl from '../assets/audio/siren.ogg?url';
import Track01 from '../assets/music/Track01.ogg?url';
import Frozen from '../assets/music/Frozen.ogg?url';
import RoboticTrack from '../assets/music/Robotic Track.ogg?url';

const DEFAULT_DRONE_AUDIO = Object.freeze({
  droneAudioEnabled: true,
  droneAudioVolume: 0.6,
  droneAudioRefDistance: 2.0,
  droneAudioMaxDistance: 15.0,
  droneAudioRolloffFactor: 1.5,
  droneAudioFadeDuration: 0.25,
  droneAudioDirectionalAttenuationEnabled: false,
  droneAudioRearVolumeMultiplier: 0.7,
});

const MUSIC_MASTER_VOLUME_MULTIPLIER = 0.3;

export class AudioManager {
  constructor(createAudio = url => new Audio(url), tracks = { Track01, Frozen, RoboticTrack }) {
    this.createAudio = createAudio;
    this.tracks = tracks;
    this.sounds = new Map();
    this.musicTracks = new Map();
    this.musicVolume = 0.2;
    this._musicActualVolume = this.musicVolume;
    this._musicTargetVolume = this.musicVolume;
    this._musicFadeRemaining = 0;
    this._droneSources = new Set();
    this._audioForward = new THREE.Vector3();
    this._audioTowardDrone = new THREE.Vector3();
    this._buffers = new Map();
    this._bufferPromises = new Map();
    this.listener = null;
    this.listenerCamera = null;
    this.siren = null;
    this.sirenVolume = 0;
    this.sirenTargetVolume = 0;
    this.sirenFadeRemaining = 0;
    this._sirenStopTimer = null;
    this.caughtAudioActive = false;
    this.caughtAudioFinishing = false;
    this.caughtMusicMultiplier = 1;
    this.caughtSirenVolume = 0.8;
    this.caughtDroneAudioMultiplier = 0;
    this.caughtAudioFadeDuration = 0.3;
    this.musicGeneration = 0;
  }

  _play(audio) {
    try { audio.play()?.catch(() => {}); } catch { /* Browser audio may be unavailable. */ }
  }

  playSfx(name) {
    const urls = { coin, jump, charging, explosion };
    if (!urls[name]) return;
    let sound = this.sounds.get(name);
    if (!sound) {
      try { sound = this.createAudio(urls[name]); } catch { return; }
      this.sounds.set(name, sound);
    }
    sound.currentTime = 0;
    this._play(sound);
  }

  playMusic(name = 'Track01') {
    if (this.musicName === name && this.musicActive) return;
    if (!this.tracks[name]) return;
    this.stopMusic();
    try {
      if (!this.musicTracks.has(name)) this.musicTracks.set(name, this.createAudio(this.tracks[name]));
      this.music = this.musicTracks.get(name);
    } catch { return; }
    this.musicName = name;
    this.music.loop = true;
    this._musicActualVolume = this._musicTargetVolume = this._musicVolumeTarget();
    this.music.volume = this._musicActualVolume;
    this.musicActive = true;
    const music = this.music;
    const generation = this.musicGeneration;
    try {
      music.play()?.catch(() => { if (this.musicGeneration === generation) this.musicActive = false; });
    } catch { this.musicActive = false; }
  }

  playMusicForLevel(levelId = 'default') {
    const match = /^challenge-(\d+)$/.exec(levelId);
    const level = match ? Number(match[1]) : 0;
    this.playMusic(level >= 16 ? 'RoboticTrack' : level >= 12 ? 'Frozen' : 'Track01');
  }

  _musicVolumeTarget() {
    const caughtMultiplier = this.caughtAudioActive ? this.caughtMusicMultiplier : 1;
    return this.musicVolume * MUSIC_MASTER_VOLUME_MULTIPLIER * caughtMultiplier;
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this._musicTargetVolume = this._musicVolumeTarget();
    if (!this.caughtAudioActive) {
      this._musicActualVolume = this._musicTargetVolume;
      this._musicFadeRemaining = 0;
    }
    if (this.music) this.music.volume = this._musicActualVolume;
  }

  stopMusic() {
    this.musicGeneration = (this.musicGeneration ?? 0) + 1;
    if (this.music) { this.music.pause(); this.music.currentTime = 0; }
    this.musicActive = false;
  }

  attachListener(camera) {
    if (!camera) return null;
    if (!this.listener) this.listener = new THREE.AudioListener();
    if (this.listener.parent !== camera) camera.add(this.listener);
    this.listenerCamera = camera;
    return this.listener;
  }

  resume() {
    const context = this.listener?.context;
    if (context?.state === 'suspended') context.resume?.().catch?.(() => {});
  }

  _loadBuffer(name, url) {
    if (this._buffers.has(name)) return Promise.resolve(this._buffers.get(name));
    if (this._bufferPromises.has(name)) return this._bufferPromises.get(name);
    const promise = new Promise((resolve, reject) => {
      try {
        new THREE.AudioLoader().load(url, buffer => {
          this._buffers.set(name, buffer);
          resolve(buffer);
        }, undefined, reject);
      } catch (error) { reject(error); }
    }).catch(error => {
      this._bufferPromises.delete(name);
      console.warn(`[audio] Could not load ${name}:`, error);
      return null;
    });
    this._bufferPromises.set(name, promise);
    return promise;
  }

  preloadForLevel({ drones = false, keys = false } = {}) {
    if (drones) {
      this._loadBuffer('robotLoop', robotLoop);
      this._loadBuffer('siren', sirenUrl);
    }
    if (keys) this._loadBuffer('coin', coin);
  }

  attachDroneAudio(root, settings = {}) {
    if (!root || !this.listener) return null;
    const config = { ...DEFAULT_DRONE_AUDIO, ...settings };
    let source;
    try {
      source = new THREE.PositionalAudio(this.listener);
      source.setRefDistance?.(Math.max(0.01, Number(config.droneAudioRefDistance) || 2));
      source.setMaxDistance?.(Math.max(0.1, Number(config.droneAudioMaxDistance) || 15));
      source.setRolloffFactor?.(Math.max(0, Number(config.droneAudioRolloffFactor) || 1.5));
      source.setDistanceModel?.('exponential');
      if (source.panner) source.panner.panningModel = 'HRTF';
      root.add(source);
    } catch { return null; }

    const record = {
      root,
      source,
      config,
      position: new THREE.Vector3(),
      currentGain: 0,
      targetGain: 0,
      audible: false,
      playing: false,
      isInjured: settings.isInjured,
      isCaught: settings.isCaught,
    };
    this._droneSources.add(record);
    this._loadBuffer('robotLoop', robotLoop).then(buffer => {
      if (!buffer || !this._droneSources.has(record)) return;
      source.setBuffer(buffer);
      source.setLoop(true);
    });
    return record;
  }

  detachDroneAudio(record) {
    if (!record) return;
    this._droneSources.delete(record);
    try { record.source.stop(); } catch { /* already stopped */ }
    record.source.disconnect?.();
    record.source.removeFromParent?.();
  }

  _droneTargetGain(record, playerPosition, camera, activeCount) {
    const config = record.config;
    if (config.droneAudioEnabled === false || record.isInjured?.()) return 0;
    const caught = record.isCaught?.();
    if (caught && (!this.caughtAudioActive || this.caughtAudioFinishing)) return 0;
    const maxDistance = Math.max(0.1, Number(config.droneAudioMaxDistance) || 15);
    record.root.getWorldPosition(record.position);
    const distance = record.position.distanceTo(playerPosition);
    const hysteresis = 0.5;
    if (record.audible ? distance > maxDistance + hysteresis : distance <= maxDistance) record.audible = distance <= maxDistance;
    if (!record.audible) return 0;

    let directionGain = 1;
    if (config.droneAudioDirectionalAttenuationEnabled && camera) {
      camera.getWorldDirection(this._audioForward);
      this._audioTowardDrone.copy(record.position).sub(playerPosition).normalize();
      const dot = this._audioForward.dot(this._audioTowardDrone);
      const rear = Math.max(0, Math.min(1, Number(config.droneAudioRearVolumeMultiplier) || 0.7));
      directionGain = rear + (1 - rear) * ((dot + 1) * 0.5);
    }
    const mixGain = activeCount > 1 ? 1 / Math.sqrt(activeCount) : 1;
    const caughtMultiplier = caught ? this.caughtDroneAudioMultiplier : 1;
    return Math.max(0, Number(config.droneAudioVolume) || 0.6) * caughtMultiplier * directionGain * mixGain;
  }

  update(dt = 0, player = null, camera = this.listenerCamera) {
    const safeDt = Math.max(0, Number(dt) || 0);
    if (this.music && this._musicFadeRemaining > 0) {
      const amount = Math.min(1, safeDt / this._musicFadeRemaining);
      this._musicActualVolume = THREE.MathUtils.lerp(this._musicActualVolume, this._musicTargetVolume, amount);
      this._musicFadeRemaining = Math.max(0, this._musicFadeRemaining - safeDt);
      if (!this._musicFadeRemaining) this._musicActualVolume = this._musicTargetVolume;
      this.music.volume = this._musicActualVolume;
    }
    if (this.siren && this.sirenFadeRemaining > 0) {
      const amount = Math.min(1, safeDt / this.sirenFadeRemaining);
      this.sirenVolume = THREE.MathUtils.lerp(this.sirenVolume, this.sirenTargetVolume, amount);
      this.sirenFadeRemaining = Math.max(0, this.sirenFadeRemaining - safeDt);
      if (!this.sirenFadeRemaining) this.sirenVolume = this.sirenTargetVolume;
      this.siren.setVolume(this.sirenVolume);
    }
    const position = player?.position;
    if (!position) return;
    const candidates = [...this._droneSources].filter(record => (
      record.config.droneAudioEnabled !== false
      && !record.isInjured?.()
      && (!record.isCaught?.() || this.caughtAudioActive)
    ));
    const activeCount = candidates.filter(record => {
      record.root.getWorldPosition(record.position);
      return record.position.distanceTo(position) <= (Number(record.config.droneAudioMaxDistance) || 15);
    }).length;
    for (const record of this._droneSources) {
      const fade = Math.max(0.01, Number(record.config.droneAudioFadeDuration) || 0.25);
      record.targetGain = this._droneTargetGain(record, position, camera, activeCount);
      const amount = Math.min(1, safeDt / fade);
      record.currentGain = THREE.MathUtils.lerp(record.currentGain, record.targetGain, amount);
      if (!record.source.buffer) continue;
      if (record.targetGain > 0 && !record.source.isPlaying) {
        this.resume();
        try { record.source.play(); record.playing = true; } catch { /* autoplay or context unavailable */ }
      }
      record.source.setVolume(record.currentGain);
      if (record.targetGain <= 0 && record.currentGain < 0.001 && record.source.isPlaying) {
        record.source.pause();
        record.playing = false;
      }
    }
  }

  beginCaughtAudio(settings = {}) {
    if (this.caughtAudioActive) return;
    this.caughtAudioActive = true;
    this.caughtAudioFinishing = false;
    this.caughtMusicMultiplier = Math.max(0, Math.min(1, Number(settings.caughtMusicVolumeMultiplier) || 0.2));
    this.caughtSirenVolume = Math.max(0, Math.min(1, Number(settings.caughtSirenVolume) || 0.8));
    this.caughtDroneAudioMultiplier = Math.max(0, Math.min(1, Number(settings.caughtDroneAudioMultiplier) || 0));
    this.caughtAudioFadeDuration = Math.max(0.01, Number(settings.caughtAudioFadeDuration) || 0.3);
    this._musicTargetVolume = this._musicVolumeTarget();
    this._musicFadeRemaining = this.caughtAudioFadeDuration;
    this._startSiren();
  }

  _startSiren() {
    if (!this.listener) return;
    if (!this.siren) {
      try { this.siren = new THREE.Audio(this.listener); } catch { return; }
      this._loadBuffer('siren', sirenUrl).then(buffer => {
        if (!buffer || !this.siren || !this.caughtAudioActive || this.caughtAudioFinishing) return;
        this.siren.setBuffer(buffer);
        this.siren.setLoop(true);
        this.siren.setVolume(0);
        this.sirenTargetVolume = this.caughtSirenVolume;
        this.sirenFadeRemaining = this.caughtAudioFadeDuration;
        this.resume();
        try { this.siren.play(); } catch { /* autoplay or context unavailable */ }
      });
      return;
    }
    this.sirenTargetVolume = this.caughtSirenVolume;
    this.sirenFadeRemaining = this.caughtAudioFadeDuration;
    this.resume();
    if (!this.siren.isPlaying) try { this.siren.play(); } catch { /* autoplay or context unavailable */ }
  }

  finishCaughtAudio() {
    if (!this.caughtAudioActive) return 0;
    this.caughtAudioFinishing = true;
    this.sirenTargetVolume = 0;
    this.sirenFadeRemaining = this.caughtAudioFadeDuration;
    this._scheduleSirenFade(0, this.caughtAudioFadeDuration);
    if (this._sirenStopTimer) clearTimeout(this._sirenStopTimer);
    this._sirenStopTimer = setTimeout(() => {
      this.siren?.stop?.();
      this._sirenStopTimer = null;
    }, this.caughtAudioFadeDuration * 1000);
    return this.siren?.isPlaying ? this.caughtAudioFadeDuration : 0;
  }

  endCaughtAudio() {
    this.caughtAudioActive = false;
    this.caughtAudioFinishing = false;
    if (this._sirenStopTimer) clearTimeout(this._sirenStopTimer);
    this._sirenStopTimer = null;
    this.sirenTargetVolume = 0;
    this.sirenFadeRemaining = 0;
    this.sirenVolume = 0;
    this.siren?.setVolume?.(0);
    this.siren?.stop?.();
    this._musicTargetVolume = this.musicVolume;
    this._musicFadeRemaining = this.caughtAudioFadeDuration;
  }

  _scheduleSirenFade(target, duration) {
    const gain = this.siren?.gain?.gain;
    const context = this.listener?.context;
    if (!gain || !context) return;
    const now = context.currentTime;
    try {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(this.sirenVolume, now);
      gain.linearRampToValueAtTime(target, now + Math.max(0.01, duration));
    } catch { /* WebAudio automation is optional in test/headless environments. */ }
  }

  stopSfx() {
    for (const sound of this.sounds.values()) { sound.pause(); sound.currentTime = 0; }
  }

  /** Stop effects and positional sources while preserving background music. */
  stopTransientAudio() {
    this.stopSfx();
    if (this._sirenStopTimer) clearTimeout(this._sirenStopTimer);
    this._sirenStopTimer = null;
    this.sirenTargetVolume = 0;
    this.sirenFadeRemaining = 0;
    this.sirenVolume = 0;
    this.siren?.setVolume?.(0);
    this.siren?.stop?.();
    for (const record of this._droneSources) {
      record.targetGain = 0;
      record.currentGain = 0;
      record.audible = false;
      record.source.setVolume(0);
      if (record.source.isPlaying) record.source.pause();
      record.playing = false;
    }
  }
}
