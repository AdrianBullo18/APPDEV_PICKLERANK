(function () {
  'use strict';

  var STORAGE_KEY = 'pickleball-ranking-v1';
  var DEFAULT_CATEGORIES = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];

  var currentUser = null;

  function storeKey() {
    return currentUser ? STORAGE_KEY + ':' + currentUser : STORAGE_KEY;
  }

  function setUser(username) {
    currentUser = username || null;
    load();
  }

  var state = {
    players: [],
    games: [],
    categories: DEFAULT_CATEGORIES.slice()
  };

  function load() {
    try {
      var raw = localStorage.getItem(storeKey());
      if (!raw) return;
      var data = JSON.parse(raw);
      state.players = Array.isArray(data.players) ? data.players : [];
      state.games = Array.isArray(data.games) ? data.games : [];
      if (Array.isArray(data.categories) && data.categories.length) {
        state.categories = data.categories;
      }
    } catch (e) {
      console.error('Failed to load data from localStorage', e);
      state.players = [];
      state.games = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(storeKey(), JSON.stringify({
        players: state.players,
        games: state.games,
        categories: state.categories
      }));
    } catch (e) {
      console.error('Failed to save data to localStorage', e);
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function addPlayer(name, category) {
    var player = {
      id: uid(),
      name: name.trim(),
      category: category || '',
      joinedDate: new Date().toISOString()
    };
    state.players.push(player);
    save();
    return player;
  }

  function updatePlayer(id, name, category) {
    var player = getPlayer(id);
    if (!player) return null;
    if (name !== undefined && name.trim()) player.name = name.trim();
    if (category !== undefined) player.category = category;
    save();
    return player;
  }

  function removePlayer(id) {
    state.players = state.players.filter(function (p) { return p.id !== id; });
    state.games = state.games.filter(function (g) {
      return g.team1.indexOf(id) === -1 && g.team2.indexOf(id) === -1;
    });
    save();
  }

  function getPlayer(id) {
    return state.players.find(function (p) { return p.id === id; }) || null;
  }

  function addGame(team1, team2, score1, score2) {
    var game = {
      id: uid(),
      date: new Date().toISOString(),
      team1: team1.slice(),
      team2: team2.slice(),
      score1: Number(score1),
      score2: Number(score2)
    };
    state.games.push(game);
    save();
    return game;
  }

  function removeGame(id) {
    state.games = state.games.filter(function (g) { return g.id !== id; });
    save();
  }

  function addCategory(name) {
    name = name.trim();
    if (!name || state.categories.indexOf(name) !== -1) return false;
    state.categories.push(name);
    save();
    return true;
  }

  function getAllPlayers() { return state.players.slice(); }
  function getAllGames() { return state.games.slice(); }
  function getCategories() { return state.categories.slice(); }

  window.PBRStorage = {
    load: load,
    save: save,
    setUser: setUser,
    uid: uid,
    addPlayer: addPlayer,
    updatePlayer: updatePlayer,
    removePlayer: removePlayer,
    getPlayer: getPlayer,
    addGame: addGame,
    removeGame: removeGame,
    addCategory: addCategory,
    getAllPlayers: getAllPlayers,
    getAllGames: getAllGames,
    getCategories: getCategories
  };
})();
