const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class VirtualJoystick {
  constructor({ input, deadZone = 0.14 } = {}) {
    this.input = input;
    this.deadZone = clamp(deadZone, 0, 0.9);
    this.root = null;
    this.thumb = null;
    this.pointerId = null;

    this.onPointerDown = (event) => this.start(event);
    this.onPointerMove = (event) => this.move(event);
    this.onPointerUp = (event) => this.end(event);
  }

  mount(host = document.body) {
    if (this.root) return this;

    const root = document.createElement('div');
    root.className = 'tq-joystick';
    root.setAttribute('aria-label', 'Controle de navegação');
    root.innerHTML = '<div class="tq-joystick__base"><div class="tq-joystick__thumb"></div></div>';

    this.root = root;
    this.thumb = root.querySelector('.tq-joystick__thumb');

    root.addEventListener('pointerdown', this.onPointerDown);
    root.addEventListener('pointermove', this.onPointerMove);
    root.addEventListener('pointerup', this.onPointerUp);
    root.addEventListener('pointercancel', this.onPointerUp);
    root.addEventListener('lostpointercapture', this.onPointerUp);

    host.appendChild(root);
    return this;
  }

  start(event) {
    if (this.pointerId !== null) return;

    event.preventDefault();
    event.stopPropagation();

    this.pointerId = event.pointerId;
    this.root.setPointerCapture?.(event.pointerId);
    this.root.classList.add('is-active');
    this.updateFromPointer(event);
  }

  move(event) {
    if (event.pointerId !== this.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    this.updateFromPointer(event);
  }

  end(event) {
    if (this.pointerId === null) return;
    if (event?.pointerId != null && event.pointerId !== this.pointerId) return;

    event?.preventDefault?.();
    event?.stopPropagation?.();

    try {
      if (this.root?.hasPointerCapture?.(this.pointerId)) {
        this.root.releasePointerCapture(this.pointerId);
      }
    } catch {}

    this.pointerId = null;
    this.root?.classList.remove('is-active');
    this.thumb?.style.setProperty('transform', 'translate3d(0,0,0)');
    this.input?.setAnalog?.(0, 0, 0, false);
  }

  updateFromPointer(event) {
    const rect = this.root.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = Math.max(1, rect.width * 0.5 - 17);

    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const cappedDistance = Math.min(distance, radius);

    const dirX = distance > 0 ? dx / distance : 0;
    const dirY = distance > 0 ? dy / distance : 0;

    const thumbX = dirX * cappedDistance;
    const thumbY = dirY * cappedDistance;
    this.thumb.style.transform = `translate3d(${thumbX}px,${thumbY}px,0)`;

    const rawMagnitude = clamp(distance / radius, 0, 1);

    if (rawMagnitude <= this.deadZone) {
      this.input?.setAnalog?.(0, 0, 0, true);
      return;
    }

    const magnitude = clamp(
      (rawMagnitude - this.deadZone) / (1 - this.deadZone),
      0,
      1
    );

    this.input?.setAnalog?.(
      dirX * magnitude,
      dirY * magnitude,
      magnitude,
      true
    );
  }

  destroy() {
    if (!this.root) return;

    this.end({ pointerId: this.pointerId, preventDefault() {}, stopPropagation() {} });

    this.root.removeEventListener('pointerdown', this.onPointerDown);
    this.root.removeEventListener('pointermove', this.onPointerMove);
    this.root.removeEventListener('pointerup', this.onPointerUp);
    this.root.removeEventListener('pointercancel', this.onPointerUp);
    this.root.removeEventListener('lostpointercapture', this.onPointerUp);
    this.root.remove();

    this.root = null;
    this.thumb = null;
  }
}
