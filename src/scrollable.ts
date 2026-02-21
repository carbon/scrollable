function blockSelect(e: Event) {
  e.preventDefault();
  e.stopPropagation();
}

function blockUserSelect() {
  document.body.focus();
  document.addEventListener('selectstart', blockSelect, true);
}

function unblockUserSelect() {
  document.removeEventListener('selectstart', blockSelect, true);
}

function trigger(element: Element | Window, name: string, detail?: any): boolean {
  return element.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
}

class Scrollbar {
  element: HTMLElement;
  handleEl: HTMLElement;
  active = true;

  #baseY = 0;
  #mouseStartY = 0;
  #autohide: boolean;
  #timeout: ReturnType<typeof setTimeout> | null = null;
  #dragAbortController: AbortController | null = null;
  #onChange: (percent: number) => void;

  constructor(element: HTMLElement, options: { onChange: (value: number) => void }) {
    if (!element) throw new Error('[Scrollbar] element is undefined');

    this.element = element;
    this.#onChange = options.onChange;

    this.handleEl = this.element.querySelector<HTMLElement>('.handle')!;
    if (!this.handleEl) throw new Error('[Scrollbar] missing .handle');

    this.handleEl.addEventListener('mousedown', this.#startDrag.bind(this), true);

    this.#autohide = this.element.hasAttribute('autohide');
    if (this.#autohide) {
      this.element.classList.add('hidden');
    }
  }

  hide() {
    this.element.classList.remove('visible');
    this.element.style.display = 'none';
  }

  show() {
    this.element.classList.add('visible');
    this.element.style.display = '';
  }

  get height() {
    return this.element.clientHeight;
  }

  get handleHeight() {
    return this.handleEl.clientHeight;
  }

  get position(): number {
    const range = this.height - this.handleHeight;
    return range > 0 ? this.handleEl.offsetTop / range : 0;
  }

  set position(value: number) {
    const top = value * (this.height - this.handleEl.clientHeight);
    this.handleEl.style.top = `${top}px`;
    this.#scheduleAutohide();
  }

  #startDrag(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    blockUserSelect();

    this.#mouseStartY = e.pageY;
    this.#baseY = this.handleEl.offsetTop;
    this.element.classList.add('dragging');
    this.#updateHandleFromEvent(e);

    this.#dragAbortController = new AbortController();
    const { signal } = this.#dragAbortController;

    document.addEventListener('mousemove', (e) => this.#updateHandleFromEvent(e), { signal });
    document.addEventListener('mouseup', (e) => this.#endDrag(e), { signal, once: true });
  }

  #endDrag(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    unblockUserSelect();

    this.element.classList.remove('dragging');
    this.#updateHandleFromEvent(e);
    this.#dragAbortController?.abort();
    this.#dragAbortController = null;
  }

  #updateHandleFromEvent(e: MouseEvent) {
    const delta = e.pageY - this.#mouseStartY;
    const range = this.height - this.handleHeight;
    const top = Math.max(0, Math.min(this.#baseY + delta, range));

    this.handleEl.style.top = `${top}px`;

    const percent = range > 0 ? top / range : 0;
    this.#onChange(percent);
    this.#scheduleAutohide();
  }

  #scheduleAutohide() {
    if (!this.#autohide) return;

    this.element.classList.remove('hidden');

    if (this.#timeout) clearTimeout(this.#timeout);
    this.#timeout = setTimeout(() => {
      this.element.classList.add('hidden');
    }, 250);
  }

  destroy() {
    this.element.remove();
  }
}

class ScrollableContent {
  element: HTMLElement;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  get height() {
    return this.element.scrollHeight;
  }

  get scrollTop() {
    return this.element.scrollTop;
  }

  set scrollTop(top: number) {
    this.element.scrollTop = top;
  }
}

export class Scrollable {
  static instances = new WeakMap<HTMLElement, Scrollable>();

  element: HTMLElement;
  scrollbar: Scrollbar | null = null;
  content: ScrollableContent;
  native = false;

  #lineHeightCache: number | null = null;
  #mutationObserver: MutationObserver | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #checkRequest: number | null = null;
  #hasNestedControls: boolean;

  static get(el: HTMLElement): Scrollable {
    const instance = Scrollable.instances.get(el) ?? new Scrollable(el);
    instance.poke();
    return instance;
  }

