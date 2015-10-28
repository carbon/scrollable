var Carbon;
(function (Carbon) {
    "use strict";
    var UserSelect = {
        block: function () {
            document.body.focus();
            $(document).on('selectstart', false);
        },
        unblock: function () {
            $(document).off('selectstart');
        }
    };
    var Util = {
        getRelativePositionX: function (x, relativeElement) {
            var leftOffset = $(relativeElement).offset().left;
            return Math.max(0, Math.min(1, (x - leftOffset) / relativeElement.offsetWidth));
        },
        getRelativePositionY: function (y, relativeElement) {
            var topOffset = $(relativeElement).offset().top;
            return Math.max(0, Math.min(1, (y - topOffset) / relativeElement.offsetHeight));
        }
    };
    var Rail = (function () {
        function Rail(element, options) {
            var _this = this;
            this.dragging = false;
            this.element = element;
            this.handleEl = this.element.querySelector('.handle');
            this.element.addEventListener('mouseover', function () { _this.element.classList.add('hovering'); });
            this.element.addEventListener('mouseout', function () { _this.element.classList.remove('hovering'); });
            this.element.addEventListener('click', function (e) { e.preventDefault(); });
            this.handleEl.addEventListener('mousedown', this.startDrag.bind(this));
            this.handleEl.addEventListener('mouseup', this.endDrag.bind(this));
            this.options = options || {};
            this.setup();
        }
        Rail.prototype.hide = function () {
            this.element.style.display = 'none';
        };
        Rail.prototype.show = function () {
            this.element.style.display = '';
        };
        Rail.prototype.setup = function () {
            this.height = this.element.clientHeight;
            this.handleHeight = this.handleEl.clientHeight;
        };
        Rail.prototype.startDrag = function (e) {
            UserSelect.block();
            this.mouseStartY = e.pageY;
            this.baseY = this.handleEl.offsetTop;
            this.ho = Util.getRelativePositionY(e.pageY, this.handleEl) * this.handleHeight;
            this.dragging = true;
            this.update(e);
            return $(document).on({
                mousemove: this.update.bind(this),
                mouseup: this.endDrag.bind(this)
            });
        };
        Rail.prototype.endDrag = function (e) {
            UserSelect.unblock();
            this.dragging = false;
            this.update(e);
            $(document).off('mousemove mouseup');
        };
        Rail.prototype.update = function (e) {
            if (e.type == 'mousemove')
                this.element.classList.add('dragging');
            var delta = e.pageY - this.mouseStartY;
            var top = this.baseY + delta;
            if (top < 0) {
                top = 0;
            }
            if (top > this.height - this.handleHeight) {
                top = this.height - this.handleHeight;
            }
            this.handleEl.style.top = top + 'px';
            var percent = top / (this.height - this.handleHeight);
            if (this.options.onChange) {
                this.options.onChange(percent);
            }
        };
        Rail.prototype.setPercent = function (p) {
            var top = p * (this.height - this.handleEl.clientHeight);
            this.handleEl.style.top = top + 'px';
        };
        return Rail;
    })();
    var Scrollable = (function () {
        function Scrollable(element, options) {
            if (options === void 0) { options = {}; }
            this.native = false;
            this.element = element;
            if (this.element.classList.contains('setup'))
                return;
            this.element.classList.add('setup');
            this.contentEl = this.element.querySelector('.content');
            if (!this.contentEl)
                throw new Error('.content not found');
            var railEl = this.element.querySelector('carbon-scrollbar, .rail');
            this.rail = new Rail(railEl, {
                onChange: this.onScroll.bind(this)
            });
            var ua = navigator.userAgent;
            if (!options.force && (ua.indexOf('Macintosh') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1)) {
                this.native = true;
                this.rail.element.remove();
                this.element.classList.add('native');
            }
            else {
                this.contentEl.addEventListener('wheel', this.onWheel.bind(this), true);
            }
            window.addEventListener('resize', this.setup.bind(this));
            $(this.element).data('controller', this);
            this.setup();
        }
        Scrollable.prototype.poke = function () {
            this.setup();
        };
        Scrollable.prototype.setup = function () {
            this.viewportHeight = this.contentEl.clientHeight;
            this.contentHeight = this.contentEl.scrollHeight;
            this.maxTop = this.contentHeight - this.viewportHeight;
            var contentInViewPercent = this.viewportHeight / this.contentHeight;
            var handleHeight = this.viewportHeight * contentInViewPercent;
            if (contentInViewPercent >= 1) {
                this.element.classList.remove('overflowing');
                $(this.element).trigger('inview');
                if (!this.native) {
                    this.rail.hide();
                }
            }
            else {
                this.element.classList.add('overflowing');
                $(this.element).trigger('overflowing');
                if (!this.native) {
                    this.rail.show();
                }
            }
            if (!this.native) {
                this.rail.handleEl.style.height = handleHeight + 'px';
                this.rail.setup();
            }
        };
        Scrollable.prototype.onScroll = function (value) {
            var top = (this.contentHeight - this.viewportHeight) * value;
            this.scrollTo(top);
        };
        Scrollable.prototype.scrollTo = function (top) {
            this.contentEl.scrollTop = top;
            $(this.element).triggerHandler({
                type: 'scroll',
                top: top
            });
        };
        Scrollable.prototype.onWheel = function (e) {
            e.preventDefault();
            var distance = e.deltaY * 1;
            var top = this.contentEl.scrollTop;
            top += distance;
            if (top <= 0)
                top = 0;
            if (top > this.maxTop) {
                top = this.maxTop;
            }
            this.scrollTo(top);
            var percent = top / this.maxTop;
            this.rail.setPercent(percent);
        };
        return Scrollable;
    })();
    Carbon.Scrollable = Scrollable;
})(Carbon || (Carbon = {}));
