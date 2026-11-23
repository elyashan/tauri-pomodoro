export type AmbientSoundType = "off" | "brown" | "pink" | "white" | "rain";

class AmbientNoiseEngine {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private activeSound: AmbientSoundType = "off";
  private isPlaying = false;
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createNoiseBuffer(
    ctx: AudioContext,
    kind: Exclude<AmbientSoundType, "off">,
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate || 44100;
    const durationSec = 4;
    const length = sampleRate * durationSec;
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);

      if (kind === "brown") {
        let lastOut = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = Math.max(-1, Math.min(1, lastOut * 3.4));
        }
      } else if (kind === "pink") {
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        let b3 = 0;
        let b4 = 0;
        let b5 = 0;
        let b6 = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.969 * b2 + white * 0.153852;
          b3 = 0.8665 * b3 + white * 0.3104856;
          b4 = 0.55 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.016898;
          const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          b6 = white * 0.115926;
          data[i] = Math.max(-1, Math.min(1, out * 0.11));
        }
      } else if (kind === "rain") {
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        let dropEnv = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.997 * b0 + white * 0.08;
          b1 = 0.985 * b1 + white * 0.14;
          b2 = 0.95 * b2 + white * 0.22;
          // Hafif yağmur damlası parıltıları
          if (Math.random() < 0.0018) {
            dropEnv = 0.35 + Math.random() * 0.35;
          } else {
            dropEnv *= 0.994;
          }
          const hiss = (b0 + b1 + b2) * 0.16;
          const drop = white * dropEnv * 0.22;
          data[i] = Math.max(-1, Math.min(1, hiss + drop));
        }
      } else {
        // soft white
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.35;
        }
      }

      // Döngü geçişinde çıtırtı olmasın diye uçları yumuşak cross-fade ile bağla
      const fadeSamples = Math.min(2048, Math.floor(length / 16));
      for (let i = 0; i < fadeSamples; i++) {
        const k = i / fadeSamples;
        const startSample = data[i];
        const endSample = data[length - fadeSamples + i];
        data[i] = startSample * k + endSample * (1 - k);
        data[length - fadeSamples + i] = endSample * k + startSample * (1 - k);
      }
    }

    return buffer;
  }

  private tearDownNodes(): void {
    if (this.fadeOutTimer !== null) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }
    try {
      this.sourceNode?.stop();
    } catch {
      // already stopped
    }
    this.sourceNode?.disconnect();
    this.filterNode?.disconnect();
    this.gainNode?.disconnect();
    this.sourceNode = null;
    this.filterNode = null;
    this.gainNode = null;
    this.isPlaying = false;
  }

  public setConfig(
    sound: AmbientSoundType,
    volumePct: number,
    active: boolean,
  ): void {
    if (this.fadeOutTimer !== null) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }
    const clampedVol = Math.max(0, Math.min(100, volumePct)) / 100;
    const targetGain = active && sound !== "off" ? clampedVol * 0.32 : 0;

    if (!active || sound === "off" || clampedVol <= 0.001) {
      if (this.isPlaying && this.ctx && this.gainNode) {
        try {
          const now = this.ctx.currentTime;
          this.gainNode.gain.cancelScheduledValues(now);
          this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
          this.gainNode.gain.linearRampToValueAtTime(0, now + 0.16);
          this.isPlaying = false;
          this.fadeOutTimer = window.setTimeout(() => {
            this.fadeOutTimer = null;
            if (this.isPlaying) return;
            this.tearDownNodes();
          }, 180);
        } catch {
          this.tearDownNodes();
        }
      } else {
        this.tearDownNodes();
      }
      this.activeSound = sound;
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (this.isPlaying && this.activeSound === sound && this.gainNode) {
      try {
        const now = ctx.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.14);
      } catch {
        // ignore audio scheduling edge
      }
      return;
    }

    this.tearDownNodes();
    this.activeSound = sound;

    try {
      const source = ctx.createBufferSource();
      source.buffer = this.createNoiseBuffer(ctx, sound);
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value =
        sound === "brown"
          ? 380
          : sound === "rain"
            ? 1900
            : sound === "pink"
              ? 2200
              : 4200;
      filter.Q.value = 0.7;

      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(targetGain, now + 0.18);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      this.sourceNode = source;
      this.filterNode = filter;
      this.gainNode = gain;
      this.isPlaying = true;
    } catch {
      this.tearDownNodes();
    }
  }

  public stop(): void {
    this.tearDownNodes();
    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const ambientNoiseEngine = new AmbientNoiseEngine();
