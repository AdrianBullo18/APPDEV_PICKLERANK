(function () {
  'use strict';

  function playerStats(playerId, games) {
    var wins = 0;
    var losses = 0;
    var pointsFor = 0;
    var pointsAgainst = 0;
    var streak = 0;
    var lastResult = null;
    var gameCount = 0;

    games.forEach(function (g) {
      var onTeam1 = g.team1.indexOf(playerId) !== -1;
      var onTeam2 = g.team2.indexOf(playerId) !== -1;
      if (!onTeam1 && !onTeam2) return;

      var won;
      if (onTeam1) {
        won = g.score1 > g.score2;
        pointsFor += g.score1;
        pointsAgainst += g.score2;
      } else {
        won = g.score2 > g.score1;
        pointsFor += g.score2;
        pointsAgainst += g.score1;
      }

      gameCount++;
      if (won) {
        wins++;
        if (lastResult === null || lastResult === 'win') streak++;
        else streak = 1;
        lastResult = 'win';
      } else {
        losses++;
        if (lastResult === null || lastResult === 'loss') streak--;
        else streak = -1;
        lastResult = 'loss';
      }
    });

    var total = wins + losses;
    var winRate = total ? wins / total : 0;

    return {
      wins: wins,
      losses: losses,
      games: total,
      winRate: winRate,
      pointsFor: pointsFor,
      pointsAgainst: pointsAgainst,
      pointDiff: pointsFor - pointsAgainst,
      streak: streak
    };
  }

  function buildLeaderboard(players, games) {
    var rows = players.map(function (p) {
      var s = playerStats(p.id, games);
      return {
        player: p,
        wins: s.wins,
        losses: s.losses,
        games: s.games,
        winRate: s.winRate,
        pointDiff: s.pointDiff
      };
    });

    rows.sort(function (a, b) {
      if (b.games === 0 && a.games > 0) return -1;
      if (a.games === 0 && b.games > 0) return 1;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.games !== a.games) return b.games - a.games;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.player.name.localeCompare(b.player.name);
    });

    rows.forEach(function (r, i) { r.rank = i + 1; });
    return rows;
  }

  function playerGames(playerId, games) {
    return games.filter(function (g) {
      return g.team1.indexOf(playerId) !== -1 || g.team2.indexOf(playerId) !== -1;
    }).slice().reverse();
  }

  window.PBRStats = {
    playerStats: playerStats,
    buildLeaderboard: buildLeaderboard,
    playerGames: playerGames
  };
})();
