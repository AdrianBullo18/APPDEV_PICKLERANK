(function () {
  'use strict';

  var USERS_KEY = 'pickleball-auth-users-v1';
  var SESSION_KEY = 'pickleball-auth-session-v1';

  function getUsers() {
    try {
      var raw = localStorage.getItem(USERS_KEY);
      var users = raw ? JSON.parse(raw) : [];
      return Array.isArray(users) ? users : [];
    } catch (e) {
      return [];
    }
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Failed to save users', e);
    }
  }

  function simpleHash(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16);
  }

  function sha256(str) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      return crypto.subtle
        .digest('SHA-256', new TextEncoder().encode(str))
        .then(function (buf) {
          var bytes = new Uint8Array(buf);
          var hex = '';
          for (var i = 0; i < bytes.length; i++) {
            hex += ('0' + bytes[i].toString(16)).slice(-2);
          }
          return hex;
        })
        .catch(function () {
          return simpleHash(str);
        });
    }
    return Promise.resolve(simpleHash(str));
  }

  function hashPassword(username, password) {
    return sha256(username.toLowerCase() + ':' + password);
  }

  function register(username, password) {
    username = (username || '').trim();
    if (username.length < 3) {
      return Promise.resolve({ ok: false, error: 'Username must be at least 3 characters.' });
    }
    if (!password || password.length < 6) {
      return Promise.resolve({ ok: false, error: 'Password must be at least 6 characters.' });
    }
    var users = getUsers();
    var taken = users.some(function (u) {
      return u.username.toLowerCase() === username.toLowerCase();
    });
    if (taken) {
      return Promise.resolve({ ok: false, error: 'That username is already taken.' });
    }
    return hashPassword(username, password).then(function (hash) {
      users.push({ username: username, hash: hash, createdAt: new Date().toISOString() });
      saveUsers(users);
      return { ok: true };
    });
  }

  function login(username, password) {
    username = (username || '').trim();
    var users = getUsers();
    var user = users.find(function (u) {
      return u.username.toLowerCase() === username.toLowerCase();
    });
    if (!user) {
      return Promise.resolve({ ok: false, error: 'No account found with that username.' });
    }
    return hashPassword(user.username, password).then(function (hash) {
      if (hash !== user.hash) {
        return { ok: false, error: 'Incorrect password.' };
      }
      try {
        localStorage.setItem(SESSION_KEY, user.username);
      } catch (e) {
        return { ok: false, error: 'Could not save session.' };
      }
      return { ok: true, username: user.username };
    });
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function currentUser() {
    return localStorage.getItem(SESSION_KEY) || null;
  }

  window.PBRAuth = {
    register: register,
    login: login,
    logout: logout,
    currentUser: currentUser
  };
})();
