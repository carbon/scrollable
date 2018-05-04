"use strict";
var Carbon;
(function (Carbon) {
    let UserSelect = {
        blockSelect(e) {
            e.preventDefault();
            e.stopPropagation();
        },
        block() {
            document.body.focus();
            document.addEventListener('selectstart', UserSelect.blockSelect, true);
        },
        unblock() {
            document.removeEventListener('selectstart', UserSelect.blockSelect, true);
        }
    };
    let Util = {
        getRelativePositionY(y, relativeElement) {
            let box = relativeElement.getBoundingClientRect();
            let topOffset = box.top;
            return Math.max(0, Math.min(1, (y - topOffset) / relativeElement.offsetHeight));
        }
    };
    class Scrollbar {
        constructor(element, options) {
            this.dragging = false;
            this.listeners = [];
            if (!element)
                throw new Error('[Scrollbar] element is undefined');
            this.element = element;
            this.handleEl = this.element.querySelector('.handle');
            if (!this.handleEl)
                throw new Error('[Scrollbar] missing .handle');
            this.element.addEventListener('mouseover', () => { this.element.classList.add('hovering'); });
            this.element.addEventListener('mouseout', () => { this.element.classList.remove('hovering'); });
            this.element.addEventListener('click', (e) => { e.preventDefault(); });
            this.handleEl.addEventListener('mousedown', this.startDrag.bind(this));
            this.handleEl.addEventListener('mouseup', this.endDrag.bind(this));
            this.options = options || {};
            this.setup();
        }
        hide() {
            this.element.style.display = 'none';
        }
        show() {
            this.element.style.display = '';
        }
        setup() {
            this.height = this.element.clientHeight;
            this.handleHeight = this.handleEl.clientHeight;
        }
        startDrag(e) {
            UserSelect.block();
            this.mouseStartY = e.pageY;
            this.baseY = this.handleEl.offsetTop;
            this.dragging = true;
            this.update(e);
            this.listeners.push(new Observer(document, 'mousemove', this.update.bind(this)), new Observer(document, 'mouseup', this.endDrag.bind(this)));
        }
        endDrag(e) {
            UserSelect.unblock();
            this.dragging = false;
            this.update(e);
            while (this.listeners.length > 0) {
                this.listeners.pop().stop();
            }
        }
        update(e) {
            if (e.type == 'mousemove') {
                this.element.classList.add('dragging');
            }
            let delta = e.pageY - this.mouseStartY;
            var top = this.baseY + delta;
            if (top < 0) {
                top = 0;
            }
            if (top > this.height - this.handleHeight) {
                top = this.height - this.handleHeight;
            }
            this.handleEl.style.top = top + 'px';
            let percent = top / (this.height - this.handleHeight);
            if (this.options.onChange) {
                this.options.onChange(percent);
            }
        }
        setPercent(p) {
            let top = p * (this.height - this.handleEl.clientHeight);
            this.handleEl.style.top = top + 'px';
        }
        destroy() {
            this.element.remove();
        }
    }
    class Scrollable {
        constructor(element, options = {}) {
            this.native = false;
            if (!element)
                throw new Error('[Scrollable] element is undefined');
            this.element = element;
            if (this.element.dataset['setup'])
                return;
            this.element.dataset['setup'] = '1';
            this.contentEl = this.element.querySelector('.content');
            if (!this.contentEl)
                throw new Error('.content not found');
            let scrollBarEl = this.element.querySelector('.scrollbar');
            let ua = navigator.userAgent;
            if (!options.force && (ua.indexOf('Macintosh') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1)) {
                this.native = true;
                scrollBarEl && scrollBarEl.remove();
                this.element.classList.add('native');
            }
            else {
                this.scrollbar = new Scrollbar(scrollBarEl, {
                    onChange: this.onScroll.bind(this)
                });
                this.contentEl.addEventListener('wheel', this.onWheel.bind(this), true);
            }
            window.addEventListener('resize', this.check.bind(this));
            this.check();
            Scrollable.instances.set(this.element, this);
        }
        static get(el) {
            let instance = Scrollable.instances.get(el) || new Scrollable(el);
            instance.poke();
            return instance;
        }
        watch() {
            if (!MutationObserver)
                return;
            this.observer = new MutationObserver(mutations => {
                console.log('mutation, checking', mutations);
                this.check();
            });
            this.observer.observe(this.element, {
                attributes: false,
                childList: true
            });
        }
        poke() {
            this.check();
        }
        check() {
            this.viewportHeight = this.contentEl.clientHeight;
            this.contentHeight = this.contentEl.scrollHeight;
            this.maxTop = this.contentHeight - this.viewportHeight;
            let contentInViewPercent = this.viewportHeight / this.contentHeight;
            let handleHeight = this.viewportHeight * contentInViewPercent;
            if (contentInViewPercent >= 1) {
                this.element.classList.remove('overflowing');
                trigger(this.element, 'inview');
                this.scrollbar && this.scrollbar.hide();
            }
            else {
                this.element.classList.add('overflowing');
                trigger(this.element, 'overflowing');
                if (this.scrollbar) {
                    this.scrollbar.show();
                    this.scrollbar.handleEl.style.height = handleHeight + 'px';
                    this.scrollbar.setup();
                }
            }
        }
        onScroll(value) {
            let top = (this.contentHeight - this.viewportHeight) * value;
            this.scrollTo(top);
        }
        scrollTo(top) {
            this.contentEl.scrollTop = top;
        }
        onWheel(e) {
            e.preventDefault();
            let distance = e.deltaY * 1;
            var top = this.contentEl.scrollTop;
            top += distance;
            if (top <= 0)
                top = 0;
            if (top > this.maxTop) {
                top = this.maxTop;
            }
            this.scrollTo(top);
            let percent = top / this.maxTop;
            this.scrollbar.setPercent(percent);
        }
        dispose() {
            if (this.observer) {
                this.observer = null;
                this.observer.disconnect();
            }
        }
    }
    Scrollable.instances = new WeakMap();
    Carbon.Scrollable = Scrollable;
    class Observer {
        constructor(element, type, handler, useCapture = false) {
            this.element = element;
            this.type = type;
            this.handler = handler;
            this.useCapture = useCapture;
            this.element.addEventListener(type, handler, useCapture);
        }
        stop() {
            this.element.removeEventListener(this.type, this.handler, this.useCapture);
        }
    }
    function trigger(element, name, detail) {
        return element.dispatchEvent(new CustomEvent(name, {
            bubbles: true,
            detail: detail
        }));
    }
})(Carbon || (Carbon = {}));
