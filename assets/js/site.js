/* Bridgeway Medical Logistics
   Progressive enhancement only. Every function here is optional: with
   JavaScript disabled the form still posts to /api/quote.php and the visitor
   gets a server-rendered confirmation page. Nothing on this site is
   scroll-driven and nothing observes the viewport. */

(function () {
  'use strict';

  /* Mobile nav toggle ---------------------------------------------------- */
  var navToggle = document.querySelector('.nav-toggle');
  var navInner = document.querySelector('.site-head__inner');
  if (navToggle && navInner) {
    var closeNav = function () {
      navInner.classList.remove('is-nav-open');
      navToggle.setAttribute('aria-expanded', 'false');
    };
    var openNav = function () {
      navInner.classList.add('is-nav-open');
      navToggle.setAttribute('aria-expanded', 'true');
    };
    navToggle.addEventListener('click', function () {
      if (navInner.classList.contains('is-nav-open')) closeNav();
      else openNav();
    });
    navInner.querySelectorAll('.nav a').forEach(function (a) {
      a.addEventListener('click', closeNav);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });
    document.addEventListener('click', function (e) {
      if (!navInner.classList.contains('is-nav-open')) return;
      if (navInner.contains(e.target)) return;
      closeNav();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 768) closeNav();
    });
  }

  /* Footer year -------------------------------------------------------- */
  document.querySelectorAll('#year').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });


  /* ZIP coverage check -------------------------------------------------- */
  /* 484 ZIPs across the eight served counties -- the five boroughs, Nassau
     and Suffolk on Long Island, and Westchester, Rockland and Putnam.
     New Jersey was dropped from the service area entirely at the client's
     direction; the three NJ counties previously listed here (Hudson, Bergen,
     Essex) are gone, not just hidden. From a public state/county/ZIP
     crosswalk. Embedded rather than fetched: it is a few KB and the answer
     should be
     instant. An unrecognised ZIP is never told "no" -- a wrong no loses a
     booking, and ZIP boundaries do not follow county lines cleanly. */
  var ZONES = {"Manhattan":["10001","10002","10003","10004","10005","10006","10007","10009","10010","10011","10012","10013","10014","10016","10017","10018","10019","10020","10021","10022","10023","10024","10025","10026","10027","10028","10029","10030","10031","10032","10033","10034","10035","10036","10037","10038","10039","10040","10041","10044","10048","10069","100HH","10103","10111","10112","10115","10119","10128","10152","10153","10154","10162","10165","10167","10169","10170","10171","10172","10173","10177","10271","10278","10279","10280","10282","102HH"],"Staten Island":["10301","10302","10303","10304","10305","10306","10307","10308","10309","10310","10312","10314","103HH"],"The Bronx":["10451","10452","10453","10454","10455","10456","10457","10458","10459","10460","10461","10462","10463","10464","10465","10466","10467","10468","10469","10470","10471","10472","10473","10474","10475","104HH"],"Nassau County":["11001","11003","11010","11020","11021","11023","11024","11030","11040","11042","11050","11096","110HH","114HH","11501","11507","11509","11510","11514","11516","11518","11520","11530","11542","11545","11547","11548","11550","11552","11553","11554","11557","11558","11559","11560","11561","11563","11565","11566","11568","11569","11570","11572","11575","11576","11577","11579","11580","11581","11590","11596","11598","115HH","11709","11710","11714","11732","11735","11753","11756","11758","11762","11765","11771","11783","11791","11793","11797","117HH","11801","11803","11804"],"Suffolk County":["06390","11701","11702","11703","11704","11705","11706","11713","11715","11716","11717","11718","11719","11720","11721","11722","11724","11725","11726","11727","11729","11730","11731","11733","11738","11740","11741","11742","11743","11746","11747","11751","11752","11754","11755","11757","11763","11764","11766","11767","11768","11769","11770","11772","11776","11777","11778","11779","11780","11782","11784","11786","11787","11788","11789","11790","11792","11795","11796","11798","11901","11930","11932","11933","11934","11935","11937","11939","11940","11941","11942","11944","11946","11947","11948","11949","11950","11951","11952","11953","11954","11955","11956","11957","11958","11959","11960","11961","11962","11963","11964","11965","11967","11968","11970","11971","11972","11975","11976","11977","11978","11980"],"Queens":["11004","11005","11101","11102","11103","11104","11105","11106","111HH","11354","11355","11356","11357","11358","11360","11361","11362","11363","11364","11365","11366","11367","11368","11369","11370","11371","11372","11373","11374","11375","11377","11378","11379","11385","113HH","11411","11412","11413","11414","11415","11416","11417","11418","11419","11420","11421","11422","11423","11426","11427","11428","11429","11430","11432","11433","11434","11435","11436","11691","11692","11693","11694","11697","116HH"],"Brooklyn":["11201","11203","11204","11205","11206","11207","11208","11209","11210","11211","11212","11213","11214","11215","11216","11217","11218","11219","11220","11221","11222","11223","11224","11225","11226","11228","11229","11230","11231","11232","11233","11234","11235","11236","11237","11238","11239","112HH"],"Westchester County":["10501","10502","10503","10504","10506","10507","10510","10511","10514","10518","10519","10520","10522","10523","10526","10527","10528","10530","10532","10533","10535","10536","10538","10543","10546","10547","10548","10549","10550","10552","10553","10560","10562","10566","10567","10570","10573","10576","10577","10578","10580","10583","10588","10589","10590","10591","10594","10595","10597","10598","10601","10603","10604","10605","10606","10607","10701","10703","10704","10705","10706","10707","10708","10709","10710","10801","10803","10804","10805"],"Rockland County":["10901","10913","10920","10923","10927","10931","10952","10954","10956","10960","10962","10964","10965","10968","10970","10974","10976","10977","10980","10983","10984","10986","10989","10993","10994"],"Putnam County":["10509","10512","10516","10524","10537","10541","10579","12563"]};
  var ZIP_TO_ZONE = (function () {
    var m = {};
    Object.keys(ZONES).forEach(function (zone) {
      ZONES[zone].forEach(function (z) { m[z] = zone; });
    });
    return m;
  })();

  var zipForm = document.getElementById('zipcheck');
  if (zipForm) {
    var zipInput = document.getElementById('zip');
    var zipOut = document.getElementById('zipout');
    zipForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = (zipInput.value || '').trim();
      if (!/^\d{5}$/.test(v)) {
        zipOut.className = 'zipcheck__out zipcheck__out--warn';
        zipOut.textContent = 'Enter a five digit ZIP code.';
        return;
      }
      var zone = ZIP_TO_ZONE[v];
      if (zone) {
        zipOut.className = 'zipcheck__out zipcheck__out--ok';
        zipOut.textContent = v + ' is in our ' + zone + ' zone. Call dispatch for a window.';
      } else {
        zipOut.className = 'zipcheck__out zipcheck__out--warn';
        zipOut.textContent = v + ' is outside our standard coverage area. Call dispatch anyway, custom regional routes are quoted case by case.';
      }
    });
  }

  /* Quote form --------------------------------------------------------- */
  var form = document.getElementById('quote-form');
  if (!form) return;

  var statusBox = document.getElementById('form-status');
  var submitBtn = document.getElementById('quote-submit');
  var stamp = form.querySelector('input[name="rendered_at"]');

  /* Timestamp for the server-side timing check. Set from JS so a bot that
     fetches the raw HTML and posts instantly has no valid value. */
  if (stamp) stamp.value = String(Math.floor(Date.now() / 1000));

  var RULES = {
    facility: { label: 'Facility name', test: function (v) { return v.length >= 2; },
                msg: 'Enter the facility name.' },
    name:     { label: 'Your name',     test: function (v) { return v.length >= 2; },
                msg: 'Enter your name.' },
    email:    { label: 'Work email',    test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); },
                msg: 'Enter a valid email address.' },
    phone:    { label: 'Phone',         test: function (v) { return (v.replace(/\D/g, '').length >= 10); },
                msg: 'Enter a phone number with at least 10 digits.' },
    /* Both ends are required: a courier run cannot be quoted from one address. */
    pickup:   { label: 'Pickup address',   test: function (v) { return v.length >= 4; },
                msg: 'Enter the pickup address.' },
    dropoff:  { label: 'Delivery address', test: function (v) { return v.length >= 4; },
                msg: 'Enter the delivery address.' }
  };

  function setError(field, message) {
    var input = form.elements[field];
    var slot = document.getElementById(field + '-err');
    if (!input) return;
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      if (slot) slot.textContent = message;
    } else {
      input.removeAttribute('aria-invalid');
      if (slot) slot.textContent = '';
    }
  }

  function validate() {
    var firstBad = null;
    Object.keys(RULES).forEach(function (key) {
      var input = form.elements[key];
      if (!input) return;
      var ok = RULES[key].test(input.value.trim());
      setError(key, ok ? '' : RULES[key].msg);
      if (!ok && !firstBad) firstBad = input;
    });
    return firstBad;
  }

  /* Clear a field's error as soon as it becomes valid, so the message does
     not sit there contradicting what the visitor just typed. */
  Object.keys(RULES).forEach(function (key) {
    var input = form.elements[key];
    if (!input) return;
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true' && RULES[key].test(input.value.trim())) {
        setError(key, '');
      }
    });
  });

  function showStatus(kind, html) {
    if (!statusBox) return;
    statusBox.className = 'form__status form__status--' + kind;
    statusBox.innerHTML = html;
    statusBox.hidden = false;
  }

  /* 3-step mobile form ---------------------------------------------------
     Mobile-only via CSS (.form__step is only hidden inside the
     max-width:39.99rem query), but the class is added unconditionally: with
     JS off, or on desktop, `.form--stepped` sits on the form and does
     nothing, so the flat/fully-visible/natively-POSTing form stays the
     default in both cases. Reuses RULES/setError/validate as-is -- Next
     only validates the fields inside the currently active panel; the final
     submit handler below still runs the full validate() across all six
     required fields regardless of which step was last active. */
  var stepPanels = Array.prototype.slice.call(form.querySelectorAll('.form__step'));
  if (stepPanels.length) {
    form.classList.add('form--stepped');
    var stepBack = form.querySelector('[data-step-back]');
    var stepNext = form.querySelector('[data-step-next]');
    var stepStatus = document.getElementById('form-step-status');
    var stepDots = Array.prototype.slice.call(form.querySelectorAll('.form__steps-progress span'));
    var activeStep = 0;

    function fieldsInPanel(panel) {
      return Object.keys(RULES).filter(function (key) {
        var input = form.elements[key];
        return input && panel.contains(input);
      });
    }

    function renderStep() {
      stepPanels.forEach(function (panel, i) {
        panel.classList.toggle('is-active', i === activeStep);
      });
      stepDots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === activeStep);
      });
      if (stepBack) stepBack.hidden = activeStep === 0;
      if (stepNext) stepNext.hidden = activeStep === stepPanels.length - 1;
      if (stepStatus) stepStatus.textContent = 'Step ' + (activeStep + 1) + ' of ' + stepPanels.length;
    }

    if (stepNext) {
      stepNext.addEventListener('click', function () {
        var panel = stepPanels[activeStep];
        var firstBad = null;
        fieldsInPanel(panel).forEach(function (key) {
          var input = form.elements[key];
          var ok = RULES[key].test(input.value.trim());
          setError(key, ok ? '' : RULES[key].msg);
          if (!ok && !firstBad) firstBad = input;
        });
        if (firstBad) { firstBad.focus(); return; }
        if (activeStep < stepPanels.length - 1) activeStep += 1;
        renderStep();
        var heading = document.getElementById('quote-h');
        if (heading) heading.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    }

    if (stepBack) {
      stepBack.addEventListener('click', function () {
        if (activeStep > 0) activeStep -= 1;
        renderStep();
      });
    }

    renderStep();
  }

  form.addEventListener('submit', function (event) {
    var firstBad = validate();
    if (firstBad) {
      event.preventDefault();
      firstBad.focus();
      showStatus('err', 'Please correct the highlighted fields.');
      return;
    }

    /* fetch is what makes this an inline submit rather than a page load. If
       it is unavailable, fall through to the normal form POST. */
    if (!window.fetch) return;

    event.preventDefault();
    if (statusBox) statusBox.hidden = true;
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.disabled = true;
    var originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Sending';

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    })
      .then(function (res) {
        return res.json().catch(function () {
          throw new Error('bad-response');
        });
      })
      .then(function (data) {
        if (!data || data.ok !== true) {
          if (data && data.fields) {
            Object.keys(data.fields).forEach(function (k) { setError(k, data.fields[k]); });
          }
          throw new Error((data && data.error) || 'failed');
        }
        form.reset();
        if (stamp) stamp.value = String(Math.floor(Date.now() / 1000));
        showStatus('ok',
          '<strong>Request received.</strong> Joseph will follow up shortly. ' +
          'If this is time-critical, call dispatch at ' +
          '<a href="tel:+19294545653">(929) 454-5653</a>.');
      })
      .catch(function () {
        showStatus('err',
          '<strong>That did not send.</strong> Please call dispatch at ' +
          '<a href="tel:+19294545653">(929) 454-5653</a> or email ' +
          '<a href="mailto:Info@bridgewayml.com">Info@bridgewayml.com</a>.');
      })
      .finally(function () {
        submitBtn.removeAttribute('aria-busy');
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      });
  });
})();
