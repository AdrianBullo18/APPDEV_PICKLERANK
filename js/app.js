(function () {
  'use strict';

  var S = window.PBRStorage;
  var Stats = window.PBRStats;
  var UI = window.PBRUI;

  var currentSearch = '';
  var currentCategoryFilter = '';
  var currentLeaderboardFilter = '';
  var editingPlayerId = null;
  var showHistory = true;
  var lastTab = 'players';
  var pendingAuthReturn = null;

  document.addEventListener('DOMContentLoaded', init);

  function $(id) { return document.getElementById(id); }

  function init() {
    S.load();
    wireEvents();
    wireAuthEvents();
    wireLandingEvents();
    var user = window.PBRAuth.currentUser();
    if (user) {
      enterApp(user);
    } else {
      showLanding();
    }
    if (window.location.hash === '#events' && window.PBREventsScreen) {
      window.PBREventsScreen.open({ from: 'landing', returnTab: lastTab });
    }
  }

  function wireLandingEvents() {
    $('hero-start-button').addEventListener('click', function (e) {
      e.preventDefault();
      showAuth('login');
    });

    $('hero-login-link').addEventListener('click', function (e) {
      e.preventDefault();
      showAuth('login');
    });

    $('hero-register-link').addEventListener('click', function (e) {
      e.preventDefault();
      showAuth('register');
    });

    $('hero-events-link').addEventListener('click', function (e) {
      e.preventDefault();
      openEventsScreen({ from: 'landing' });
    });
  }

  /* ---------- Events screen hand-off ---------- */

  function openEventsScreen(opts) {
    if (!window.PBREventsScreen) return;
    window.PBREventsScreen.open(opts || {});
  }

  function onEventsAuthRequired(e) {
    var detail = e.detail || {};
    pendingAuthReturn = detail.returnTo || null;
    showAuth(detail.mode || 'login');
  }

  function onEventsExit(e) {
    var detail = e.detail || {};
    var user = window.PBRAuth.currentUser();
    clearEventsHash();
    if (detail.target === 'landing' || !user) {
      showLanding();
      return;
    }
    enterApp(user);
    switchTab(detail.tab || lastTab);
  }

  function clearEventsHash() {
    if (window.location.hash !== '#events') return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function leaveEventsForTab(name) {
    if (window.PBREventsScreen) window.PBREventsScreen.close();
    var user = window.PBRAuth.currentUser();
    if (!user) {
      showAuth('login');
      return;
    }
    enterApp(user);
    switchTab(name);
  }

  function resumePendingEvents() {
    if (pendingAuthReturn !== 'events' || !window.PBREventsScreen) return;
    pendingAuthReturn = null;
    window.PBREventsScreen.open({ from: 'auth', resume: true });
  }

  function wireEvents() {
    document.addEventListener('pbr:auth-required', onEventsAuthRequired);
    document.addEventListener('pbr:events-exit', onEventsExit);
    document.addEventListener('pbr:events-logout', onLogout);
    window.addEventListener('hashchange', function () {
      if (window.location.hash === '#events') openEventsScreen({ from: 'landing' });
    });

    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.getAttribute('data-tab');
        if (name !== 'events' && window.PBREventsScreen && window.PBREventsScreen.isOpen()) {
          leaveEventsForTab(name);
          return;
        }
        switchTab(name);
      });
    });

    $('btn-show-add-player').addEventListener('click', function () {
      var form = $('add-player-form');
      var isHidden = form.classList.contains('hidden');
      form.classList.toggle('hidden');
      $('btn-show-add-player').setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      if (isHidden) {
        $('player-name').focus();
        $('btn-show-add-player').textContent = 'Cancel';
      } else {
        resetPlayerForm();
        $('btn-show-add-player').textContent = '+ Add Player';
      }
    });

    $('player-form').addEventListener('submit', onPlayerSubmit);

    $('btn-add-category').addEventListener('click', onAddCategory);

    $('player-search').addEventListener('input', function (e) {
      currentSearch = e.target.value.trim().toLowerCase();
      renderPlayers();
    });

    $('player-category-filter').addEventListener('change', function (e) {
      currentCategoryFilter = e.target.value;
      renderPlayers();
    });

    $('leaderboard-filter').addEventListener('change', function (e) {
      currentLeaderboardFilter = e.target.value;
      renderLeaderboard();
    });

    $('btn-save-game').addEventListener('click', onSaveGame);

    $('btn-edit-history').addEventListener('click', function () {
      showHistory = !showHistory;
      $('recent-games').classList.toggle('hidden', !showHistory);
      $('btn-edit-history').setAttribute('aria-expanded', showHistory ? 'true' : 'false');
      $('btn-edit-history').textContent = showHistory ? 'Hide Recent Games' : 'Show Recent Games';
    });

    $('modal-close').addEventListener('click', closeProfile);
    $('profile-modal').addEventListener('click', function (e) {
      if (e.target === $('profile-modal')) closeProfile();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeProfile();
    });
  }

  /* ---------- Auth ---------- */

  function wireAuthEvents() {
    document.querySelectorAll('.auth-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchAuthTab(btn.getAttribute('data-auth'));
      });
    });

    $('login-form').addEventListener('submit', onLoginSubmit);
    $('register-form').addEventListener('submit', onRegisterSubmit);
    $('btn-logout').addEventListener('click', onLogout);
  }

  function switchAuthTab(name) {
    var login = name === 'login';
    document.querySelectorAll('.auth-tab').forEach(function (t) {
      var isActive = t.getAttribute('data-auth') === name;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    $('login-form').classList.toggle('hidden', !login);
    $('register-form').classList.toggle('hidden', login);
    $('login-error').classList.add('hidden');
    $('register-error').classList.add('hidden');
  }

  function showLanding() {
    if (window.PBREventsScreen) window.PBREventsScreen.close();
    clearEventsHash();
    $('landing-hero').classList.remove('hidden');
    $('auth-screen').classList.add('hidden');
    $('app-shell').classList.add('hidden');
  }

  function showAuth(tabName) {
    if (window.PBREventsScreen) window.PBREventsScreen.close();
    clearEventsHash();
    $('landing-hero').classList.add('hidden');
    $('auth-screen').classList.remove('hidden');
    $('app-shell').classList.add('hidden');
    switchAuthTab(tabName || 'login');
    $('login-form').reset();
    $('register-form').reset();
    $(tabName === 'register' ? 'register-username' : 'login-username').focus();
  }

  function enterApp(username) {
    if (window.PBREventsScreen) window.PBREventsScreen.close();
    S.setUser(username);
    $('landing-hero').classList.add('hidden');
    $('auth-screen').classList.add('hidden');
    $('app-shell').classList.remove('hidden');
    $('btn-logout').textContent = 'Log out (' + username + ')';
    populateCategoryOptions();
    populateTeamSelects();
    renderAll();
    if (window.PBREventsScreen) window.PBREventsScreen.refreshSession();
  }

  function onLoginSubmit(e) {
    e.preventDefault();
    var err = $('login-error');
    err.classList.add('hidden');
    var username = $('login-username').value;
    var password = $('login-password').value;
    window.PBRAuth.login(username, password).then(function (res) {
      if (!res.ok) {
        err.textContent = res.error;
        err.classList.remove('hidden');
        return;
      }
      $('login-form').reset();
      enterApp(res.username);
      UI.toast('Welcome back, ' + res.username + '!');
      resumePendingEvents();
    });
  }

  function onRegisterSubmit(e) {
    e.preventDefault();
    var err = $('register-error');
    err.classList.add('hidden');
    var username = $('register-username').value;
    var password = $('register-password').value;
    var confirmPassword = $('register-confirm').value;
    if (password !== confirmPassword) {
      err.textContent = 'Passwords do not match.';
      err.classList.remove('hidden');
      return;
    }
    window.PBRAuth.register(username, password).then(function (res) {
      if (!res.ok) {
        err.textContent = res.error;
        err.classList.remove('hidden');
        return null;
      }
      return window.PBRAuth.login(username, password);
    }).then(function (res) {
      if (!res || !res.ok) return;
      $('register-form').reset();
      enterApp(res.username);
      UI.toast('Account created. Welcome, ' + res.username + '!');
      resumePendingEvents();
    });
  }

  function onLogout() {
    window.PBRAuth.logout();
    S.setUser(null);
    showAuth('login');
    if (window.PBREventsScreen) window.PBREventsScreen.refreshSession();
    UI.toast('Logged out.');
  }

  function switchTab(name) {
    if (name === 'events') {
      openEventsScreen({ from: 'app', returnTab: lastTab });
      return;
    }
    lastTab = name;
    document.querySelectorAll('.tab-view').forEach(function (v) {
      v.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(function (t) {
      var isActive = t.getAttribute('data-tab') === name;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    $('tab-' + name).classList.add('active');
    if (name === 'record') populateTeamSelects();
  }

  function populateCategoryOptions() {
    var cats = S.getCategories();
    fillSelect($('player-category'), cats, '');
    fillSelect($('player-category-filter'), cats, '');
    fillSelect($('leaderboard-filter'), cats, '');
  }

  function fillSelect(select, cats, placeholder) {
    select.innerHTML = '';
    if (placeholder !== undefined && placeholder !== null) {
      var ph = document.createElement('option');
      ph.value = '';
      ph.textContent = placeholder;
      select.appendChild(ph);
    }
    cats.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
  }

  function populateTeamSelects() {
    var players = S.getAllPlayers();
    var opts = players
      .map(function (p) {
        return '<option value="' + p.id + '">' + escapeHtml(p.name) + (p.category ? ' (' + escapeHtml(p.category) + ')' : '') + '</option>';
      })
      .join('');
    ['team1-p1', 'team1-p2', 'team2-p1', 'team2-p2'].forEach(function (id) {
      var prev = $(id).value;
      $(id).innerHTML = opts;
      if (prev) $(id).value = prev;
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderAll() {
    renderPlayers();
    renderGames();
    renderLeaderboard();
  }

  /* ---------- Players ---------- */

  function renderPlayers() {
    var list = $('players-list');
    var players = S.getAllPlayers();

    var filtered = players.filter(function (p) {
      var matchesSearch = !currentSearch || p.name.toLowerCase().indexOf(currentSearch) !== -1;
      var matchesCat = !currentCategoryFilter || p.category === currentCategoryFilter;
      return matchesSearch && matchesCat;
    });

    if (!filtered.length) {
      list.innerHTML = '';
      list.appendChild(buildEmpty(players.length
        ? 'No players match your search.'
        : 'No players yet. Add your first player to get started!'));
      return;
    }

    list.innerHTML = '';
    filtered.forEach(function (p) {
      list.appendChild(buildPlayerCard(p));
    });
  }

  function buildPlayerCard(p) {
    var s = Stats.playerStats(p.id, S.getAllGames());
    var card = UI.el('div', 'player-card');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Open profile for ' + p.name);
    card.addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      openProfile(p.id);
    });
    card.addEventListener('keydown', function (e) {
      if (e.target !== card || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      openProfile(p.id);
    });

    var top = UI.el('div', 'player-card-top');
    var name = UI.el('div', 'player-name', p.name);
    var actions = UI.el('div', 'player-actions');

    var editBtn = UI.el('button', 'btn btn-outline btn-sm', 'Edit');
    editBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      startEdit(p);
    });

    var delBtn = UI.el('button', 'btn btn-danger btn-sm', 'Delete');
    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (confirm('Delete "' + p.name + '"? Their game history will also be removed.')) {
        S.removePlayer(p.id);
        populateTeamSelects();
        renderAll();
        UI.toast(p.name + ' deleted.', 'error');
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    top.appendChild(name);
    top.appendChild(actions);

    var meta = UI.el('div', 'player-stats-row');
    meta.appendChild(buildPlayerStat('W', s.wins));
    meta.appendChild(buildPlayerStat('L', s.losses));
    meta.appendChild(buildPlayerStat('Games', s.games));
    meta.appendChild(buildPlayerStat('Win rate', UI.formatPct(s.winRate), true));

    card.appendChild(top);
    if (p.category) card.appendChild(UI.categoryBadge(p.category));
    card.appendChild(meta);

    return card;
  }

  function buildPlayerStat(label, value, isHighlight) {
    var stat = UI.el('span', 'player-stat' + (isHighlight ? ' highlight' : ''));
    stat.appendChild(document.createTextNode(label + ' '));
    stat.appendChild(UI.el('strong', null, String(value)));
    return stat;
  }

  function resetPlayerForm() {
    editingPlayerId = null;
    $('player-name').value = '';
    $('player-category').value = '';
    $('player-form').querySelector('button[type="submit"]').textContent = 'Save';
  }

  function startEdit(p) {
    editingPlayerId = p.id;
    var form = $('add-player-form');
    form.classList.remove('hidden');
    $('btn-show-add-player').textContent = 'Cancel';
    $('player-name').value = p.name;
    $('player-category').value = p.category || '';
    $('player-form').querySelector('button[type="submit"]').textContent = 'Update';
    $('player-name').focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function onPlayerSubmit(e) {
    e.preventDefault();
    var name = $('player-name').value.trim();
    var category = $('player-category').value;

    if (!name) {
      UI.toast('Please enter a player name.', 'error');
      return;
    }

    if (editingPlayerId) {
      S.updatePlayer(editingPlayerId, name, category);
      UI.toast('Player updated.');
    } else {
      S.addPlayer(name, category);
      UI.toast(name + ' added.');
    }

    resetPlayerForm();
    populateTeamSelects();
    renderAll();
  }

  function onAddCategory() {
    var input = $('new-category');
    var name = input.value.trim();
    if (!name) {
      UI.toast('Enter a category name first.', 'error');
      return;
    }
    if (!S.addCategory(name)) {
      UI.toast('That category already exists.', 'error');
      return;
    }
    input.value = '';
    populateCategoryOptions();
    $('player-category').value = name;
    UI.toast('Category "' + name + '" added.');
  }

  /* ---------- Record Game ---------- */

  function onSaveGame() {
    var t1p1 = $('team1-p1').value;
    var t1p2 = $('team1-p2').value;
    var t2p1 = $('team2-p1').value;
    var t2p2 = $('team2-p2').value;
    var s1 = Number($('team1-score').value);
    var s2 = Number($('team2-score').value);
    var errBox = $('record-error');

    errBox.classList.add('hidden');

    var ids = [t1p1, t1p2, t2p1, t2p2];
    var unique = new Set(ids);

    if (ids.some(function (id) { return !id; })) {
      showError(errBox, 'All four players must be selected.');
      return;
    }
    if (unique.size !== 4) {
      showError(errBox, 'Each player can only play on one team.');
      return;
    }
    if (!(s1 >= 0) || !(s2 >= 0)) {
      showError(errBox, 'Scores must be valid numbers.');
      return;
    }
    if (s1 === s2) {
      showError(errBox, 'Scores cannot be tied — pickleball has no draws.');
      return;
    }

    S.addGame([t1p1, t1p2], [t2p1, t2p2], s1, s2);
    $('team1-score').value = '0';
    $('team2-score').value = '0';
    populateTeamSelects();
    renderAll();

    var winnerText = s1 > s2
      ? UI.playerName(S, t1p1) + ' & ' + UI.playerName(S, t1p2)
      : UI.playerName(S, t2p1) + ' & ' + UI.playerName(S, t2p2);
    UI.toast('Game recorded — ' + winnerText + ' win!');
  }

  function showError(box, msg) {
    box.textContent = msg;
    box.classList.remove('hidden');
  }

  function renderGames() {
    var container = $('games-list');
    var games = S.getAllGames();
    if (!games.length) {
      container.innerHTML = '';
      container.appendChild(buildEmpty('No games recorded yet. Record your first match!'));
      return;
    }

    container.innerHTML = '';
    games.slice().reverse().forEach(function (g) {
      container.appendChild(buildGameItem(g));
    });
  }

  function buildGameItem(g) {
    var item = UI.el('div', 'game-item');

    var meta = UI.el('div', 'game-meta');
    var teams = UI.el('div', 'game-teams');
    var winTeam = g.score1 > g.score2 ? g.team1 : g.team2;
    teams.innerHTML =
      teamNames(g.team1, winTeam) + ' <strong>' + g.score1 + '</strong> — <strong>' + g.score2 + '</strong> ' + teamNames(g.team2, winTeam);

    var date = UI.el('div', 'game-date', UI.formatDate(g.date));
    meta.appendChild(teams);
    meta.appendChild(date);

    var delBtn = UI.el('button', 'btn btn-danger btn-sm', 'Delete');
    delBtn.addEventListener('click', function () {
      if (confirm('Delete this game record?')) {
        S.removeGame(g.id);
        renderAll();
        UI.toast('Game deleted.', 'error');
      }
    });

    item.appendChild(meta);
    item.appendChild(delBtn);
    return item;
  }

  function teamNames(ids, winTeam) {
    return ids.map(function (pid) {
      var n = escapeHtml(UI.playerName(S, pid));
      if (winTeam && winTeam.indexOf(pid) !== -1) n += ' <span class="win">✓</span>';
      return n;
    }).join(' & ');
  }

  /* ---------- Leaderboard ---------- */

  function renderLeaderboard() {
    var container = $('leaderboard-table');
    var players = S.getAllPlayers().filter(function (p) {
      return !currentLeaderboardFilter || p.category === currentLeaderboardFilter;
    });

    if (!players.length) {
      container.innerHTML = '';
      var wrap = UI.el('div');
      wrap.appendChild(buildEmpty('No players to rank yet.'));
      container.appendChild(wrap);
      return;
    }

    var rows = Stats.buildLeaderboard(players, S.getAllGames());

    var table = UI.el('table', 'lb-table');
    var thead = UI.el('thead');
    var headRow = UI.el('tr');
    ['#', 'Player', 'Category', 'W', 'L', 'Games', 'Win Rate'].forEach(function (h) {
      headRow.appendChild(UI.el('th', null, h));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = UI.el('tbody');
    rows.forEach(function (r) {
      var tr = UI.el('tr');
      tr.tabIndex = 0;
      tr.setAttribute('role', 'button');
      tr.setAttribute('aria-label', 'Open profile for ' + r.player.name);
      tr.addEventListener('click', function () { openProfile(r.player.id); });
      tr.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openProfile(r.player.id);
        }
      });

      var rankTd = UI.el('td');
      rankTd.appendChild(UI.rankBadge(r.rank));
      tr.appendChild(rankTd);

      var playerTd = UI.el('td');
      var playerBox = UI.el('div', 'lb-player');
      playerBox.appendChild(UI.el('span', 'lb-name', r.player.name));
      playerTd.appendChild(playerBox);
      tr.appendChild(playerTd);

      var catTd = UI.el('td');
      if (r.player.category) catTd.appendChild(UI.categoryBadge(r.player.category));
      else catTd.textContent = '—';
      tr.appendChild(catTd);

      tr.appendChild(UI.el('td', null, String(r.wins)));
      tr.appendChild(UI.el('td', null, String(r.losses)));
      tr.appendChild(UI.el('td', null, String(r.games)));

      var rateTd = UI.el('td');
      var bar = UI.el('div', 'winrate-bar');
      var fill = UI.el('div', 'winrate-bar-fill');
      fill.style.width = (r.winRate * 100) + '%';
      bar.appendChild(fill);
      var pct = UI.el('span', UI.winRateClass(r.winRate), ' ' + UI.formatPct(r.winRate));
      rateTd.appendChild(bar);
      rateTd.appendChild(pct);
      tr.appendChild(rateTd);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
  }

  /* ---------- Profile Modal ---------- */

  function openProfile(playerId) {
    var p = S.getPlayer(playerId);
    if (!p) return;
    var s = Stats.playerStats(playerId, S.getAllGames());
    var games = Stats.playerGames(playerId, S.getAllGames());
    var content = $('profile-content');
    content.innerHTML = '';

    var header = UI.el('div', 'profile-header');
    header.appendChild(UI.el('h2', null, p.name));
    if (p.category) header.appendChild(UI.categoryBadge(p.category));
    content.appendChild(header);

    var grid = UI.el('div', 'profile-stat-grid');
    [
      ['Games', s.games],
      ['Wins', s.wins],
      ['Losses', s.losses],
      ['Win Rate', UI.formatPct(s.winRate)],
      ['Streak', s.streak > 0 ? 'W' + s.streak : (s.streak < 0 ? 'L' + Math.abs(s.streak) : '—')],
      ['Point Diff', s.pointDiff > 0 ? '+' + s.pointDiff : String(s.pointDiff)]
    ].forEach(function (pair) {
      var box = UI.el('div', 'profile-stat');
      box.appendChild(UI.el('div', 'value', String(pair[1])));
      box.appendChild(UI.el('div', 'label', pair[0]));
      grid.appendChild(box);
    });
    content.appendChild(grid);

    var section = UI.el('div', 'profile-games');
    section.appendChild(UI.el('h3', null, 'Match History'));
    if (!games.length) {
      section.appendChild(UI.el('p', 'empty-state', 'No matches played yet.'));
    } else {
      games.forEach(function (g) {
        section.appendChild(buildProfileGameItem(p, g));
      });
    }
    content.appendChild(section);

    $('profile-modal').classList.remove('hidden');
  }

  function buildProfileGameItem(player, g) {
    var onTeam1 = g.team1.indexOf(player.id) !== -1;
    var won = onTeam1 ? g.score1 > g.score2 : g.score2 > g.score1;
    var oppIds = onTeam1 ? g.team2 : g.team1;
    var playerScore = onTeam1 ? g.score1 : g.score2;
    var oppScore = onTeam1 ? g.score2 : g.score1;

    var item = UI.el('div', 'game-item');
    var meta = UI.el('div', 'game-meta');
    var line = UI.el('div', 'game-teams');
    var res = UI.el('span', won ? 'win' : '', won ? ' W ' : ' L ');
    line.appendChild(res);
    line.appendChild(document.createTextNode('vs ' + teamNames(oppIds) + ' · ' + playerScore + '–' + oppScore));
    meta.appendChild(line);
    meta.appendChild(UI.el('div', 'game-date', UI.formatDate(g.date)));
    item.appendChild(meta);
    return item;
  }

  function closeProfile() {
    $('profile-modal').classList.add('hidden');
  }

  function buildEmpty(msg) {
    var box = UI.el('div', 'empty-state');
    box.appendChild(UI.el('span', 'empty-mark', ''));
    box.appendChild(UI.el('p', null, msg));
    return box;
  }
})();
