import coin from '../assets/audio/coin.ogg?url';
import jump from '../assets/audio/jump.ogg?url';
import charging from '../assets/audio/charging.ogg?url';
import explosion from '../assets/audio/explosion.ogg?url';
import Track01 from '../assets/music/Track01.ogg?url';

export class AudioManager {
  constructor(createAudio = url => new Audio(url), tracks = { Track01 }) {
    this.createAudio = createAudio;
    this.tracks = tracks;
    this.sounds = new Map();
    this.musicTracks = new Map();
    this.musicVolume = 0.2;
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
    this.music.volume = this.musicVolume;
    this.musicActive = true;
    const music = this.music;
    const generation = this.musicGeneration;
    try {
      music.play()?.catch(() => { if (this.musicGeneration === generation) this.musicActive = false; });
    } catch { this.musicActive = false; }
  }
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.music) this.music.volume = this.musicVolume;
  }
  stopMusic() {
    this.musicGeneration = (this.musicGeneration ?? 0) + 1;
    if (this.music) { this.music.pause(); this.music.currentTime = 0; }
    this.musicActive = false;
  }
  stopSfx() {
    for (const sound of this.sounds.values()) { sound.pause(); sound.currentTime = 0; }
  }
}
