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
      document.removeEventListener('selectstart', UserSelect.blockSelect, true);
    }    
  };

  let _ = {
    getRelativePositionY(y: number, relativeElement: HTMLElement) {
      let box = relativeElement.getBoundingClientRect();
     
      let topOffset = box.top;
             
      return Math.max(0, Math.min(1, (y - topOffset) / relativeElement.offsetHeight));
    }
  };

  export class Scrollable {
    static instances = new WeakMap<HTMLElement, Scrollable>();
        
    element: HTMLElement;
    scrollbar: Scrollbar;
    content: ScrollableContent;
    
    native = false; 
    _lineHeight: number;

    mutationObserver: MutationObserver;
    resizeObserver: ResizeObserver;

    checkRequest: any;
    hasNestedControls: boolean;

    // Reactive
    
    static get(el: HTMLElement) : Scrollable {
      let instance = Scrollable.instances.get(el) || new Scrollable(el);
      
      instance.poke();
      
      return instance;
    }
    
    constructor(element: HTMLElement, options: any = { }) {
      if (!element) { 
        throw new Error('[Scrollable] element is undefined');
      }

      this.element = element;
  
      this.hasNestedControls = this.element.querySelectorAll('.scrollable').length > 0;

      if (this.element.dataset['setup']) return;
  
      this.element.dataset['setup'] = '1';

      let contentEl: HTMLElement = this.element.querySelector('.content');
      let scrollBarEl: HTMLElement = this.element.querySelector('.scrollbar');

      if (!contentEl) {
        throw new Error('No .content child');
      }
      
      this.content = new ScrollableContent(contentEl, this);
          
      let isMobile = navigator.maxTouchPoints && navigator.maxTouchPoints > 2;

      if (!options.force && (navigator.userAgent.indexOf('Mac') > -1 || isMobile)) {
        this.native = true;
  
        scrollBarEl && scrollBarEl.remove();
        
        this.element.classList.add('native');
      }
      else {  
        this.scrollbar = new Scrollbar(scrollBarEl, {
          onChange: this.onScroll.bind(this)
        });

        this.content.element.addEventListener('wheel', this.onWheel.bind(this), true);
      }
      
      if (window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(this.onResize.bind(this));

        this.resizeObserver.observe(this.element);
        
      }
      else {
        window.addEventListener('resize', this.check.bind(this));
      }

      this.check();   
      this.watch();
  
      Scrollable.instances.set(this.element, this);
    }

    onResize(e) {
      this.requestCheck();
    }

    watch() {
      if (this.mutationObserver) return;

      if (!MutationObserver) return;

      this.mutationObserver = new MutationObserver(this.requestCheck.bind(this));
      
      this.mutationObserver.observe(this.content.element, {
        attributes: false,
        childList: true,
        subtree: true
      });
    }  
    
    requestCheck() {
      this.checkRequest && cancelAnimationFrame(this.checkRequest);
      this.checkRequest = requestAnimationFrame(this.check.bind(this));
    }

    poke() {
      this.requestCheck();
    }
    
    get maxTop() {
      return this.content.height - this.viewportHeight;
    }

    get viewportHeight() {
     return this.content.element.clientHeight; 
    }

    get handleHeight() {
      let contentInViewPercent = this.viewportHeight / this.content.height;
  
      return this.viewportHeight * contentInViewPercent;
    }

    get overflowing() {
      let contentInViewPercent = this.viewportHeight / this.content.height;

      return contentInViewPercent < 1;
    }

    check() {       
      this.checkRequest = null;

      if (this.overflowing) {
        this.element.classList.add('overflowing');
        
        this.scrollbar.active = true;

    	  trigger(this.element, 'overflowing');
    
        if (this.scrollbar) {
          this.scrollbar.show();

          this.scrollbar.handleEl.style.height = this.handleHeight + 'px';  
        }
      }
      else {
        this.element.classList.remove('overflowing');
  	 
        trigger(this.element, 'inview');
        
        this.scrollbar.active = false;

        this.scrollbar && this.scrollbar.hide();
      }
    }
  
    set position(value: number) {
      let top = (this.content.height - this.viewportHeight) * value;
  
      this.content.element.scrollTop = top;
    }

    get lineHeight(): number {
      if (this._lineHeight !== undefined) { 
        return this._lineHeight;
      }

      let tempEl = document.createElement('p');

      tempEl.textContent = 'A';

      this.content.element.append(tempEl);
      
      this._lineHeight = tempEl.clientHeight;

      if (this._lineHeight === 0) {
        this._lineHeight = 20;
      }
      tempEl.remove();

      return this._lineHeight;
    }

    onScroll(value: number) {
      this.position = value;
    }
  
    onWheel(e: WheelEvent) {
      e.preventDefault(); // prevent the entire browser window from being scrolled
      
      let targetEl = e.target as HTMLElement;

      if (this.hasNestedControls) {
        let containerEl = targetEl.closest('.scrollable');

        // Ensure that the event wasn't handled by a nested scrollable element
        if (containerEl !== this.element) {
          return;
        }
      }

      let pY = e.deltaY * 1; // y delta in pixels

      if (e.deltaMode === 1) { // LINE        
        pY *= this.lineHeight;
      } else if (e.deltaMode === 2) { // PAGE
        pY *= this.viewportHeight;
      }

      let top = this.content.scrollTop;
  
      top += pY;
  
      if (top <= 0) top = 0;
  
      if (top > this.maxTop) {
        top = this.maxTop;
      }
            
      this.content.scrollTop = top;
    }
    
    dispose() {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }

      if (this.mutationObserver) { 
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
    }
  }

  class ScrollableContent {
    element: HTMLElement;
    scrollable: Scrollable;

    constructor(element: HTMLElement, scrollable: Scrollable) {
      this.element = element;
      this.scrollable = scrollable;
    }

    get height() {
      return this.element.scrollHeight;
    }

    get scrollTop() {
      return this.element.scrollTop;
    }

    set scrollTop(top: number) {
      this.element.scrollTop = top;
      
      let position = top / this.scrollable.maxTop;

      this.scrollable.scrollbar.position = position;
    }
  }

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

    mouseMoveObserver: Observer;
    
    constructor(element: HTMLElement, options: any) {
      if (!element) { 
        throw new Error('[Scrollbar] element is undefined');
      }
      
      this.element = element;
  
      this.handleEl = this.element.querySelector('.handle') as HTMLElement;

      if (!this.handleEl) throw new Error('[Scrollbar] missing .handle');

      this.handleEl.addEventListener('mousedown', this.startDrag.bind(this), true);
  
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
  
    startDrag(e: PointerEvent) {
      e.preventDefault();
      e.stopPropagation();

      UserSelect.block();
      
      this.mouseStartY = e.pageY;
      this.baseY = this.handleEl.offsetTop; 
      
      this.dragging = true;
     
      this.element.classList.add('dragging');

      this.onDrag(e);
     
      this.mouseMoveObserver = new Observer(document, 'mousemove', this.onDrag.bind(this));

      document.addEventListener('mouseup', this.endDrag.bind(this), {
        once: true
      });     
    }
  
    endDrag(e: PointerEvent) {
      e.preventDefault();
      e.stopPropagation();
      
      UserSelect.unblock();
      
      this.dragging = false;

      this.element.classList.remove('dragging');
  
      this.onDrag(e);
      
      this.mouseMoveObserver.stop();
    }
  
    onDrag(e: PointerEvent) {
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
  
    get position() {
      return this.height
    }

    set position(value: number) {  
      let top = value * (this.height - this.handleEl.clientHeight);
  
      this.handleEl.style.top = top + 'px';

      this.onChange();
    }

    destroy() {
      this.element.remove();
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