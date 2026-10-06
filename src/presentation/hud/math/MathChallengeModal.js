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
      <div class="tq-math-modal__panel" role="dialog" aria-modal="true">
        <img class="tq-math-modal__art" src="${HALLOWEEN_BG}" alt="">
        <button class="tq-math-modal__close" type="button" aria-label="Fechar"></button>
        <div class="tq-math-modal__question"></div>
        <div class="tq-math-modal__answers" role="group" aria-label="Opções de resposta"></div>
      </div>
    `;

    this.questionEl =
      this.root.querySelector('.tq-math-modal__question');

    this.answersEl =
      this.root.querySelector('.tq-math-modal__answers');

    this.closeEl =
      this.root.querySelector('.tq-math-modal__close');

    document.body.appendChild(this.root);
  }

  open(challenge) {
    if (this.opened) {
      return Promise.resolve(false);
    }

    this.opened = true;
    this.root.hidden = false;
    this.questionEl.textContent = challenge.text;
    this.answersEl.replaceChildren();

    return new Promise((resolve) => {
      const finish = (value) => {
        const correct =
          Number(value) === Number(challenge.answer);

        this.close();
        resolve(correct);
      };

      const onClose = () => {
        this.close();
        resolve(false);
      };

      for (const option of challenge.options || []) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tq-math-modal__answer';
        button.textContent = String(option);
        button.addEventListener(
          'click',
          () => finish(option),
          { once: true }
        );
        this.answersEl.appendChild(button);
      }

      this.closeEl.addEventListener(
        'click',
        onClose,
        { once: true }
      );

      this._cleanup = () => {
        this.closeEl.removeEventListener(
          'click',
          onClose
        );
      };
    });
  }

  close() {
    this._cleanup?.();
    this._cleanup = null;
    this.opened = false;
    this.root.hidden = true;
    this.answersEl.replaceChildren();
  }

  destroy() {
    this.close();
    this.root.remove();
  }
}