  constructor(element: HTMLElement, options: { force?: boolean } = {}) {
    if (!element) throw new Error('[Scrollable] element is undefined');
    if (element.dataset['setup']) {
      const existing = Scrollable.instances.get(element);
      if (existing) return existing;
    }

    this.element = element;
    this.element.dataset['setup'] = '1';

    this.#hasNestedControls = element.querySelectorAll('.scrollable').length > 0;

    const contentEl = element.querySelector<HTMLElement>('.content');
    if (!contentEl) throw new Error('[Scrollable] No .content child');

    this.content = new ScrollableContent(contentEl);

    const scrollBarEl = element.querySelector<HTMLElement>('.scrollbar');
    const isMobile = navigator.maxTouchPoints > 2;

    if (!options.force && (navigator.userAgent.includes('Mac') || isMobile)) {
      this.native = true;
      scrollBarEl?.remove();
      element.classList.add('native');
    } else {
      if (!scrollBarEl) throw new Error('[Scrollable] No .scrollbar child in non-native mode');

      this.scrollbar = new Scrollbar(scrollBarEl, { onChange: this.#onScroll.bind(this) });
      contentEl.addEventListener('wheel', this.#onWheel.bind(this), { capture: true, passive: false });
    }

    if (window.ResizeObserver) {
      this.#resizeObserver = new ResizeObserver(this.#requestCheck.bind(this));
      this.#resizeObserver.observe(element);
    } else {
      window.addEventListener('resize', this.#requestCheck.bind(this));
    }

    this.#watch();
    this.#check();

    Scrollable.instances.set(element, this);
  }

  #watch() {
    if (this.#mutationObserver || !MutationObserver) return;

    this.#mutationObserver = new MutationObserver(this.#requestCheck.bind(this));
    this.#mutationObserver.observe(this.content.element, {
      childList: true,
      subtree: true
    });
  }

  #requestCheck() {
    if (this.#checkRequest !== null) cancelAnimationFrame(this.#checkRequest);
    this.#checkRequest = requestAnimationFrame(() => this.#check());
  }

  poke() {
    this.#requestCheck();
  }

  get maxTop() {
    return this.content.height - this.viewportHeight;
  }

  get viewportHeight() {
    return this.content.element.clientHeight;
  }

  get handleHeight() {
    const ratio = this.viewportHeight / this.content.height;
    return this.viewportHeight * ratio;
  }

  get overflowing() {
    return this.content.height > this.viewportHeight;
  }

  #check() {
    this.#checkRequest = null;

    if (this.overflowing) {
      this.element.classList.add('overflowing');
      trigger(this.element, 'overflowing');

      if (this.scrollbar) {
        this.scrollbar.active = true;
        this.scrollbar.show();
        this.scrollbar.handleEl.style.height = `${this.handleHeight}px`;
      }
    } else {
      this.element.classList.remove('overflowing');
      trigger(this.element, 'inview');

      if (this.scrollbar) {
        this.scrollbar.active = false;
        this.scrollbar.hide();
      }
    }
  }

  set position(value: number) {
    this.content.scrollTop = (this.content.height - this.viewportHeight) * value;
  }

  get #lineHeight(): number {
    if (this.#lineHeightCache !== null) return this.#lineHeightCache;

    const p = document.createElement('p');
    p.textContent = 'A';
    this.content.element.append(p);
    this.#lineHeightCache = p.clientHeight || 20;
    p.remove();

    return this.#lineHeightCache;
  }

  #onScroll(value: number) {
    this.position = value;
  }

  #onWheel(e: WheelEvent) {
    e.preventDefault();

    if (this.#hasNestedControls) {
      const container = (e.target as HTMLElement).closest('.scrollable');
      if (container !== this.element) return;
    }

    let deltaY = e.deltaY;

    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      deltaY *= this.#lineHeight;
    } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      deltaY *= this.viewportHeight;
    }

    const top = Math.max(0, Math.min(this.content.scrollTop + deltaY, this.maxTop));
    this.content.scrollTop = top;

    if (this.scrollbar) {
      this.scrollbar.position = top / this.maxTop;
    }
  }

  dispose() {
    this.#resizeObserver?.disconnect();
    this.#mutationObserver?.disconnect();
    this.#resizeObserver = null;
    this.#mutationObserver = null;
  }
}