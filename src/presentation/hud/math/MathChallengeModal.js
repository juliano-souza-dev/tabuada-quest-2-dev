const HALLOWEEN_BG = new URL(
  '../../../../assets/hud/math/popup-recolha-de-tesouro-halloween.webp',
  import.meta.url
).href;

export class MathChallengeModal {
  constructor() {
    this.opened = false;

    this.root = document.createElement('div');
    this.root.className = 'tq-math-modal';
    this.root.hidden = true;

    this.root.innerHTML = `
      <div class="tq-math-modal__panel">
        <img class="tq-math-modal__art" src="${HALLOWEEN_BG}" alt="">
        <div class="tq-math-modal__content">
          <div class="tq-math-modal__question"></div>
          <input
            class="tq-math-modal__input"
            inputmode="numeric"
            pattern="[0-9]*"
            autocomplete="off"
            aria-label="Resposta"
          >
          <button class="tq-math-modal__submit" type="button">
            Confirmar
          </button>
        </div>
      </div>
    `;

    this.questionEl =
      this.root.querySelector('.tq-math-modal__question');

    this.inputEl =
      this.root.querySelector('.tq-math-modal__input');

    this.submitEl =
      this.root.querySelector('.tq-math-modal__submit');

    document.body.appendChild(this.root);
  }

  open(challenge) {
    if (this.opened) {
      return Promise.resolve(false);
    }

    this.opened = true;
    this.root.hidden = false;
    this.questionEl.textContent = challenge.text;
    this.inputEl.value = '';

    queueMicrotask(() => {
      this.inputEl.focus({ preventScroll: true });
    });

    return new Promise((resolve) => {
      const finish = () => {
        const value = Number(this.inputEl.value);
        const correct =
          Number.isFinite(value) &&
          value === challenge.answer;

        this.close();
        resolve(correct);
      };

      const onKey = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          finish();
        }
      };

      const cleanup = () => {
        this.submitEl.removeEventListener('click', finish);
        this.inputEl.removeEventListener('keydown', onKey);
      };

      this.submitEl.addEventListener('click', finish, { once: true });
      this.inputEl.addEventListener('keydown', onKey);

      this._cleanup = cleanup;
    });
  }

  close() {
    this._cleanup?.();
    this._cleanup = null;
    this.opened = false;
    this.root.hidden = true;
    this.inputEl.blur();
  }

  destroy() {
    this.close();
    this.root.remove();
  }
}
