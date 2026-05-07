// Singleton AudioContext — unlocked during a user gesture (Start button),
// then reused when the timer fires (no gesture available at that point).
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
  return _ctx;
}

/** Call inside a click handler so the browser unlocks audio. */
export function unlockAudio() {
  try {
    const ctx = getCtx();
    ctx.resume().then(() => {
      // Play a silent 1ms node — required by Chrome/Android to truly unlock the context
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.001);
    }).catch(() => { /* ignore */ });
  } catch { /* ignore */ }
}

export function playTone(notes: { freq: number; duration: number; delay?: number }[]) {
  try {
    const ctx = getCtx();
    const play = () => {
      const now = ctx.currentTime;
      notes.forEach(({ freq, duration, delay = 0 }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + delay);
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(0.25, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
        osc.start(now + delay);
        osc.stop(now + delay + duration + 0.05);
      });
    };
    // Always resume — handles 'suspended' and iOS 'interrupted' states
    ctx.resume().then(play).catch(() => { try { play(); } catch { /* ignore */ } });
  } catch { /* AudioContext not available */ }
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

/** Shows a system notification — works even when the app is in background. */
export function notify(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icon-192.png', silent: false });
  } catch { /* ignore */ }
}
