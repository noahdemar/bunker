export class HUD {
  constructor(totalSeconds = 30 * 60) {
    this.total = totalSeconds;
    this.remaining = totalSeconds;
    this.timerEl = document.getElementById('timer');
    this.overlayEl = document.getElementById('overlay');
    this.fired = false;
    this.gameOver = false;
  }

  // Returns true on the first frame the timer reaches zero.
  update(dt) {
    if (this.fired) return false;
    this.remaining = Math.max(0, this.remaining - dt);
    const m = Math.floor(this.remaining / 60);
    const s = Math.floor(this.remaining % 60);
    this.timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    this.timerEl.classList.toggle('warn', this.remaining <= 60 && this.remaining > 10);
    this.timerEl.classList.toggle('critical', this.remaining <= 10);
    if (this.remaining <= 0) {
      this.fired = true;
      return true;
    }
    return false;
  }

  // outcome: 'rescued' | 'died-exposed' | 'died-thirst' | 'died-starvation'
  showResult(outcome) {
    if (this.gameOver) return;
    this.gameOver = true;
    const messages = {
      'rescued':         ['RESCUED',   'Your bunker held. Help has arrived.'],
      'died-exposed':    ['YOU DIED',  'The bomb caught you in the open.'],
      'died-thirst':     ['YOU DIED',  'You died of thirst — the water tank ran dry.'],
      'died-starvation': ['YOU DIED',  'You died of starvation — the food locker ran dry.'],
    };
    const [title, body] = messages[outcome] ?? ['GAME OVER', ''];
    this.overlayEl.classList.remove('hidden');
    this.overlayEl.querySelector('.panel').innerHTML =
      `<h1>${title}</h1><p>${body}</p><p style="opacity:0.7;margin-top:14px;">Reload to play again.</p>`;
    this.overlayEl.style.cursor = 'default';
  }
}
