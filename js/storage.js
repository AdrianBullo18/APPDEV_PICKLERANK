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
    categories: DEFAULT_CATEGORIES.slice(),
    events: [],
    clubs: [],
    entries: []
  };

  function seedEvents() {
    if (!window.PBREventsData || typeof window.PBREventsData.seedEvents !== 'function') return [];
    return window.PBREventsData.seedEvents();
  }

  function load() {
    try {
      var raw = localStorage.getItem(storeKey());
      if (!raw) {
        // A store with no data yet: start clean and seed the tournament calendar once.
        state.players = [];
        state.games = [];
        state.categories = DEFAULT_CATEGORIES.slice();
        state.events = seedEvents();
        state.clubs = [];
        state.entries = [];
        save();
        return;
      }
      var data = JSON.parse(raw);
      state.players = Array.isArray(data.players) ? data.players : [];
      state.games = Array.isArray(data.games) ? data.games : [];
      if (Array.isArray(data.categories) && data.categories.length) {
        state.categories = data.categories;
      }
      state.clubs = Array.isArray(data.clubs) ? data.clubs : [];
      state.entries = Array.isArray(data.entries) ? data.entries : [];
      if (Array.isArray(data.events)) {
        state.events = data.events;
      } else {
        // Existing store that pre-dates the Events feature: add the calendar once.
        state.events = seedEvents();
        save();
      }
    } catch (e) {
      console.error('Failed to load data from localStorage', e);
      state.players = [];
      state.games = [];
      state.events = [];
      state.clubs = [];
      state.entries = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(storeKey(), JSON.stringify({
        players: state.players,
        games: state.games,
        categories: state.categories,
        events: state.events,
        clubs: state.clubs,
        entries: state.entries
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
  function getAllCategories() { return state.categories.slice(); }

  /* Tournaments, clubs and registrations share this same store. */
  function getEvents() { return state.events.slice(); }

  function getEvent(eventId) {
    return state.events.find(function (ev) { return ev.id === eventId; }) || null;
  }

  function getClubs() { return state.clubs.slice(); }

  function addClub(club) {
    var name = (club && club.name ? club.name : '').trim();
    if (!name) return null;
    var exists = state.clubs.some(function (c) {
      return c.name.toLowerCase() === name.toLowerCase();
    });
    if (exists) return null;
    var record = {
      id: uid(),
      name: name,
      region: (club.region || '').trim(),
      city: (club.city || '').trim(),
      venue: (club.venue || '').trim(),
      email: (club.email || '').trim(),
      createdAt: new Date().toISOString()
    };
    state.clubs.push(record);
    save();
    return record;
  }

  function getEntries() { return state.entries.slice(); }

  function findEntry(eventId, divisionName) {
    return state.entries.find(function (e) {
      return e.eventId === eventId && e.division === divisionName;
    }) || null;
  }

  function getEventEntry(eventId) {
    return state.entries.find(function (e) { return e.eventId === eventId; }) || null;
  }

  function getDivisionStatus(eventId, divisionName) {
    var ev = getEvent(eventId);
    if (!ev) return null;
    var div = ev.divisions.find(function (d) { return d.name === divisionName; });
    if (!div) return null;
    var taken = Number(div.filled) || 0;
    state.entries.forEach(function (e) {
      if (e.eventId === eventId && e.division === divisionName) taken++;
    });
    var capacity = Number(div.capacity) || 0;
    var entry = findEntry(eventId, divisionName);
    return {
      filled: taken,
      capacity: capacity,
      open: Math.max(0, capacity - taken),
      isRegistered: !!entry,
      slot: entry ? entry.slot : null,
      fee: Number(div.fee) || 0
    };
  }

  function addEntry(eventId, divisionName) {
    var ev = getEvent(eventId);
    if (!ev) return null;
    if (findEntry(eventId, divisionName)) return null;
    var status = getDivisionStatus(eventId, divisionName);
    if (!status || status.open <= 0) return null;
    var entry = {
      id: uid(),
      eventId: eventId,
      division: divisionName,
      slot: status.filled + 1,
      createdAt: new Date().toISOString()
    };
    state.entries.push(entry);
    save();
    return entry;
  }

  function removeEntry(eventId, divisionName) {
    state.entries = state.entries.filter(function (e) {
      return !(e.eventId === eventId && e.division === divisionName);
    });
    save();
  }

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
    getCategories: getAllCategories,
    getEvents: getEvents,
    getEvent: getEvent,
    getClubs: getClubs,
    addClub: addClub,
    getEntries: getEntries,
    getEventEntry: getEventEntry,
    getDivisionStatus: getDivisionStatus,
    addEntry: addEntry,
    removeEntry: removeEntry
  };
})();
