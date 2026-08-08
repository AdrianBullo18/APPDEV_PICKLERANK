(function () {
  'use strict';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function badgeClass(category) {
    var lower = (category || '').toLowerCase();
    if (lower.indexOf('begin') !== -1) return 'bg-beginner';
    if (lower.indexOf('inter') !== -1) return 'bg-intermediate';
    if (lower.indexOf('advanc') !== -1) return 'bg-advanced';
    if (lower.indexOf('pro') !== -1) return 'bg-pro';
    return 'bg-default';
  }

  function categoryBadge(category) {
    if (!category) return null;
    var badge = el('span', 'badge ' + badgeClass(category), category);
    return badge;
  }

  function rankBadge(rank) {
    var cls = 'rank-badge';
    if (rank === 1) cls += ' rank-1';
    else if (rank === 2) cls += ' rank-2';
    else if (rank === 3) cls += ' rank-3';
    return el('span', cls, String(rank));
  }

  function formatPct(rate) {
    return (rate * 100).toFixed(1) + '%';
  }

  function winRateClass(rate) {
    if (rate >= 0.6) return 'winrate-good';
    if (rate >= 0.4) return 'winrate-mid';
    return 'winrate-low';
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function playerName(pbStore, id) {
    var p = pbStore.getPlayer(id);
    return p ? p.name : 'Unknown';
  }

  function toast(msg, type) {
    var box = document.getElementById('toast');
    box.textContent = msg;
    box.className = 'toast ' + (type || 'success');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      box.className = 'toast hidden';
    }, 2600);
  }

  window.PBRUI = {
    el: el,
    categoryBadge: categoryBadge,
    rankBadge: rankBadge,
    formatPct: formatPct,
    winRateClass: winRateClass,
    formatDate: formatDate,
    playerName: playerName,
    toast: toast
  };
})();
