export interface NoteSpec {
  freq: number;
  time: number;
  dur: number;
}

export interface PlayNotesOptions {
  type?: OscillatorType;
  peakGain?: number;
  attackSec?: number;
  releasePadSec?: number;
  closeAfterMs?: number;
}

export function playNotes(
  notes: NoteSpec[],
  options: PlayNotesOptions = {},
): void {
  const {
    type = "sine",
    peakGain = 0.12,
    attackSec = 0.025,
    releasePadSec = 0.05,
    closeAfterMs = 800,
  } = options;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(
        peakGain,
        ctx.currentTime + time + attackSec,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + time + dur,
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + dur + releasePadSec);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, closeAfterMs);
  } catch {
    // Ses cihazı meşgulse sessizce geç
  }
}

export function playCelebrationFanfare(): void {
  playNotes(
    [
      { freq: 523.25, time: 0.0, dur: 0.16 }, // C5
      { freq: 659.25, time: 0.13, dur: 0.16 }, // E5
      { freq: 783.99, time: 0.26, dur: 0.2 }, // G5
      { freq: 1046.5, time: 0.42, dur: 0.45 }, // C6
      { freq: 1318.51, time: 0.58, dur: 0.7 }, // E6
    ],
    {
      type: "triangle",
      peakGain: 0.18,
      attackSec: 0.025,
      releasePadSec: 0.05,
      closeAfterMs: 1500,
    },
  );
}

export function playBreakChime(): void {
  playNotes(
    [
      { freq: 587.33, time: 0.0, dur: 0.22 }, // D5
      { freq: 880.0, time: 0.16, dur: 0.4 }, // A5
    ],
    {
      type: "sine",
      peakGain: 0.12,
      attackSec: 0.025,
      releasePadSec: 0.05,
      closeAfterMs: 800,
    },
  );
}

export function playAlarmChime(): void {
  playNotes(
    [
      { freq: 880.0, time: 0.0, dur: 0.12 },
      { freq: 880.0, time: 0.15, dur: 0.18 },
    ],
    {
      type: "sine",
      peakGain: 0.12,
      attackSec: 0.02,
      releasePadSec: 0.04,
      closeAfterMs: 450,
    },
  );
}
