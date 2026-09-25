/** Small synthesized sounds: no downloads, autoplay, or looping audio. */
class GameAudio {
  private context: AudioContext | undefined;
  muted = false;

  private getContext() {
    if (this.muted) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
      return this.context;
    } catch {
      return;
    }
  }

  private tone(
    context: AudioContext,
    frequency: number,
    when: number,
    duration: number,
    volume = 0.09,
    end = frequency,
  ) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, when);
    oscillator.frequency.exponentialRampToValueAtTime(end, when + duration);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  launch(index: number, delay = 0) {
    const context = this.getContext();
    if (!context) return;
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const note = notes[index % notes.length];
    this.tone(context, note * 0.7, context.currentTime + delay, 0.24, 0.075, note);
    this.tone(context, note * 2, context.currentTime + delay + 0.065, 0.27, 0.025);
  }

  blocked() {
    const context = this.getContext();
    if (context) this.tone(context, 160, context.currentTime, 0.15, 0.085, 95);
  }

  hint() {
    const context = this.getContext();
    if (context) this.tone(context, 880, context.currentTime, 0.28, 0.04, 1046.5);
  }

  win() {
    const context = this.getContext();
    if (!context) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((note, i) => {
      this.tone(context, note, context.currentTime + i * 0.105, 0.8, 0.07);
    });
  }
}

export const audio = new GameAudio();
