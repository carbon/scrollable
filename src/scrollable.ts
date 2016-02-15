"use strict";

module Carbon {   
  var UserSelect = {
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

  var Util = {
   getRelativePositionY(y, relativeElement: HTMLElement) {
      let box = relativeElement.getBoundingClientRect();
     
      let topOffset = box.top;
             
      return Math.max(0, Math.min(1, (y - topOffset) / relativeElement.offsetHeight));
    }
  };

  class Rail {
    element: HTMLElement;
    handleEl: HTMLElement;
    height: number;
        
    handleHeight: number;
    baseY: number;
    mouseStartY: number;
    
    dragging = false;
        
    options: any;
    
    listeners: Observer[] = [ ];
    
    constructor(element: HTMLElement, options) {
      this.element = element;
  
      this.handleEl = <HTMLElement>this.element.querySelector('.handle');
      
      this.element.addEventListener('mouseover', () => { this.element.classList.add('hovering'); });
      this.element.addEventListener('mouseout', () => { this.element.classList.remove('hovering'); });
      this.element.addEventListener('click', (e) => { e.preventDefault(); });
           
      this.handleEl.addEventListener('mousedown', this.startDrag.bind(this));
      this.handleEl.addEventListener('mouseup', this.endDrag.bind(this));
  
      this.options = options || { };
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
      this.handleHeight =  this.handleEl.clientHeight;
    }
  
    startDrag(e: MouseEvent) {
      UserSelect.block();
      
      this.mouseStartY = e.pageY;
      this.baseY = this.handleEl.offsetTop; 
      
      // Handle Offset
      // this.handleOffset = Util.getRelativePositionY(e.pageY, this.handleEl) * this.handleHeight;
   
      this.dragging = true;
     
      this.update(e);
  	 
      this.listeners.push(
        new Observer(document, 'mousemove', this.update.bind(this)),
        new Observer(document, 'mouseup', this.endDrag.bind(this))
      );
    }
  
    endDrag(e: MouseEvent) {
      UserSelect.unblock();
      
      this.dragging = false;
  
      this.update(e);
      
      while (this.listeners.length > 0) {        
        this.listeners.pop().stop();
      }
    }
  
    update(e) {
      if (e.type == 'mousemove') this.element.classList.add('dragging');
  
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
  
    setPercent(p: number) {  
      let top = p * (this.height - this.handleEl.clientHeight);
  
      this.handleEl.style.top = top + 'px';
    }
  }
  
  
  export class Scrollable {
    static instances = new WeakMap<HTMLElement, Scrollable>();
        
    element: HTMLElement;
    contentEl: HTMLElement;
    rail: Rail;
    
    viewportHeight: number;
    contentHeight: number;
    maxTop: number;
    
    native = false;   

    static get(el: HTMLElement) : Scrollable {
      let instance = Scrollable.instances.get(el) || new Scrollable(el);
      
      instance.poke();
      
      return instance;
    }
    
    constructor(element: HTMLElement, options : any = { }) {
      this.element = element;
  
      if (this.element.classList.contains('setup')) return;
  
      this.element.classList.add('setup');
  
      this.contentEl = <HTMLElement>this.element.querySelector('.content');
    
      if (!this.contentEl) throw new Error('.content not found');
      
      let railEl = <HTMLElement>this.element.querySelector('carbon-scrollbar, .rail');
  
      this.rail = new Rail(railEl, {
        onChange: this.onScroll.bind(this)
      });
  
      let ua = navigator.userAgent;
  
      if (!options.force && (ua.indexOf('Macintosh') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1)) {
        this.native = true;
  
        this.rail.element.remove();
  
        this.element.classList.add('native');
      }
      else {  
        this.contentEl.addEventListener('wheel', this.onWheel.bind(this), true);
      }
      
      window.addEventListener('resize', this.setup.bind(this));
     
      this.setup();   
  
      Scrollable.instances.set(this.element, this);
    }
  
    poke() {
      this.setup();
    }
    
    setup() {      
      this.viewportHeight = this.contentEl.clientHeight;
  
      this.contentHeight = this.contentEl.scrollHeight;
  
      this.maxTop = this.contentHeight - this.viewportHeight;
  
      let contentInViewPercent = this.viewportHeight / this.contentHeight;
  
      let handleHeight = this.viewportHeight * contentInViewPercent;
      
      if (contentInViewPercent >= 1) {
        this.element.classList.remove('overflowing');
  	 
        trigger(this.element, 'inview');
        
        if (!this.native) {
          this.rail.hide();
        }
      }
      else {
        this.element.classList.add('overflowing');
  	 
    	  trigger(this.element, 'overflowing');
    
        if (!this.native) {
          this.rail.show();
        }
      }
    
      if (!this.native) {
        this.rail.handleEl.style.height = handleHeight + 'px';
  
        this.rail.setup();
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
      e.preventDefault();
      
      // TODO: Support line & page scrolling w/ deltaMode
      let distance = e.deltaY * 1;
      
      var top = this.contentEl.scrollTop;
  
      top += distance;
  
      if (top <= 0) top = 0;
  
      if (top > this.maxTop) {
        top = this.maxTop;
      }
      
      this.scrollTo(top);
  
      let percent = top / this.maxTop;
      
      this.rail.setPercent(percent);
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