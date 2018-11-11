module Carbon {   
  let UserSelect = {
    blockSelect(e: Event) { 
     e.preventDefault();
     e.stopPropagation();
    },
    
    block() {
      document.body.focus();
      
      document.addEventListener('selectstart', UserSelect.blockSelect, true);
    },
    
    unblock() {
       document.removeEventListener('selectstart', UserSelect.blockSelect);
    }    
  };

  let _ = {
    getRelativePositionY(y: number, relativeElement: HTMLElement) {
      let box = relativeElement.getBoundingClientRect();
     
      let topOffset = box.top;
             
      return Math.max(0, Math.min(1, (y - topOffset) / relativeElement.offsetHeight));
    }
  };

  class Scrollbar {
    element: HTMLElement;
    handleEl: HTMLElement;
    baseY: number;
    mouseStartY: number;
    
    dragging = false;
    options: any;
    autohide: boolean;
    timeout: number;
    active = true;

    listeners: Observer[] = [ ];
    
    constructor(element: HTMLElement, options) {
      if (!element) { 
        throw new Error('[Scrollbar] element is undefined');
      }
      
      this.element = element;
  
      this.handleEl = this.element.querySelector('.handle') as HTMLElement;

      if (!this.handleEl) throw new Error('[Scrollbar] missing .handle');

      this.handleEl.addEventListener('mousedown', this.startDrag.bind(this));
  
      this.options = options || { };

      this.autohide = this.element.hasAttribute('autohide');

      if (this.autohide) {
        this.element.classList.add('hidden');
      }      
    }
   
    hide() {
      this.element.classList.remove('visible');
      this.element.style.display = 'none';
    }
  
    show() {
      this.element.classList.add('visible');
      this.element.style.display = null;
    }

    get height() {
      return this.element.clientHeight;
    }

    get handleHeight() {
      return this.handleEl.clientHeight;
    }
  
    startDrag(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();

      UserSelect.block();
      
      this.mouseStartY = e.pageY;
      this.baseY = this.handleEl.offsetTop; 
      
      this.dragging = true;
     
      this.element.classList.add('dragging');

      this.update(e);
  	 
      this.listeners.push(
        new Observer(document, 'mousemove', this.update.bind(this)),
        new Observer(document, 'mouseup', this.endDrag.bind(this))
      );
    }
  
    endDrag(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      
      UserSelect.unblock();
      
      this.dragging = false;

      this.element.classList.remove('dragging');
  
      this.update(e);
      
      while (this.listeners.length > 0) {        
        this.listeners.pop().stop();
      }
    }
  
    update(e) {
      let delta = e.pageY - this.mouseStartY;
  
      let top = this.baseY + delta;
  
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

      this.timeout && clearTimeout(this.timeout);

      this.onChange();
    }

    private onChange() {
      if (this.autohide) {
        this.element.classList.remove('hidden');

        if (this.timeout) {
          clearTimeout(this.timeout);
        }

        this.timeout = setTimeout(() => {
          this.element.classList.add('hidden');
        }, 250);
      }
    }
  
    setPosition(position: number) {  
      let top = position * (this.height - this.handleEl.clientHeight);
  
      this.handleEl.style.top = top + 'px';

      this.onChange();
    }

    destroy() {
      this.element.remove();
    }
  }

  export class Scrollable {
    static instances = new WeakMap<HTMLElement, Scrollable>();
        
    element: HTMLElement;
    contentEl: HTMLElement;
    scrollbar: Scrollbar;
    
    viewportHeight: number;
    contentHeight: number;
    maxTop: number;
    
    native = false;   

    mutationObserver: MutationObserver;
    resizeObserver: ResizeObserver;

    static get(el: HTMLElement) : Scrollable {
      let instance = Scrollable.instances.get(el) || new Scrollable(el);
      
      instance.poke();
      
      return instance;
    }
    
    constructor(element: HTMLElement, options : any = { }) {
      if (!element) throw new Error('[Scrollable] element is undefined');

      this.element = element;
  
      if (this.element.dataset['setup']) return;
  
      this.element.dataset['setup'] = '1';

      this.contentEl = this.element.querySelector('.content') as HTMLElement;
    
      if (!this.contentEl) throw new Error('.content not found');
      
      let scrollBarEl = this.element.querySelector('.scrollbar') as HTMLElement;
  
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
      
      if (window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(entries => {
          this.check();
        });

        this.resizeObserver.observe(this.element);
        
      }
      else {
        window.addEventListener('resize', this.check.bind(this));
      }

      this.check();   
      this.watch();
  
      Scrollable.instances.set(this.element, this);
    }

    watch() {
      if (this.mutationObserver) return;

      if (!MutationObserver) return;

      this.mutationObserver = new MutationObserver(mutations => {
        this.check();
      });
      
      this.mutationObserver.observe(this.contentEl, {
        attributes: false,
        childList: true,
        subtree: true
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
        
        this.scrollbar.active = false;

        this.scrollbar && this.scrollbar.hide();
      }
      else {
        this.element.classList.add('overflowing');
        
        this.scrollbar.active = true;

    	  trigger(this.element, 'overflowing');
    
        if (this.scrollbar) {
          this.scrollbar.show();

          this.scrollbar.handleEl.style.height = handleHeight + 'px';  
        }
      }
    }
  
    onScroll(value: number) {      
      let top = (this.contentHeight - this.viewportHeight) * value;
  
      this.scrollTo(top);
    }
  
    scrollTo(top: number) {
      this.contentEl.scrollTop = top;
    }
  
    onWheel(e: WheelEvent) {      
      e.preventDefault(); // prevent the entire browser window from being scrolled
      
      let containerEl = e.target.closest('.scrollable');

      // Ensure that the event wasn't handled by a nested scrollable element
      if (containerEl !== this.element) {
        return;
      }

      let distance = e.deltaY * 1;
      let top = this.contentEl.scrollTop;
  
      top += distance;
  
      if (top <= 0) top = 0;
  
      if (top > this.maxTop) {
        top = this.maxTop;
      }
      
      this.scrollTo(top);
  
      let position = top / this.maxTop;
      
      this.scrollbar.setPosition(position);
    }
    
    dispose() {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }

      if (this.observer) { 
        this.observer.disconnect();
        this.observer = null;
      }
    }
  }
  
  class Observer {
    constructor(public element: Element | Document, public type, public handler, public useCapture = false) {
      this.element.addEventListener(type, handler, useCapture);
    }
     
    stop() {
      this.element.removeEventListener(this.type, this.handler, this.useCapture)
    }
  }
  
  function trigger(element: Element | Window, name: string, detail?) : boolean {
    return element.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      detail: detail
    }));
  }
}