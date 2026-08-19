/* =============================================================================
   Bridgeway — motion system
   GSAP 3.13 + ScrollTrigger, both self-hosted in assets/js/vendor/.

   Design brief: cinematic, not loud. The buyer is a practice manager or a
   hospital procurement officer deciding whether this courier will lose their
   specimen. Motion here is meant to read as "expensive and considered", which
   means committed entrances and real depth, but never scroll-jacking, never
   pinning the page, and never delaying the phone number.

   PROGRESSIVE ENHANCEMENT CONTRACT
   The page is fully readable with no JavaScript. `html.js-motion` is what
   hides elements ahead of their entrance, and that class is only trusted while
   this file is alive: it is added by an inline script in <head>, removed again
   by a timeout if this file never runs, and removed by the catch below if
   setup throws part way. A visitor never ends up staring at a blank section
   because a CDN blinked or a browser choked on a plugin.

   REDUCED MOTION
   Everything is inside gsap.matchMedia(). Under `prefers-reduced-motion:
   reduce` the only thing that runs is a reveal — no transforms, no
   ScrollTriggers, no parallax. Motion sensitivity is common enough in a
   clinical audience that this is not a nice-to-have.

   Sections:
     01  Boot and safety net
     02  Helpers
     03  Page load: the hero timeline
     04  Scroll: parallax and depth
     05  Scroll: section entrances
     06  Hover: micro-interactions
     07  Click: FAQ accordion and button press
     08  State: ZIP checker and form feedback
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;

  /* --- 01 · Boot and safety net -------------------------------------------
     If GSAP did not load at all, strip the class immediately and stop. The
     page then behaves exactly as it did before this file existed, including
     the CSS hero animation, which is left in place as the no-JS fallback. */
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js-motion');
    return;
  }

  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);

  /* Transforms are the only thing animated on scroll, so let GSAP use the
     compositor and stop ScrollTrigger from firing callbacks it does not need. */
  gsap.defaults({ ease: 'power3.out' });
  window.ScrollTrigger.config({ limitCallbacks: true, ignoreMobileResize: true });

  try {
    build();
    /* Only now is it safe to leave elements hidden: every entrance that hides
       something also owns the tween that reveals it. */
    window.__bwMotionReady = true;
    guardAgainstStall();
  } catch (err) {
    /* A broken animation must never cost the visitor the content. */
    root.classList.remove('js-motion');
    if (window.console && console.warn) console.warn('Motion disabled:', err);
  }

  /* Last line of defence against a blank page.

     Once GSAP owns the entrances, the elements are held at opacity 0 by inline
     style rather than by the `js-motion` class, so the <head> timeout can no
     longer rescue them. Everything then depends on GSAP's ticker, which is
     driven by requestAnimationFrame — and rAF does not run in a background
     tab. That part is fine and deliberate: a tab nobody is looking at should
     not burn a frame budget, and GSAP resumes and plays the entrance properly
     once the tab is focused.

     What is NOT fine is a visible page whose ticker never advances. It is rare
     (an rAF-less renderer, a scripted screenshot harness, an aggressive power
     saver), but the failure is total: the visitor sees nothing at all. So if
     the page is visible and the global timeline still has not moved after
     three seconds, the entrances are jumped to their finished state. The
     animation is lost; the content is not. That is the right trade. */
  function guardAgainstStall() {
    setTimeout(function () {
      if (document.visibilityState === 'hidden') return;   // legitimately paused
      if (gsap.globalTimeline.time() > 0) return;          // ticking normally
      gsap.globalTimeline.progress(1);
      if (window.console && console.warn) {
        console.warn('Motion ticker stalled; entrances completed instantly.');
      }
    }, 3000);
  }

  function build() {

    /* THE HANDOVER, and the one piece of ordering that must not be moved.

       `gsap.from()` reads an element's *current* value and uses it as the
       animation's END state. While `js-motion` is on the page every hidden
       element computes to opacity 0, so every entrance would animate 0 -> 0
       and the content would never appear. So the hide class comes off here,
       the instant GSAP is confirmed present and before a single tween exists.

       No flash results: class removal and every from() below run in the same
       synchronous task, and from() renders its start state immediately, so the
       browser has no opportunity to paint the un-hidden state in between.

       `motion-on` replaces it and is never removed. It is what keeps the CSS
       keyframe fallbacks switched off, and that has to outlive `js-motion` or
       the old hero animation would run underneath the GSAP one. */
    root.classList.add('motion-on');
    root.classList.remove('js-motion');

    /* Everything `html.js-motion` hides in the stylesheet, listed once here.
       This array and the `html.js-motion` block in site.css section 18 must
       stay identical: anything hidden there but missing here is never revealed
       under reduced motion, and anything here but not there just flashes.
       Section 18 carries the same warning. */
    var HIDDEN = [
      '.site-head', '.hero__bg', '.hero__copy .display', '.hero__lead',
      '.hero__copy .btn', '.section-head > *', '.svc', '.why__fig',
      '.why__body > h2', '.why__body > p', '.why__list > li',
      '.step', '.step__num', '.cov__card', '.zipcheck',
      '.cov__served-grid > li', '.comp__item',
      '.faq__item', '.quote__head > *', '.form__row', '.form__req',
      '.form__note', '.form__submit', '.site-foot .wrap > *',
      '.map__zone', '.map__hub', '.map__hub-glow', '.map__leader',
      '.map__chip', '.map__hub-label'
    ];

    /* --- 02 · Helpers ---------------------------------------------------- */

    var q = function (sel, ctx) { return (ctx || document).querySelector(sel); };
    var qa = function (sel, ctx) { return gsap.utils.toArray(sel, ctx); };

    /* Split a single-line heading into word spans so the headline can rise in
       sequence rather than as one block. Done by hand instead of pulling in
       SplitText: this only needs to handle one heading of plain text, and the
       word spans keep the sentence intact for screen readers and for select-
       and-copy. `display:inline-block` on the inner span is what makes the
       per-word transform possible; the outer span clips it. */
    function splitWords(el) {
      if (!el || el.dataset.split === 'done') return [];
      var words = el.textContent.trim().split(/\s+/);
      var frag = document.createDocumentFragment();
      var inners = [];

      words.forEach(function (word, i) {
        var mask = document.createElement('span');
        mask.className = 'mask';
        var inner = document.createElement('span');
        inner.className = 'mask__i';
        inner.textContent = word;
        mask.appendChild(inner);
        frag.appendChild(mask);
        if (i < words.length - 1) frag.appendChild(document.createTextNode(' '));
        inners.push(inner);
      });

      el.textContent = '';
      el.appendChild(frag);
      el.dataset.split = 'done';
      return inners;
    }

    /* A standard scroll entrance. Everything on the page that simply "arrives"
       goes through this so the timing language stays consistent: same easing,
       same distance, same trigger point. Variation comes from stagger and
       direction, not from every section inventing its own curve. */
    function reveal(targets, opts) {
      targets = qa(targets);
      if (!targets.length) return null;
      opts = opts || {};

      /* The named trigger is an intent, not a guarantee: these selectors run
         across four pages and a wrapper that exists on the homepage may not
         exist on About. Falling back to the first target keeps the entrance
         working instead of handing ScrollTrigger a selector that matches
         nothing — which would leave the elements hidden for good. */
      var trigger = targets[0];
      if (typeof opts.trigger === 'string') trigger = q(opts.trigger) || targets[0];
      else if (opts.trigger) trigger = opts.trigger;

      return gsap.from(targets, {
        y: opts.y != null ? opts.y : 34,
        x: opts.x || 0,
        opacity: 0,
        scale: opts.scale != null ? opts.scale : 1,
        duration: opts.duration || 0.85,
        ease: opts.ease || 'power3.out',
        stagger: opts.stagger != null ? opts.stagger : 0.07,
        scrollTrigger: {
          trigger: trigger,
          start: opts.start || 'top 85%',
          once: true
        }
      });
    }

    var mm = gsap.matchMedia();

    mm.add({
      motion: '(prefers-reduced-motion: no-preference)',
      reduced: '(prefers-reduced-motion: reduce)',
      canHover: '(hover: hover) and (pointer: fine)',
      wide: '(min-width: 60rem)'
    }, function (ctx) {

      var c = ctx.conditions;

      /* Reduced motion: reveal and stop. No transforms, no ScrollTrigger, no
         parallax. The page is static and complete. */
      if (c.reduced) {
        gsap.set(hiddenSelectors(), { opacity: 1, clearProps: 'all' });
        root.classList.remove('js-motion');
        return;
      }

      /* --- 03 · Page load: the hero timeline ----------------------------- */

      var heroH1 = q('.hero__copy .display');
      var heroWords = splitWords(heroH1);

      /* The stylesheet hides the heading to prevent a flash of un-split text.
         Once the words are wrapped, their masks do the hiding instead, so the
         heading itself must be handed back its opacity — otherwise nothing
         downstream ever reveals it. */
      if (heroH1) gsap.set(heroH1, { opacity: 1 });

      var load = gsap.timeline({ defaults: { ease: 'power3.out' } });

      /* The header is on every page, so it is animated unconditionally. Every
         hero tween below is guarded, because About, Thanks and 404 have a
         header and a footer but no hero — and an entrance that never runs
         leaves its element hidden by the stylesheet permanently. */
      load.from('.site-head', {
        yPercent: -100,
        opacity: 0,
        duration: 0.8
      }, 0.05);

      if (q('.hero')) {
        /* The photograph settles from a slight push-in. This is the single
           most "cinematic" move on the page and it is deliberately slow —
           1.6s — because a fast zoom reads as a slideshow transition. */
        load.from('.hero__bg', {
          scale: 1.09,
          opacity: 0,
          duration: 1.6,
          ease: 'power2.out'
        }, 0);

        /* Words rise out of their masks. 0.055 stagger over six words is about
           330ms of sequence: enough to read as choreography, short enough that
           the headline is legible almost immediately. */
        if (heroWords.length) {
          load.from(heroWords, {
            yPercent: 118,
            duration: 0.95,
            ease: 'power4.out',
            stagger: 0.055
          }, 0.25);
        }

        load.from('.hero__lead', { y: 26, opacity: 0, duration: 0.85 }, 0.6)
            .from('.hero__copy .btn', {
              y: 22,
              opacity: 0,
              duration: 0.7,
              stagger: 0.09,
              /* back.out is the one place a spring-ish overshoot is used. On
                 the call button it reads as confidence; anywhere else on this
                 site it would read as toy-like. */
              ease: 'back.out(1.5)'
            }, 0.74);
      }

      /* --- 04 · Scroll: parallax and depth ------------------------------- */

      if (q('.hero')) {
        /* Hero photo drifts slower than the page. 12% is well under the point
           where the crop starts to show its edges, and `ease:none` is required
           for anything scrubbed — an eased scrub fights the scrollbar. */
        gsap.to('.hero__bg', {
          yPercent: 12,
          ease: 'none',
          scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6
          }
        });

        /* Copy leaves slightly faster than the photo and fades as it goes,
           which is what actually sells the depth: two planes, two speeds. */
        gsap.to('.hero__copy', {
          yPercent: -18,
          opacity: 0.15,
          ease: 'none',
          scrollTrigger: {
            trigger: '.hero',
            start: 'center center',
            end: 'bottom top',
            scrub: 0.6
          }
        });
      }

      /* Services header photograph, same idea at a smaller amplitude. Desktop
         only, because it is display:none below 60rem. */
      if (c.wide && q('.svc__intro')) {
        gsap.to('.svc__photo', {
          yPercent: 9,
          ease: 'none',
          scrollTrigger: { trigger: '.svc__intro', start: 'top bottom', end: 'bottom top', scrub: 0.6 }
        });
      }

      /* The compliance shield drifts and rotates a few degrees across the whole
         band. It is a watermark, so it can move further than content. */
      if (c.wide && q('.comp__watermark')) {
        gsap.to('.comp__watermark', {
          yPercent: -22,
          rotation: 8,
          ease: 'none',
          scrollTrigger: { trigger: '.comp', start: 'top bottom', end: 'bottom top', scrub: 0.8 }
        });
      }

      /* Header gains a shadow and tightens once the hero is behind it. */
      var head = q('.site-head');
      if (head) {
        window.ScrollTrigger.create({
          start: 'top -80',
          end: 99999,
          onToggle: function (self) {
            head.classList.toggle('is-stuck', self.isActive);
          }
        });
      }

      /* --- 05 · Scroll: section entrances -------------------------------- */

      /* Section headers everywhere: eyebrow, heading, rule, in that order. */
      qa('.section-head').forEach(function (headEl) {
        reveal(headEl.children, { trigger: headEl, y: 28, stagger: 0.08 });
      });

      /* Service cards. `from: 'start'` with a grid stagger reads left-to-right,
         top-to-bottom — the same order the eye already scans. */
      reveal('.svc', {
        trigger: '.svc__grid',
        y: 46,
        duration: 0.8,
        stagger: { each: 0.06, from: 'start', grid: 'auto' }
      });

      /* Why choose us: photo in from the left, list from the right. The two
         directions meeting in the middle is what gives the section a centre. */
      reveal('.why__fig', { x: -46, y: 0, duration: 0.95, trigger: '.why__fig' });
      var whyBody = q('.why__body');
      if (whyBody) {
        reveal(whyBody.querySelectorAll('h2, p, .why__list > li'), {
          x: 34, y: 0, trigger: whyBody, stagger: 0.075
        });
      }

      /* How it works: the connector line draws first, then the steps land on
         it in sequence. Drawing the line before the steps is the whole point —
         it reads as a route being traced, which is the service. */
      var steps = q('.steps');
      if (steps) {
        var stepTl = gsap.timeline({
          scrollTrigger: { trigger: steps, start: 'top 82%', once: true }
        });

        stepTl.from('.step', {
          y: 44, opacity: 0, duration: 0.75, stagger: 0.11
        }, 0);

        /* The connector is a ::before on each step, and pseudo-elements cannot
           be tweened directly. The stylesheet routes its scaleX through a
           custom property, so animating `--line` on the step animates the line.
           Each segment draws just after its own card lands. */
        stepTl.from('.step', {
          '--line': 0,
          duration: 0.55,
          stagger: 0.11,
          ease: 'power2.inOut'
        }, 0.3);

        /* Numbers pop after their card has landed. */
        stepTl.from('.step__num', {
          scale: 0.4, opacity: 0, duration: 0.6,
          stagger: 0.11, ease: 'back.out(2)'
        }, 0.34);
      }

      /* Coverage map: the nine served counties fill in one after another. This
         is the most literal animation on the page — it is the service area
         being drawn — so it gets the longest sequence. Neighbouring context
         counties are already visible and do not animate; only what Bridgeway
         actually covers lights up. */
      var map = q('.map__svg');
      if (map) {
        var mapTl = gsap.timeline({
          scrollTrigger: { trigger: map, start: 'top 80%', once: true }
        });

        mapTl.from(map.querySelectorAll('.map__zone'), {
          opacity: 0,
          scale: 0.86,
          transformOrigin: 'center center',
          duration: 0.6,
          stagger: 0.075,
          ease: 'power2.out'
        }, 0);

        /* Hub markers pop, including their glow twin, then the leader lines
           and label chips settle in behind them -- a route map lighting up
           its own network rather than a static image appearing. */
        mapTl.from(map.querySelectorAll('.map__hub, .map__hub-glow'), {
          scale: 0, transformOrigin: 'center center',
          duration: 0.4, stagger: 0.06, ease: 'back.out(2.4)'
        }, 0.3);

        mapTl.from(map.querySelectorAll('.map__leader'), {
          opacity: 0, duration: 0.3, stagger: 0.06
        }, 0.42);

        mapTl.from(map.querySelectorAll('.map__chip, .map__hub-label'), {
          opacity: 0, y: 6, duration: 0.35, stagger: 0.06
        }, 0.48);

        /* Route lines draw last, dash by dash, so the network reads as
           connections being made rather than lines that were just always there. */
        var routes = map.querySelectorAll('.map__route');
        if (routes.length) {
          mapTl.from(routes, {
            opacity: 0, duration: 0.3, stagger: 0.05
          }, 0.55);
        }
      }

      reveal('.cov__card', {
        trigger: '.cov__cards',
        y: 26, duration: 0.6,
        stagger: { each: 0.07, from: 'start' }
      });

      reveal('.cov__served-grid > li', {
        trigger: '.cov__served-grid',
        y: 14, duration: 0.4,
        stagger: { each: 0.03, from: 'start', grid: 'auto' }
      });

      reveal('.zipcheck', { trigger: '.zipcheck', y: 24 });

      /* Compliance items, on the dark band. */
      reveal('.comp__item', {
        trigger: '.comp__grid',
        y: 40, duration: 0.8, stagger: 0.09
      });

      reveal('.faq__item', { trigger: '.faq', y: 26, stagger: 0.06 });

      /* Quote: header, then the form rows in sequence. The rows stagger rather
         than every individual field, because forty separate field entrances
         would be noise. */
      var quoteHead = q('.quote__head');
      if (quoteHead) reveal(quoteHead.children, { trigger: quoteHead, y: 30, stagger: 0.1 });
      reveal('.form__row, .form__req, .form__note, .form__submit', {
        trigger: '.form', y: 24, duration: 0.7, stagger: 0.06
      });

      reveal('.site-foot .wrap > *', { trigger: '.site-foot', y: 24, stagger: 0.07 });

      /* --- 06 · Hover: micro-interactions -------------------------------- */

      /* Pointer-only. A touch device fires these on tap and they end up stuck
         in the hover state, which looks broken. */
      if (c.canHover) {

        /* quickTo keeps a single tween per property alive per element instead
           of spawning a new one on every mouseenter, which is what makes a
           fast in-and-out feel smooth rather than jumpy. */
        function lift(selector, opts) {
          qa(selector).forEach(function (el) {
            var yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
            var sTo = gsap.quickTo(el, 'scale', { duration: 0.4, ease: 'power3.out' });
            var icon = opts.icon ? el.querySelector(opts.icon) : null;
            var iTo = icon ? gsap.quickTo(icon, 'scale', { duration: 0.45, ease: 'back.out(2.5)' }) : null;

            el.addEventListener('mouseenter', function () {
              yTo(opts.y != null ? opts.y : -5);
              sTo(opts.scale != null ? opts.scale : 1);
              if (iTo) iTo(1.14);
            });
            el.addEventListener('mouseleave', function () {
              yTo(0); sTo(1);
              if (iTo) iTo(1);
            });
          });
        }

        lift('.svc', { y: -6, icon: '.badge' });
        lift('.cov__card', { y: -3, icon: '.cov__silhouette-wrap' });
        lift('.comp__item', { y: -4, icon: '.badge' });
        lift('.step', { y: -4, icon: '.step__num' });
        lift('.btn', { y: -3, scale: 1.025 });
        lift('.why__list > li', { y: -2 });

        /* Map counties raise slightly and brighten under the cursor. Uses the
           SVG's own transform box so the shape scales about itself rather than
           about the viewBox origin. Reordered to just before the routes/hubs
           groups, not appended to the very end of the SVG -- appending to the
           end would raise the hovered county above the hub markers and route
           lines too, hiding whichever one sits over it. */
        var mapOverlay = q('.map__routes') || q('.map__hubs');
        qa('.map__zone').forEach(function (zone) {
          var to = gsap.quickTo(zone, 'scale', { duration: 0.35, ease: 'power3.out' });
          gsap.set(zone, { transformOrigin: 'center center' });
          zone.addEventListener('mouseenter', function () {
            to(1.035);
            if (mapOverlay) zone.parentNode.insertBefore(zone, mapOverlay);
            else zone.parentNode.appendChild(zone);
          });
          zone.addEventListener('mouseleave', function () { to(1); });
        });
      }

      /* --- 07 · Click: accordions and button press ------------------------ */

      /* <details> gives correct semantics and keyboard behaviour for free, but
         it cannot animate: the browser flips display outright. So the click is
         intercepted, the height is tweened, and `open` is set at the right end
         of the tween — closing after the collapse, opening before the expand.
         Keyboard Enter/Space fire `click` on <summary>, so this covers both.
         Shared by FAQ (existing), Compliance, and the ZIP-checker drawer
         (both new, mobile-only) — `panelSelector` is the child that holds the
         collapsible content in each case. */
      function accordionize(itemSelector, panelSelector) {
        qa(itemSelector).forEach(function (item) {
          var summary = q('summary', item);
          var panel = q(panelSelector, item);
          if (!summary || !panel) return;
          var anim;

          summary.addEventListener('click', function (event) {
            event.preventDefault();
            if (anim) anim.kill();

            if (!item.open) {
              item.open = true;
              anim = gsap.timeline();
              anim.from(panel, {
                height: 0, opacity: 0, duration: 0.42, ease: 'power2.out',
                onComplete: function () { gsap.set(panel, { clearProps: 'height' }); }
              });
              anim.from(panel.children, {
                y: 12, opacity: 0, duration: 0.4, stagger: 0.06
              }, 0.1);
            } else {
              anim = gsap.to(panel, {
                height: 0, opacity: 0, duration: 0.32, ease: 'power2.in',
                onComplete: function () {
                  item.open = false;
                  gsap.set(panel, { clearProps: 'height,opacity' });
                }
              });
            }
          });
        });
      }

      accordionize('.faq__item', '.faq__a');
      accordionize('.comp__item', '.comp__a');
      accordionize('.zipcheck__drawer', '.zipcheck');

      /* Press feedback. Pointer events rather than mousedown so it also fires
         under touch, where there is no hover state to carry the feedback. */
      qa('.btn, .cov__card, .faq__item summary, .comp__item summary, .zipcheck__drawer summary, .site-foot__group summary').forEach(function (el) {
        var to = gsap.quickTo(el, 'scale', { duration: 0.18, ease: 'power2.out' });
        el.addEventListener('pointerdown', function () { to(0.97); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (evt) {
          el.addEventListener(evt, function () { to(1); });
        });
      });

      /* --- 08 · State: ZIP checker and form feedback --------------------- */

      /* site.js owns the ZIP lookup and writes the answer into #zipout. Rather
         than couple the two files, watch the node and animate whatever appears.
         An aria-live region is already announcing it, so this is purely visual. */
      var zipout = q('#zipout');
      if (zipout && window.MutationObserver) {
        new MutationObserver(function () {
          if (!zipout.textContent.trim()) return;
          gsap.fromTo(zipout,
            { y: 8, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out', overwrite: true });
        }).observe(zipout, { childList: true, characterData: true, subtree: true });
      }

      /* Same for the form's status box, plus a shake when it is an error. A
         shake is legible as "wrong" without relying on the red alone. */
      var status = q('.form__status');
      if (status && window.MutationObserver) {
        new MutationObserver(function () {
          if (status.hidden) return;
          var isError = status.classList.contains('form__status--err');
          gsap.fromTo(status,
            { y: 10, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out', overwrite: true });
          if (isError) {
            gsap.fromTo(status,
              { x: -7 },
              { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.35)', delay: 0.1 });
          }
        }).observe(status, { attributes: true, childList: true, subtree: true });
      }

      /* Invalid fields nudge once as the error text appears. */
      qa('.field').forEach(function (field) {
        var input = q('input, select, textarea', field);
        if (!input || !window.MutationObserver) return;
        new MutationObserver(function () {
          if (input.getAttribute('aria-invalid') === 'true') {
            gsap.fromTo(field, { x: -5 }, { x: 0, duration: 0.45, ease: 'elastic.out(1, 0.4)', overwrite: true });
          }
        }).observe(input, { attributes: true, attributeFilter: ['aria-invalid'] });
      });

      /* Anchor links scroll smoothly without ScrollToPlugin: the CSS already
         sets scroll-behavior, and ScrollTrigger only needs telling that the
         layout settled once fonts and images are in. */
      window.addEventListener('load', function () { window.ScrollTrigger.refresh(); });
    });

    /* Everything `html.js-motion` hides. Kept in one place so the reduced-motion
       branch above can reveal exactly the same set, and so this list and the
       stylesheet cannot drift apart silently. */
    function hiddenSelectors() {
      return qa(HIDDEN.join(','));
    }
  }
})();
