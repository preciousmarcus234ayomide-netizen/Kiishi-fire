class SoundEngine {
  private ctx: AudioContext | null = null;
  public sfxVolume = 0.7;
  public musicVolume = 0.35;
  public muted = false;
  private bgmInterval: number | null = null;
  private bgmStep = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public setVolumes(sfx: number, music: number, muted: boolean) {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    this.muted = muted;
  }

  public playUiClick() {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.045);
    gain.gain.setValueAtTime(0.08 * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playGunshot(category: 'ar' | 'sniper' | 'smg' | 'shotgun' | 'pistol') {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    const now = ctx.currentTime;

    // Noise burst for propellant crack
    const dur = category === 'sniper' ? 0.32 : category === 'shotgun' ? 0.28 : category === 'ar' ? 0.14 : 0.09;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.25));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = category === 'sniper' || category === 'shotgun' ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(
      category === 'sniper' ? 1400 : category === 'shotgun' ? 950 : category === 'smg' ? 1900 : 1600,
      now,
    );

    const nGain = ctx.createGain();
    const vol = (category === 'sniper' ? 0.42 : category === 'shotgun' ? 0.4 : 0.24) * this.sfxVolume;
    nGain.gain.setValueAtTime(vol, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter).connect(nGain).connect(ctx.destination);
    noise.start(now);

    // Low punch oscillator
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'sawtooth';
    const startFreq = category === 'sniper' ? 180 : category === 'shotgun' ? 130 : 220;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + Math.min(0.16, dur));
    oGain.gain.setValueAtTime(vol * 0.75, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(0.18, dur));
    osc.connect(oGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + Math.min(0.19, dur));
  }

  public playHitmarker(headshot = false) {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = headshot ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(headshot ? 1480 : 920, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 2100 : 480, now + 0.06);
    gain.gain.setValueAtTime(0.18 * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playReload() {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    const now = ctx.currentTime;
    [0, 0.22].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 0 ? 420 : 680, now + offset);
      gain.gain.setValueAtTime(0.08 * this.sfxVolume, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.06);
    });
  }

  public playExplosion() {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    const now = ctx.currentTime;
    const dur = 0.65;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.35));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5 * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
  }

  public playHeal() {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.11 * this.sfxVolume, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.27);
    });
  }

  public playVictory() {
    const ctx = this.ensureContext();
    if (!ctx || this.sfxVolume <= 0) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.11);
      gain.gain.setValueAtTime(0.15 * this.sfxVolume, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.46);
    });
  }

  public startLobbyPulse() {
    if (this.bgmInterval !== null) return;
    const notes = [110, 110, 130.81, 146.83, 110, 164.81, 146.83, 130.81];
    this.bgmInterval = window.setInterval(() => {
      if (this.muted || this.musicVolume <= 0.02) return;
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const freq = notes[this.bgmStep % notes.length];
      this.bgmStep++;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(340, now);
      gain.gain.setValueAtTime(0.032 * this.musicVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    }, 520);
  }

  public stopLobbyPulse() {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const soundEngine = new SoundEngine();
