/**
 * Events (tournaments) page.
 * Reads and writes through the existing PBRStorage record; auth gating reuses PBRAuth.
 * Exposes window.PBREventsScreen for app.js routing.
 */
(function () {
  'use strict';

  var S = window.PBRStorage;
  var UI = window.PBRUI;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var activeTab = 'upcoming';
  var filters = { query: '', region: '', city: '', format: '' };
  var openRowId = null;
  var selected = null;
  var pendingIntent = null;
  var returnTab = 'players';
  var lastCount = 0;
  var focusTargetId = null;
  var searchTimer = null;

  var screen;
  var resultsEl;
  var statusEl;
  var dialogRoot;
  var dialogEl = null;
  var dialogReturnFocus = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    screen = document.getElementById('events-screen');
    if (!screen) return;
    resultsEl = $('events-results');
    statusEl = $('events-status');
    dialogRoot = $('events-dialog-root');
    wireScreen();
    wireFilters();
    wireTabs();
    wireActions();
    document.addEventListener('keydown', onScreenKeydown);
  }

  function $(id) { return document.getElementById(id); }

  function el(tag, className, text) {
    return UI.el(tag, className, text);
  }

  function toggleHidden(node, shouldHide) {
    if (!node) return;
    node.classList.toggle('hidden', !!shouldHide);
  }

  /* ---------- Dates & formatting ---------- */

  function toDate(iso) { return new Date(iso); }

  function eventStatus(ev) {
    var now = Date.now();
    var start = toDate(ev.startDate).getTime();
    var end = toDate(ev.endDate || ev.startDate).getTime();
    if (now < start) return 'upcoming';
    if (now > end) return 'past';
    return 'live';
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function monthKey(iso) {
    var d = toDate(iso);
    return MONTHS[d.getMonth()].toUpperCase() + ' ' + d.getFullYear();
  }

  function shortDate(iso) {
    var d = toDate(iso);
    return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  function money(value) {
    return '\u20B1' + Number(value || 0).toLocaleString('en-PH');
  }

  function unique(values) {
    var out = [];
    values.forEach(function (v) {
      if (v && out.indexOf(v) === -1) out.push(v);
    });
    return out.sort(function (a, b) { return a.localeCompare(b); });
  }

  /* ---------- Auth ---------- */

  function currentUser() {
    return window.PBRAuth ? window.PBRAuth.currentUser() : null;
  }

  function requestAuth(mode, intent) {
    closeDialog(true);
    pendingIntent = intent || null;
    document.dispatchEvent(new CustomEvent('pbr:auth-required', {
      detail: { mode: mode || 'login', returnTo: 'events', intent: intent || null }
    }));
  }

  function requireAuth(intent) {
    if (currentUser()) return true;
    requestAuth('register', intent);
    return false;
  }

  function hasPendingIntent() { return !!pendingIntent; }

  function resumePending() {
    var intent = pendingIntent;
    pendingIntent = null;
    if (intent === 'join') openJoinDialog();
    else if (intent === 'club') openClubDialog();
    else if (intent === 'clubs') openClubsDialog();
  }

  /* ---------- Screen control ---------- */

  function isOpen() {
    return !!screen && !screen.classList.contains('hidden');
  }

  function open(opts) {
    opts = opts || {};
    if (opts.returnTab) returnTab = opts.returnTab;
    $('landing-hero').classList.add('hidden');
    $('auth-screen').classList.add('hidden');
    $('app-shell').classList.add('hidden');
    screen.classList.remove('hidden');
    window.scrollTo(0, 0);
    refreshSession();
    populateFilters();
    renderResults();
    // On narrow screens the tab strip scrolls: reveal the active (last) tab fully.
    var tabStrip = $('events-tabs');
    if (tabStrip) tabStrip.scrollLeft = tabStrip.scrollWidth;
    var title = $('events-page-title');
    if (title) title.focus({ preventScroll: true });
    if (opts.resume) resumePending();
  }

  function close() {
    if (!screen) return;
    closeDialog(true);
    screen.classList.add('hidden');
  }

  function refresh() {
    if (!screen) return;
    refreshSession();
    renderResults();
  }

  function refreshSession() {
    var user = currentUser();
    var logout = $('events-logout');
    toggleHidden($('events-tabs'), !user);
    toggleHidden(logout, !user);
    toggleHidden($('events-guest-actions'), !!user);
    if (user && logout) {
      logout.textContent = 'Log out (' + user + ')';
      document.querySelectorAll('#events-tabs .tab').forEach(function (tab) {
        var isEvents = tab.getAttribute('data-tab') === 'events';
        tab.classList.toggle('active', isEvents);
        tab.setAttribute('aria-selected', isEvents ? 'true' : 'false');
      });
    }
  }

  function exit(target) {
    close();
    document.dispatchEvent(new CustomEvent('pbr:events-exit', {
      detail: { target: target || 'auto', tab: returnTab }
    }));
  }

  /* ---------- Wiring ---------- */

  function wireScreen() {
    $('events-brand').addEventListener('click', function (e) {
      e.preventDefault();
      exit(currentUser() ? 'app' : 'landing');
    });

    $('events-logout').addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('pbr:events-logout'));
    });

    $('events-login').addEventListener('click', function (e) {
      e.preventDefault();
      requestAuth('login');
    });

    $('events-register-account').addEventListener('click', function (e) {
      e.preventDefault();
      requestAuth('register');
    });
  }

  function wireFilters() {
    $('events-filters').addEventListener('submit', function (e) {
      e.preventDefault();
      readFilterControls();
      renderResults();
      announce(lastCount
        ? lastCount + (lastCount === 1 ? ' event shown' : ' events shown')
        : 'No events match the current filters');
    });

    $('events-search').addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        filters.query = $('events-search').value;
        openRowId = null;
        renderResults();
      }, 180);
    });

    $('events-region').addEventListener('change', function () {
      filters.region = $('events-region').value;
      filters.city = '';
      updateCityOptions();
      openRowId = null;
      renderResults();
    });

    $('events-city').addEventListener('change', function () {
      filters.city = $('events-city').value;
      openRowId = null;
      renderResults();
    });

    $('events-format').addEventListener('change', function () {
      filters.format = $('events-format').value;
      openRowId = null;
      renderResults();
    });
  }

  function wireTabs() {
    document.querySelectorAll('.events-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTab(btn.getAttribute('data-events-tab'));
      });
      btn.addEventListener('keydown', onTabKeydown);
    });
  }

  function onTabKeydown(e) {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) === -1) return;
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.events-tab'));
    var index = tabs.indexOf(e.currentTarget);
    var next = index;
    if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    e.preventDefault();
    tabs[next].focus();
    setTab(tabs[next].getAttribute('data-events-tab'));
  }

  function wireActions() {
    $('events-join-player').addEventListener('click', openJoinDialog);

    $('events-register-club').addEventListener('click', function () {
      if (!requireAuth('club')) return;
      openClubDialog();
    });

    $('events-signin-link').addEventListener('click', function () {
      if (currentUser()) {
        openClubDialog();
        return;
      }
      requestAuth('login', 'club');
    });
  }

  function onScreenKeydown(e) {
    if (e.key !== 'Escape' || !isOpen() || dialogEl) return;
    if (!openRowId) return;
    openRowId = null;
    selected = null;
    renderResults();
  }

  /* ---------- Filters ---------- */

  function readFilterControls() {
    filters.query = $('events-search').value;
    filters.region = $('events-region').value;
    filters.city = $('events-city').disabled ? '' : $('events-city').value;
    filters.format = $('events-format').value;
  }

  function filtersActive() {
    return !!(filters.query.trim() || filters.region || filters.city || filters.format);
  }

  function populateFilters() {
    var events = S.getEvents();
    fillSelect($('events-region'), unique(events.map(function (ev) { return ev.region; })), 'All regions', filters.region);
    fillSelect($('events-format'), unique(events.map(function (ev) { return ev.format; })), 'All formats', filters.format);
    $('events-search').value = filters.query;
    updateCityOptions();
  }

  function updateCityOptions() {
    var citySelect = $('events-city');
    var region = filters.region || $('events-region').value;
    var events = S.getEvents();

    if (!region) {
      citySelect.innerHTML = '';
      var placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Pick a region first';
      citySelect.appendChild(placeholder);
      citySelect.disabled = true;
      filters.city = '';
      return;
    }

    var cities = unique(events.filter(function (ev) { return ev.region === region; }).map(function (ev) { return ev.city; }));
    citySelect.disabled = false;
    fillSelect(citySelect, cities, 'All cities', filters.city);
  }

  function fillSelect(select, values, placeholder, current) {
    select.innerHTML = '';
    var ph = document.createElement('option');
    ph.value = '';
    ph.textContent = placeholder;
    select.appendChild(ph);
    values.forEach(function (value) {
      var opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    });
    select.value = current && values.indexOf(current) !== -1 ? current : '';
  }

  function matchesFilters(ev) {
    if (filters.region && ev.region !== filters.region) return false;
    if (filters.city && ev.city !== filters.city) return false;
    if (filters.format && ev.format !== filters.format) return false;
    var q = filters.query.trim().toLowerCase();
    if (!q) return true;
    var haystack = [ev.name, ev.venue, ev.club, ev.region, ev.city, ev.format]
      .concat((ev.divisions || []).map(function (d) { return d.name + ' ' + d.bracket; }))
      .join(' ')
      .toLowerCase();
    return haystack.indexOf(q) !== -1;
  }

  function resetFilters() {
    filters = { query: '', region: '', city: '', format: '' };
    selected = null;
    openRowId = null;
    $('events-search').value = '';
    populateFilters();
    renderResults();
  }

  /* ---------- Tabs & results ---------- */

  function setTab(name) {
    if (!name || name === activeTab) return;
    activeTab = name;
    openRowId = null;
    selected = null;
    document.querySelectorAll('.events-tab').forEach(function (t) {
      var isActive = t.getAttribute('data-events-tab') === name;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    resultsEl.setAttribute('aria-labelledby', 'events-tab-' + name);
    renderResults();
  }

  function sortEvents(list) {
    return list.slice().sort(function (a, b) {
      var diff = toDate(a.startDate).getTime() - toDate(b.startDate).getTime();
      return activeTab === 'past' ? -diff : diff;
    });
  }

  function renderResults() {
    if (!resultsEl) return;
    var list = sortEvents(S.getEvents().filter(function (ev) {
      return eventStatus(ev) === activeTab;
    }).filter(matchesFilters));

    lastCount = list.length;
    updateStatus(list.length);
    resultsEl.innerHTML = '';

    if (!list.length) {
      resultsEl.appendChild(buildEmptyState());
      return;
    }
    resultsEl.appendChild(buildSheet(list));

    if (focusTargetId) {
      var target = document.getElementById(focusTargetId);
      if (target) target.focus();
      focusTargetId = null;
    }
  }

  function updateStatus(count) {
    if (!count) {
      statusEl.textContent = filtersActive() ? 'No events match your filters' : 'No events match right now';
      return;
    }
    var noun = count === 1 ? 'event matches' : 'events match';
    statusEl.textContent = count + ' ' + noun + (filtersActive() ? ' your filters' : ' right now');
  }

  function announce(message) {
    var box = $('events-announcer');
    if (box) box.textContent = message;
  }

  function buildEmptyState() {
    var box = el('div', 'events-empty');
    var title = '';
    var copy = '';
    var action = 'Browse clubs';
    var onclick = openClubsDialog;

    if (filtersActive()) {
      title = 'No tournaments match these filters';
      copy = 'Try another region, city or format — or clear the filters to see every event on the calendar.';
      action = 'Clear filters';
      onclick = resetFilters;
    } else if (activeTab === 'live') {
      title = 'Nothing live right now';
      copy = 'Live brackets appear here once a draw starts. Check Upcoming for the next tournament on the calendar.';
    } else if (activeTab === 'past') {
      title = 'No finished events yet';
      copy = 'Completed draws and verified results will be listed here as soon as organizers confirm them.';
    } else {
      title = 'No tournaments scheduled yet';
      copy = 'Clubs publish draws a few weeks ahead. Check back soon, or find a club near you and see what they run.';
    }

    box.appendChild(el('p', 'events-empty-title', title));
    box.appendChild(el('p', 'events-empty-copy', copy));

    var btn = el('button', 'events-empty-action', action);
    btn.type = 'button';
    btn.addEventListener('click', onclick);
    box.appendChild(btn);
    return box;
  }

  /* ---------- Ledger sheet ---------- */

  function buildSheet(list) {
    var sheet = el('div', 'events-sheet');
    var currentMonth = '';
    list.forEach(function (ev) {
      var key = monthKey(ev.startDate);
      if (key !== currentMonth) {
        currentMonth = key;
        sheet.appendChild(el('div', 'events-month', key));
      }
      sheet.appendChild(buildRow(ev));
    });
    return sheet;
  }

  function divisionTotals(ev) {
    var filled = 0;
    var capacity = 0;
    var fees = [];
    (ev.divisions || []).forEach(function (div) {
      var st = S.getDivisionStatus(ev.id, div.name);
      if (!st) return;
      filled += st.filled;
      capacity += st.capacity;
      if (fees.indexOf(st.fee) === -1) fees.push(st.fee);
    });
    fees.sort(function (a, b) { return a - b; });
    return {
      filled: filled,
      capacity: capacity,
      feeMin: fees.length ? fees[0] : 0,
      multipleFees: fees.length > 1
    };
  }

  function meter(filled, capacity) {
    var wrap = el('span', 'events-meter');
    var bar = el('span');
    var ratio = capacity ? Math.min(1, filled / capacity) : 0;
    bar.style.width = Math.round(ratio * 100) + '%';
    wrap.appendChild(bar);
    return wrap;
  }

  function buildRow(ev) {
    var status = eventStatus(ev);
    var totals = divisionTotals(ev);
    var entry = S.getEventEntry(ev.id);
    var isRowOpen = openRowId === ev.id;
    var canExpand = status !== 'past' && !entry;

    var row = el('div', 'events-row');
    if (status === 'live') row.classList.add('is-live');
    if (status === 'past') row.classList.add('is-past');
    if (entry) row.classList.add('is-registered');
    if (isRowOpen) row.classList.add('is-open');

    if (entry) row.appendChild(buildStub(ev, entry));

    var top = el('div', 'events-row-top');

    var date = el('div', 'events-date');
    var start = toDate(ev.startDate);
    date.appendChild(el('span', 'events-date-day', pad2(start.getDate())));
    date.appendChild(el('span', 'events-date-month', MONTHS[start.getMonth()].toUpperCase()));
    top.appendChild(date);

    var main = el('div', 'events-main');

    if (canExpand) {
      var toggle = el('button', 'events-row-toggle');
      toggle.type = 'button';
      toggle.id = 'events-toggle-' + ev.id;
      toggle.setAttribute('aria-expanded', isRowOpen ? 'true' : 'false');
      toggle.setAttribute('aria-controls', 'events-divisions-' + ev.id);
      toggle.setAttribute('aria-label', ev.name + (isRowOpen ? ' — hide divisions' : ' — show divisions'));
      toggle.appendChild(el('span', 'events-name', ev.name));
      toggle.addEventListener('click', function () { toggleRow(ev.id); });
      main.appendChild(toggle);
    } else {
      main.appendChild(el('span', 'events-name', ev.name));
    }

    var meta = el('div', 'events-meta');
    meta.appendChild(el('span', 'events-format', ev.format));

    if (status === 'live') {
      var live = el('span', 'events-live');
      live.appendChild(el('span', 'events-live-dot'));
      var ticker = 'Live';
      if (ev.liveRound) ticker += ' — ' + ev.liveRound;
      if (ev.liveCourt) ticker += ' on ' + ev.liveCourt;
      live.appendChild(document.createTextNode(ticker));
      meta.appendChild(live);
    }

    var venue = el('span', 'events-venue');
    var pin = el('i', 'ti ti-map-pin');
    pin.setAttribute('aria-hidden', 'true');
    venue.appendChild(pin);
    venue.appendChild(el('span', null, ev.venue + ', ' + ev.city));
    meta.appendChild(venue);
    main.appendChild(meta);

    var mobileFigures = el('div', 'events-row-mobile-figures');
    mobileFigures.appendChild(el('span', 'events-fee', (totals.multipleFees ? 'From ' : '') + money(totals.feeMin)));
    mobileFigures.appendChild(el('span', null, totals.filled + ' / ' + totals.capacity + ' slots'));
    mobileFigures.appendChild(meter(totals.filled, totals.capacity));
    main.appendChild(mobileFigures);

    top.appendChild(main);

    var figures = el('div', 'events-figures');
    figures.appendChild(el('span', 'events-fee', (totals.multipleFees ? 'From ' : '') + money(totals.feeMin)));
    figures.appendChild(el('span', 'events-slots', totals.filled + ' / ' + totals.capacity));
    figures.appendChild(meter(totals.filled, totals.capacity));
    top.appendChild(figures);

    var action = el('div', 'events-action');
    if (entry) {
      var withdraw = el('button', 'events-ghost-btn', 'Withdraw');
      withdraw.type = 'button';
      withdraw.addEventListener('click', function () { withdrawEntry(ev, entry); });
      action.appendChild(withdraw);
    } else if (status === 'past') {
      action.appendChild(el('span', 'events-result-line', ev.result || 'Completed'));
    } else if (status === 'live') {
      var closed = el('button', 'events-row-cta', 'Entries closed');
      closed.type = 'button';
      closed.disabled = true;
      action.appendChild(closed);
    } else if (totals.filled >= totals.capacity) {
      var full = el('button', 'events-row-cta', 'All divisions full');
      full.type = 'button';
      full.disabled = true;
      action.appendChild(full);
    } else {
      var register = el('button', 'events-row-cta', isRowOpen ? 'Hide divisions' : 'Register');
      register.type = 'button';
      if (isRowOpen) register.setAttribute('aria-expanded', 'true');
      register.addEventListener('click', function () { toggleRow(ev.id); });
      action.appendChild(register);
    }
    top.appendChild(action);

    row.appendChild(top);

    if (isRowOpen && canExpand) row.appendChild(buildDivisions(ev));
    return row;
  }

  function buildStub(ev, entry) {
    var stub = el('div', 'events-stub');
    var icon = el('i', 'ti ti-ticket');
    icon.setAttribute('aria-hidden', 'true');
    stub.appendChild(icon);
    stub.appendChild(document.createTextNode('Your entry'));
    stub.appendChild(el('strong', null, entry.division));
    stub.appendChild(el('span', 'events-stub-slot', 'Slot ' + entry.slot));
    stub.appendChild(el('span', null, shortDate(ev.startDate)));
    return stub;
  }

  function buildDivisions(ev) {
    var wrap = el('div', 'events-divisions');
    wrap.id = 'events-divisions-' + ev.id;

    var selectedDivision = selected && selected.eventId === ev.id ? selected.division : null;

    (ev.divisions || []).forEach(function (div) {
      var st = S.getDivisionStatus(ev.id, div.name);
      if (!st) return;
      var isSelected = selectedDivision === div.name;
      var isFull = st.open <= 0;

      var btn = el('button', 'events-division');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      if (isFull) {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
      }

      var name = el('span', 'events-division-name');
      name.appendChild(el('span', null, div.name));
      name.appendChild(el('span', 'events-division-bracket', div.prRange || div.bracket));
      btn.appendChild(name);

      var cap = el('span', 'events-division-cap');
      cap.appendChild(meter(st.filled, st.capacity));
      cap.appendChild(el('span', null, st.filled + '/' + st.capacity));
      btn.appendChild(cap);

      btn.appendChild(el('span', 'events-division-fee', money(div.fee)));
      btn.appendChild(el('span', 'events-pick-label', isFull ? 'Full' : (isSelected ? 'Selected' : 'Select')));

      if (!isFull) {
        btn.addEventListener('click', function () {
          selected = isSelected ? null : { eventId: ev.id, division: div.name };
          focusTargetId = 'events-division-' + ev.id + '-' + slug(div.name);
          renderResults();
        });
        btn.id = 'events-division-' + ev.id + '-' + slug(div.name);
      }

      wrap.appendChild(btn);
    });

    var confirm = el('div', 'events-confirm');
    var copy = el('p', 'events-confirm-copy');

    if (selectedDivision) {
      var div = (ev.divisions || []).find(function (d) { return d.name === selectedDivision; });
      copy.appendChild(el('strong', null, selectedDivision));
      copy.appendChild(document.createTextNode(' · ' + money(div ? div.fee : 0) + ' entry fee'));
    } else {
      copy.textContent = 'Choose a division to register.';
    }
    confirm.appendChild(copy);

    var confirmBtn = el('button', 'events-confirm-btn', 'Confirm entry');
    confirmBtn.type = 'button';
    confirmBtn.disabled = !selectedDivision;
    confirmBtn.addEventListener('click', function () {
      if (!selectedDivision) return;
      confirmEntry(ev, selectedDivision);
    });
    confirm.appendChild(confirmBtn);

    wrap.appendChild(confirm);
    return wrap;
  }

  function slug(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  function toggleRow(eventId) {
    if (openRowId === eventId) {
      openRowId = null;
      selected = null;
      focusTargetId = 'events-toggle-' + eventId;
    } else {
      openRowId = eventId;
      selected = null;
    }
    renderResults();
  }

  function confirmEntry(ev, divisionName) {
    if (!requireAuth('join')) return;
    var entry = S.addEntry(ev.id, divisionName);
    if (!entry) {
      announce('That division is full. Pick another one.');
      renderResults();
      return;
    }
    openRowId = null;
    selected = null;
    renderResults();
    announce('Registered for ' + ev.name + ' — ' + divisionName + ', slot ' + entry.slot + '.');
  }

  function withdrawEntry(ev, entry) {
    if (!window.confirm('Withdraw from ' + entry.division + ' at ' + ev.name + '?')) return;
    S.removeEntry(ev.id, entry.division);
    selected = null;
    openRowId = null;
    renderResults();
    announce('Entry withdrawn from ' + ev.name + '.');
  }

  /* ---------- Dialog plumbing ---------- */

  function buildDialog(titleText, subText) {
    var overlay = el('div', 'events-dialog');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    var titleId = 'events-dialog-title';
    overlay.setAttribute('aria-labelledby', titleId);
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) closeDialog();
    });

    var card = el('div', 'events-dialog-card');
    var head = el('div', 'events-dialog-head');
    var headCopy = document.createElement('div');
    var title = el('h2', 'events-dialog-title', titleText);
    title.id = titleId;
    headCopy.appendChild(title);
    if (subText) headCopy.appendChild(el('p', 'events-dialog-sub', subText));
    head.appendChild(headCopy);

    var close = el('button', 'events-dialog-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close dialog');
    var closeIcon = el('i', 'ti ti-x');
    closeIcon.setAttribute('aria-hidden', 'true');
    close.appendChild(closeIcon);
    close.addEventListener('click', function () { closeDialog(); });
    head.appendChild(close);

    var body = el('div', 'events-dialog-body');
    card.appendChild(head);
    card.appendChild(body);
    overlay.appendChild(card);

    return { overlay: overlay, card: card, body: body };
  }

  function showDialog(overlay) {
    closeDialog(true);
    dialogReturnFocus = document.activeElement;
    dialogRoot.appendChild(overlay);
    dialogEl = overlay;
    document.addEventListener('keydown', onDialogKeydown);
    var focusables = overlay.querySelectorAll('input, select, button');
    for (var i = 0; i < focusables.length; i++) {
      if (focusables[i] !== overlay.querySelector('.events-dialog-close')) {
        focusables[i].focus();
        break;
      }
    }
  }

  function closeDialog(silent) {
    if (!dialogRoot) return;
    dialogRoot.innerHTML = '';
    dialogEl = null;
    document.removeEventListener('keydown', onDialogKeydown);
    if (!silent && dialogReturnFocus && dialogReturnFocus.isConnected) {
      dialogReturnFocus.focus();
    }
    dialogReturnFocus = null;
  }

  function onDialogKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog();
      return;
    }
    if (e.key !== 'Tab' || !dialogEl) return;
    var all = dialogEl.querySelectorAll('button, [href], input, select, textarea');
    var focusables = Array.prototype.filter.call(all, function (node) {
      return !node.disabled && node.offsetParent !== null;
    });
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function showToast(message) {
    var box = $('events-toast');
    if (!box) return;
    box.textContent = message;
    box.className = 'toast success';
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      box.className = 'toast hidden';
    }, 2800);
  }

  /* ---------- Join as a Player ---------- */

  function openJoinDialog() {
    if (!requireAuth('join')) return;

    var joinState = { eventId: null, division: null };
    var pick = S.getEvents().filter(function (ev) {
      if (eventStatus(ev) === 'past') return false;
      return (ev.divisions || []).some(function (div) {
        var st = S.getDivisionStatus(ev.id, div.name);
        return st && st.open > 0;
      });
    });

    var shell = buildDialog('Join as a Player', 'Pick a tournament, then choose the division you want to enter.');

    var searchField = el('div', 'events-form-field');
    var searchLabel = el('label', null, 'Find a tournament');
    searchLabel.setAttribute('for', 'events-join-search');
    var search = document.createElement('input');
    search.type = 'text';
    search.id = 'events-join-search';
    search.className = 'events-form-input';
    search.placeholder = 'Search by event, club or city';
    search.autocomplete = 'off';
    searchField.appendChild(searchLabel);
    searchField.appendChild(search);
    shell.body.appendChild(searchField);

    var listHost = el('div', 'events-pick-list');
    shell.body.appendChild(listHost);

    var foot = el('div', 'events-dialog-foot');
    var footNote = el('p', 'events-confirm-copy', 'No tournament selected');
    foot.appendChild(footNote);

    var confirm = el('button', 'events-dialog-btn is-primary', 'Confirm entry');
    confirm.type = 'button';
    confirm.disabled = true;
    foot.appendChild(confirm);
    shell.card.appendChild(foot);

    function renderList() {
      listHost.innerHTML = '';
      var query = search.value.trim().toLowerCase();
      var visible = pick.filter(function (ev) {
        if (!query) return true;
        return (ev.name + ' ' + ev.club + ' ' + ev.city).toLowerCase().indexOf(query) !== -1;
      });

      if (!visible.length) {
        listHost.appendChild(el('p', 'events-pick-empty', pick.length
          ? 'No tournament matches that search.'
          : 'No open tournaments right now. Check the calendar for upcoming draws.'));
        return;
      }

      visible.forEach(function (ev) {
        var item = el('div');
        var openDivisions = (ev.divisions || []).filter(function (div) {
          var st = S.getDivisionStatus(ev.id, div.name);
          return st && st.open > 0;
        });

        var btn = el('button', 'events-pick');
        btn.type = 'button';
        btn.setAttribute('aria-expanded', joinState.eventId === ev.id ? 'true' : 'false');
        btn.appendChild(el('span', 'events-pick-name', ev.name));
        btn.appendChild(el('span', 'events-pick-open', openDivisions.length + (openDivisions.length === 1 ? ' division open' : ' divisions open')));
        btn.appendChild(el('span', 'events-pick-meta', shortDate(ev.startDate) + ' · ' + ev.city + ' · ' + ev.format));
        btn.addEventListener('click', function () {
          if (joinState.eventId === ev.id) {
            joinState.eventId = null;
            joinState.division = null;
          } else {
            joinState.eventId = ev.id;
            joinState.division = openDivisions[0] ? openDivisions[0].name : null;
          }
          renderList();
          syncFooter();
        });
        item.appendChild(btn);

        if (joinState.eventId === ev.id) {
          var chips = el('div', 'events-chip-row');
          openDivisions.forEach(function (div) {
            var chip = el('button', 'events-chip', div.name + ' · ' + money(div.fee));
            chip.type = 'button';
            chip.setAttribute('aria-pressed', joinState.division === div.name ? 'true' : 'false');
            chip.addEventListener('click', function () {
              joinState.division = div.name;
              renderList();
              syncFooter();
            });
            chips.appendChild(chip);
          });
          item.appendChild(chips);
        }

        listHost.appendChild(item);
      });
    }

    function selectedEvent() {
      return joinState.eventId ? S.getEvent(joinState.eventId) : null;
    }

    function syncFooter() {
      var ev = selectedEvent();
      var div = ev && joinState.division ? ev.divisions.find(function (d) { return d.name === joinState.division; }) : null;
      if (ev && div) {
        footNote.innerHTML = '';
        footNote.appendChild(el('strong', null, div.name));
        footNote.appendChild(document.createTextNode(' at ' + ev.club + ' · ' + money(div.fee)));
        confirm.disabled = false;
      } else {
        footNote.textContent = 'No tournament selected';
        confirm.disabled = true;
      }
    }

    search.addEventListener('input', renderList);
    confirm.addEventListener('click', function () {
      var ev = selectedEvent();
      if (!ev || !joinState.division) return;
      var entry = S.addEntry(ev.id, joinState.division);
      if (!entry) {
        footNote.textContent = 'That division just filled up. Choose another.';
        renderList();
        return;
      }
      closeDialog(true);
      refresh();
      announce('Registered for ' + ev.name + ' — ' + joinState.division + ', slot ' + entry.slot + '.');
    });

    renderList();
    syncFooter();
    showDialog(shell.overlay);
  }

  /* ---------- Register Your Club ---------- */

  function openClubDialog() {
    if (!requireAuth('club')) return;

    var shell = buildDialog('Register Your Club', 'Clubs use PickleRankPH to publish draws, seed players, and confirm results.');

    var form = document.createElement('form');
    form.id = 'events-club-form';
    form.className = 'events-dialog-form';
    form.noValidate = true;
    form.style.display = 'grid';
    form.style.gap = '12px';

    var error = el('div', 'events-dialog-error hidden');
    error.setAttribute('role', 'alert');

    function field(labelText, inputEl, full) {
      var wrap = el('div', 'events-form-field');
      var label = document.createElement('label');
      label.textContent = labelText;
      label.setAttribute('for', inputEl.id);
      wrap.appendChild(label);
      wrap.appendChild(inputEl);
      if (full) wrap.style.gridColumn = '1 / -1';
      return wrap;
    }

    function input(id, placeholder, type) {
      var node = document.createElement('input');
      node.type = type || 'text';
      node.id = id;
      node.placeholder = placeholder;
      node.autocomplete = 'off';
      return node;
    }

    var nameInput = input('events-club-name', 'e.g. Makati Pickle Club');
    var regionInput = input('events-club-region', 'e.g. Metro Manila');
    regionInput.setAttribute('list', 'events-club-regions');
    var regionList = document.createElement('datalist');
    regionList.id = 'events-club-regions';
    unique(S.getEvents().map(function (ev) { return ev.region; })).forEach(function (region) {
      var opt = document.createElement('option');
      regionList.appendChild(opt);
      regionList.lastChild.value = region;
    });
    var cityInput = input('events-club-city', 'e.g. Makati');
    var venueInput = input('events-club-venue', 'Home courts (optional)');
    var emailInput = input('events-club-email', 'you@club.ph', 'email');

    var rowOne = el('div', 'events-form-row');
    rowOne.appendChild(field('Club name', nameInput));
    rowOne.appendChild(field('Contact email', emailInput));

    var rowTwo = el('div', 'events-form-row');
    rowTwo.appendChild(field('Region', regionInput));
    rowTwo.appendChild(field('City', cityInput));

    form.appendChild(rowOne);
    form.appendChild(rowTwo);
    form.appendChild(field('Home courts', venueInput));
    form.appendChild(regionList);
    form.appendChild(error);

    var foot = el('div', 'events-dialog-foot');
    var cancel = el('button', 'events-dialog-btn', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', function () { closeDialog(); });

    var submit = el('button', 'events-dialog-btn is-primary', 'Register club');
    submit.type = 'submit';
    submit.setAttribute('form', form.id);

    foot.appendChild(cancel);
    foot.appendChild(submit);

    shell.body.appendChild(form);
    shell.card.appendChild(foot);

    function fail(message, inputEl) {
      error.textContent = message;
      error.classList.remove('hidden');
      if (inputEl) inputEl.focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      error.classList.add('hidden');

      var name = nameInput.value.trim();
      var region = regionInput.value.trim();
      var city = cityInput.value.trim();
      var email = emailInput.value.trim();

      if (!name) return fail('Give your club a name.', nameInput);
      if (!region) return fail('Add the region your club plays in.', regionInput);
      if (!city) return fail('Add the city your club plays in.', cityInput);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid contact email.', emailInput);

      var duplicateClub = S.getClubs().some(function (club) {
        return club.name.toLowerCase() === name.toLowerCase();
      });
      if (duplicateClub) return fail('That club is already registered on this account.', nameInput);

      var saved = S.addClub({ name: name, region: region, city: city, venue: venueInput.value.trim(), email: email });
      if (!saved) return fail('That club could not be registered. Try a different name.', nameInput);

      closeDialog(true);
      showToast('Club registered — ' + saved.name);
      announce('Club registered: ' + saved.name);
    });

    showDialog(shell.overlay);
  }

  /* ---------- Browse clubs ---------- */

  function openClubsDialog() {
    var events = S.getEvents();
    var groups = {};
    var registered = S.getClubs();

    function addClub(name, region, city) {
      var key = region || 'Other regions';
      groups[key] = groups[key] || [];
      var exists = groups[key].some(function (club) {
        return club.name.toLowerCase() === String(name).toLowerCase();
      });
      if (exists) return;
      groups[key].push({
        name: name,
        city: city || '',
        count: events.filter(function (ev) {
          return String(ev.club).toLowerCase() === String(name).toLowerCase();
        }).length
      });
    }

    registered.forEach(function (club) { addClub(club.name, club.region, club.city); });
    events.forEach(function (ev) { addClub(ev.club, ev.region, ev.city); });

    var shell = buildDialog('Clubs', 'Every club running events on the PickleRankPH calendar.');
    var regions = Object.keys(groups).sort();

    if (!regions.length) {
      shell.body.appendChild(el('p', 'events-pick-empty', 'No clubs here yet. Register your club to publish your first draw.'));
    } else {
      regions.forEach(function (region) {
        var group = el('div', 'events-club-group');
        group.appendChild(el('p', 'events-club-region', region));
        groups[region].forEach(function (club) {
          var row = el('div', 'events-club');
          row.appendChild(el('span', 'events-club-name', club.name));
          var bits = [];
          if (club.city) bits.push(club.city);
          bits.push(club.count ? club.count + (club.count === 1 ? ' event' : ' events') : 'no events yet');
          row.appendChild(el('span', 'events-club-meta', bits.join(' · ')));
          group.appendChild(row);
        });
        shell.body.appendChild(group);
      });
    }

    var foot = el('div', 'events-dialog-foot');
    var close = el('button', 'events-dialog-btn', 'Close');
    close.type = 'button';
    close.addEventListener('click', function () { closeDialog(); });

    var register = el('button', 'events-dialog-btn is-primary', 'Register Your Club');
    register.type = 'button';
    register.addEventListener('click', function () {
      closeDialog(true);
      if (currentUser()) openClubDialog();
      else requestAuth('register', 'club');
    });

    foot.appendChild(close);
    foot.appendChild(register);
    shell.card.appendChild(foot);

    showDialog(shell.overlay);
  }

  window.PBREventsScreen = {
    open: open,
    close: close,
    refresh: refresh,
    refreshSession: refreshSession,
    hasPendingIntent: hasPendingIntent,
    resumePending: resumePending,
    isOpen: isOpen
  };
})();
