/* Bridgeway Medical Logistics
   Mobile-only interaction glue that isn't form/data logic (site.js) and
   isn't GSAP animation (motion.js): the interactive coverage map, the
   sticky bottom CTA, and carousel dot indicators. Plain class-toggling,
   no GSAP dependency, no side effects if any target element is absent
   (this file loads on every page, most of which have none of these). */

(function () {
  'use strict';

  /* Interactive coverage map ---------------------------------------------
     Tap-to-highlight is the touch counterpart to the existing hover-only
     highlight in motion.js (canHover-gated). Expand is a dedicated button
     rather than tap-anywhere, so it never competes with a zone tap. */
  var mapFig = document.querySelector('.cov__map');
  var mapOut = document.getElementById('map-tap-out');
  if (mapFig) {
    var activeZone = null;
    mapFig.querySelectorAll('.map__zone').forEach(function (zone) {
      zone.addEventListener('click', function () {
        if (activeZone && activeZone !== zone) activeZone.classList.remove('is-active');
        zone.classList.toggle('is-active');
        activeZone = zone.classList.contains('is-active') ? zone : null;
        if (mapOut) {
          var title = zone.querySelector('title');
          mapOut.textContent = activeZone ? (title ? title.textContent + ' is in our service area.' : '') : '';
        }
      });
    });

    var expandBtn = mapFig.querySelector('.map__expand');
    if (expandBtn) {
      expandBtn.addEventListener('click', function () {
        var expanded = mapFig.classList.toggle('is-expanded');
        expandBtn.setAttribute('aria-pressed', String(expanded));
        expandBtn.textContent = expanded ? 'Collapse' : 'Expand';
      });
    }
  }

  /* Sticky bottom CTA -------------------------------------------------------
     Hides itself once the real quote form is in view, so there is never a
     floating CTA sitting on top of the form it points to. Without
     IntersectionObserver support the bar just stays visible -- an
     acceptable, non-broken degradation. */
  var stickyCta = document.getElementById('sticky-cta');
  var quoteSection = document.getElementById('quote');
  if (stickyCta && quoteSection && window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        stickyCta.classList.toggle('is-hidden', entry.isIntersecting);
      });
    }, { rootMargin: '0px 0px -40% 0px' });
    io.observe(quoteSection);
  }

  /* Carousel dot indicators -------------------------------------------------
     Only for Services and Steps: order is meaningful there (6 and 4 items).
     Why-list and the coverage zone-cards skip dots on purpose -- their order
     isn't sequential, and the "next card peeks" affordance already signals
     there's more to swipe. Dots double as click targets for anyone not
     swiping. IntersectionObserver per card (not a scroll listener) to avoid
     scroll-jank. */
  function addDots(trackSelector, cardSelector) {
    var track = document.querySelector(trackSelector);
    if (!track || !window.IntersectionObserver) return;
    var cards = Array.prototype.slice.call(track.querySelectorAll(cardSelector));
    if (cards.length < 2) return;

    var dotsEl = document.createElement('div');
    dotsEl.className = 'carousel__dots';
    dotsEl.setAttribute('aria-hidden', 'true');
    cards.forEach(function (card, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.tabIndex = -1;
      if (i === 0) dot.classList.add('is-active');
      dot.addEventListener('click', function () {
        card.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'smooth' });
      });
      dotsEl.appendChild(dot);
    });
    track.insertAdjacentElement('afterend', dotsEl);

    var dots = Array.prototype.slice.call(dotsEl.children);
    var cardObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var index = cards.indexOf(entry.target);
        if (index === -1) return;
        dots.forEach(function (dot, i) { dot.classList.toggle('is-active', i === index); });
      });
    }, { root: track, threshold: 0.6 });
    cards.forEach(function (card) { cardObserver.observe(card); });
  }

  addDots('#services .svc__grid', '.svc');
  addDots('#how .steps', '.step');
})();
