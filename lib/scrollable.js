/*!
 * jQuery Mousewheel 3.1.13
 *
 * Copyright 2015 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 */
!function (a) { "function" == typeof define && define.amd ? define(["jquery"], a) : "object" == typeof exports ? module.exports = a : a(jQuery); }(function (a) { function b(b) { var g = b || window.event, h = i.call(arguments, 1), j = 0, l = 0, m = 0, n = 0, o = 0, p = 0; if (b = a.event.fix(g), b.type = "mousewheel", "detail" in g && (m = -1 * g.detail), "wheelDelta" in g && (m = g.wheelDelta), "wheelDeltaY" in g && (m = g.wheelDeltaY), "wheelDeltaX" in g && (l = -1 * g.wheelDeltaX), "axis" in g && g.axis === g.HORIZONTAL_AXIS && (l = -1 * m, m = 0), j = 0 === m ? l : m, "deltaY" in g && (m = -1 * g.deltaY, j = m), "deltaX" in g && (l = g.deltaX, 0 === m && (j = -1 * l)), 0 !== m || 0 !== l) {
    if (1 === g.deltaMode) {
        var q = a.data(this, "mousewheel-line-height");
        j *= q, m *= q, l *= q;
    }
    else if (2 === g.deltaMode) {
        var r = a.data(this, "mousewheel-page-height");
        j *= r, m *= r, l *= r;
    }
    if (n = Math.max(Math.abs(m), Math.abs(l)), (!f || f > n) && (f = n, d(g, n) && (f /= 40)), d(g, n) && (j /= 40, l /= 40, m /= 40), j = Math[j >= 1 ? "floor" : "ceil"](j / f), l = Math[l >= 1 ? "floor" : "ceil"](l / f), m = Math[m >= 1 ? "floor" : "ceil"](m / f), k.settings.normalizeOffset && this.getBoundingClientRect) {
        var s = this.getBoundingClientRect();
        o = b.clientX - s.left, p = b.clientY - s.top;
    }
    return b.deltaX = l, b.deltaY = m, b.deltaFactor = f, b.offsetX = o, b.offsetY = p, b.deltaMode = 0, h.unshift(b, j, l, m), e && clearTimeout(e), e = setTimeout(c, 200), (a.event.dispatch || a.event.handle).apply(this, h);
} } function c() { f = null; } function d(a, b) { return k.settings.adjustOldDeltas && "mousewheel" === a.type && b % 120 === 0; } var e, f, g = ["wheel", "mousewheel", "DOMMouseScroll", "MozMousePixelScroll"], h = "onwheel" in document || document.documentMode >= 9 ? ["wheel"] : ["mousewheel", "DomMouseScroll", "MozMousePixelScroll"], i = Array.prototype.slice; if (a.event.fixHooks)
    for (var j = g.length; j;)
        a.event.fixHooks[g[--j]] = a.event.mouseHooks; var k = a.event.special.mousewheel = { version: "3.1.12", setup: function () { if (this.addEventListener)
        for (var c = h.length; c;)
            this.addEventListener(h[--c], b, !1);
    else
        this.onmousewheel = b; a.data(this, "mousewheel-line-height", k.getLineHeight(this)), a.data(this, "mousewheel-page-height", k.getPageHeight(this)); }, teardown: function () { if (this.removeEventListener)
        for (var c = h.length; c;)
            this.removeEventListener(h[--c], b, !1);
    else
        this.onmousewheel = null; a.removeData(this, "mousewheel-line-height"), a.removeData(this, "mousewheel-page-height"); }, getLineHeight: function (b) { var c = a(b), d = c["offsetParent" in a.fn ? "offsetParent" : "parent"](); return d.length || (d = a("body")), parseInt(d.css("fontSize"), 10) || parseInt(c.css("fontSize"), 10) || 16; }, getPageHeight: function (b) { return a(b).height(); }, settings: { adjustOldDeltas: !0, normalizeOffset: !0 } }; a.fn.extend({ mousewheel: function (a) { return a ? this.bind("mousewheel", a) : this.trigger("mousewheel"); }, unmousewheel: function (a) { return this.unbind("mousewheel", a); } }); });
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
                $(this.contentEl).on('mousewheel', this.onMouseWheel.bind(this));
            }
            $(window).on('resize', this.setup.bind(this));
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
        Scrollable.prototype.onMouseWheel = function (e) {
            var top = this.contentEl.scrollTop;
            top += (-e.deltaY * e.deltaFactor);
            if (top <= 0)
                top = 0;
            if (top > this.maxTop) {
                top = this.maxTop;
            }
            e.preventDefault();
            this.scrollTo(top);
            var percent = top / this.maxTop;
            this.rail.setPercent(percent);
        };
        return Scrollable;
    })();
    Carbon.Scrollable = Scrollable;
})(Carbon || (Carbon = {}));
