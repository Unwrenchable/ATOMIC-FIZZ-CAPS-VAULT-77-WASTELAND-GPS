// mobile-swipe.js
// -------------------------------------------------------
// Lightweight swipe gesture handler for mobile tab/panel navigation.
// Attaches to elements with [data-swipe-tabs] or [data-swipe-dismiss] attribute.
// Usage:
//   data-swipe-tabs=".selector"  — swipe left/right to advance/retreat tabs
//   data-swipe-dismiss           — swipe left fires a 'swiped-dismiss' CustomEvent
// -------------------------------------------------------

(function () {
  'use strict';

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const SWIPE_THRESHOLD = 50;   // px — minimum horizontal travel to count as swipe
  const SWIPE_RESTRAINT = 100;  // px — maximum vertical travel allowed for horizontal swipe

  /**
   * Attach swipe-left / swipe-right event listeners to an element.
   * Fires CustomEvent('swipeleft') and CustomEvent('swiperight') on the element.
   *
   * @param {HTMLElement} el - Element to add swipe detection to
   */
  function attachSwipeListeners(el) {
    if (!el || el._swipeAttached) return;
    el._swipeAttached = true;

    let startX = 0;
    let startY = 0;

    el.addEventListener('touchstart', function (e) {
      const touch = e.changedTouches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: true });

    el.addEventListener('touchend', function (e) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (Math.abs(deltaX) >= SWIPE_THRESHOLD && Math.abs(deltaY) <= SWIPE_RESTRAINT) {
        const eventName = deltaX > 0 ? 'swiperight' : 'swipeleft';
        el.dispatchEvent(new CustomEvent(eventName, { bubbles: true }));
      }
    }, { passive: true });
  }

  /**
   * Wire swipe-tab navigation onto a single container element.
   * Also attaches the underlying touch listeners if not already present.
   *
   * @param {HTMLElement} container - Element with [data-swipe-tabs] attribute
   */
  function wireSwipeTabsOnElement(container) {
    if (!container || container._swipeTabsWired) return;
    container._swipeTabsWired = true;

    attachSwipeListeners(container);

    container.addEventListener('swipeleft', function () {
      const tabSel = container.dataset.swipeTabs;
      const tabs = Array.from(container.querySelectorAll(tabSel));
      const activeIdx = tabs.findIndex(function (t) { return t.classList.contains('active'); });
      const next = tabs[activeIdx + 1];
      if (next) next.click();
    });

    container.addEventListener('swiperight', function () {
      const tabSel = container.dataset.swipeTabs;
      const tabs = Array.from(container.querySelectorAll(tabSel));
      const activeIdx = tabs.findIndex(function (t) { return t.classList.contains('active'); });
      const prev = tabs[activeIdx - 1];
      if (prev) prev.click();
    });
  }

  /**
   * Wire swipe-to-dismiss behaviour onto a single element.
   * Also attaches the underlying touch listeners if not already present.
   * Fires CustomEvent('swiped-dismiss') on the element when swiped left.
   *
   * @param {HTMLElement} el - Element with [data-swipe-dismiss] attribute
   */
  function wireSwipeDismissOnElement(el) {
    if (!el || el._swipeDismissWired) return;
    el._swipeDismissWired = true;

    attachSwipeListeners(el);

    el.addEventListener('swipeleft', function () {
      el.dispatchEvent(new CustomEvent('swiped-dismiss', { bubbles: true }));
    });
  }

  /**
   * Initialise swipe navigation on all elements that have [data-swipe-tabs] attribute.
   * The attribute value should be a CSS selector for the tab buttons inside the container.
   *
   * Example markup:
   *   <div class="pipboy-panel" data-swipe-tabs=".pipboy-tab">
   *     <button class="pipboy-tab active" data-tab="map">MAP</button>
   *     <button class="pipboy-tab" data-tab="inv">INV</button>
   *   </div>
   */
  function initSwipeTabs() {
    document.querySelectorAll('[data-swipe-tabs]').forEach(wireSwipeTabsOnElement);
  }

  /**
   * Init swipe-to-dismiss on elements with [data-swipe-dismiss] attribute.
   */
  function initSwipeDismiss() {
    document.querySelectorAll('[data-swipe-dismiss]').forEach(wireSwipeDismissOnElement);
  }

  function init() {
    initSwipeTabs();
    initSwipeDismiss();
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-init if new panels are dynamically added — wire full behaviour, not just touch listeners.
  // Debounced to avoid per-frame overhead on pages with frequent DOM updates.
  if (typeof MutationObserver !== 'undefined') {
    var _mutationTimer = null;
    var _pendingNodes = [];

    function _processPendingNodes() {
      _mutationTimer = null;
      var nodes = _pendingNodes.splice(0);
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.nodeType !== 1) continue;

        // Wire [data-swipe-tabs] on the node itself and any descendants
        if (node.dataset && node.dataset.swipeTabs) wireSwipeTabsOnElement(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('[data-swipe-tabs]').forEach(wireSwipeTabsOnElement);
        }

        // Wire [data-swipe-dismiss] on the node itself and any descendants
        if (node.dataset && node.dataset.swipeDismiss !== undefined) wireSwipeDismissOnElement(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('[data-swipe-dismiss]').forEach(wireSwipeDismissOnElement);
        }
      }
    }

    var observer = new MutationObserver(function (mutations) {
      for (var mi = 0; mi < mutations.length; mi++) {
        var added = mutations[mi].addedNodes;
        for (var ni = 0; ni < added.length; ni++) {
          _pendingNodes.push(added[ni]);
        }
      }
      if (_mutationTimer === null) {
        // Process on next idle frame — debounces rapid successive mutations
        _mutationTimer = typeof requestAnimationFrame !== 'undefined'
          ? requestAnimationFrame(_processPendingNodes)
          : setTimeout(_processPendingNodes, 0);
      }
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  Game.modules.mobileSwipe = { init, attachSwipeListeners, wireSwipeTabsOnElement, wireSwipeDismissOnElement };
})();
