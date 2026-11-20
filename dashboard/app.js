// Token Launch Radar dashboard. Reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a filterable table, a per-protocol
// detail panel with the model's own inputs and the protocol's farm plan, and a
// separate view of protocols whose token already trades. No network: every byte
// it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;

  var state = { q: '', category: 'all', tab: 'pre', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // The fitted model, recomputed here from the shipped coefficients and the
  // row's own figures, so the page can check the number board.json carries
  // with the same arithmetic. log10(implied) = b0 + b1*log10(TVL) + group beta.
  var GROUP_DUMMIES = ['LEND', 'DEX', 'YIELD', 'RWA', 'DERIV'];
  function impliedOf(row, fit) {
    var beta = fit.beta;
    var logv = beta[0] + beta[1] * Math.log10(Math.max(row.tvl_usd, 1));
    var gi = GROUP_DUMMIES.indexOf(row.group || 'OTHER');
    if (gi >= 0) logv += beta[2 + gi];
    logv = Math.min(14, Math.max(0, logv));
    return Math.max(1, Math.round(Math.pow(10, logv)));
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('tab') === 'live' || params.get('tab') === 'pre') state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.tab === 'live') params.set('tab', 'live');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  var $ = function (id) { return document.getElementById(id); };

  function renderMeta() {
    $('top-meta').innerHTML =
      '<span>Snapshot <b>' + esc(DATA.as_of) + '</b></span>' +
      '<span>Model <b>' + esc(DATA.model_version) + '</b></span>' +
      '<span>Floor <b>$' + Math.round(DATA.floor_usd / 1e6) + 'M TVL</b></span>';
    $('headline').textContent = DATA.watchlist_size + ' watchlist protocols, ranked by implied value';
    $('lede-text').textContent = 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) +
      'M of TVL and no token on record. The early radar adds ' + DATA.early_size +
      ' pre-token protocols below that floor, chosen by implied value. Implied value is a model, not a promise.';
    var med = DATA.kpis.median_implied_usd;
    $('facts').innerHTML =
      fact('Watchlist TVL', fmtUsd(DATA.kpis.watchlist_tvl_usd)) +
      fact('Median implied value', fmtUsd(med)) +
      fact('Pre-token rows scored', String(DATA.board_size)) +
      fact('Watchlist covered', DATA.kpis.watchlist_covered + ' / ' + DATA.kpis.watchlist_size) +
      fact('Fitted R-squared', DATA.fit.r2_full.toFixed(2) + ' (n = ' + DATA.fit.train_n + ')') +
      fact('Median held-out error', 'x' + Math.pow(10, DATA.fit.folds[0].med_err).toFixed(1) + ' - x' + Math.pow(10, DATA.fit.folds[1].med_err).toFixed(1));
    var f = DATA.fit;
    var beta = f.beta;
    var terms = GROUP_DUMMIES.map(function (g, i) { return g + ' ' + (beta[2 + i] >= 0 ? '+' : '') + beta[2 + i].toFixed(4); }).join(', ');
    $('formula').textContent = 'log10(implied value) = ' + beta[0].toFixed(4) + ' + ' + beta[1].toFixed(4) +
      ' x log10(tvl_usd)' + '   |   group adjustments (OTHER = 0): ' + terms +
      '   |   ridge lambda ' + f.lambda + ', fitted on ' + f.train_n + ' tokened protocols';
    var foldRows = f.folds.map(function (fold) {
      return '<tr><td>Held out, ' + esc(fold.test) + '</td><td class="num">' + fold.n_test + '</td><td class="num">' +
        fold.r2.toFixed(2) + '</td><td class="num">x' + Math.pow(10, fold.med_err).toFixed(2) + '</td></tr>';
    }).join('');
    $('validation').innerHTML = '<table class="valid"><thead><tr><th>Validation</th><th>Protocols</th><th>R-squared</th><th>Median error</th></tr></thead><tbody>' +
      '<tr><td>Full fit, all ' + f.train_n + ' tokened protocols</td><td class="num">' + f.train_n + '</td><td class="num">' +
      f.r2_full.toFixed(2) + '</td><td class="num">x' + Math.pow(10, f.med_err_full).toFixed(2) + '</td></tr>' + foldRows + '</tbody></table>';
    $('model-note').textContent = 'The fit is honest about its weakness: TVL and category explain about a fifth of what a token ends up worth (R-squared ' +
      f.r2_full.toFixed(2) + '); the rest is the team, the timing and the narrative, none of which a TVL snapshot can see. ' +
      'Seven-day growth, age and chain count were tested as extra terms and did not improve held-out error, so they are shown for context and do not move the score. ' +
      'Expected value is the implied value times the launch prior — the share of protocols that gain a token within a year at this age, from the snapshot itself — ' +
      'so a launch that may never come is never priced as if it will. ' +
      'The live-token protocols are set aside with their market caps shown, never ranked as launch candidates.';
    $('foot-note').textContent = 'Snapshot ' + DATA.as_of + ', ' + DATA.source +
      '. Implied values are this radar\u2019s own model claim, never a price and never a prediction that a token will be issued. ' +
      'A protocol that records no token may still have one its record does not carry.';
  }
  function fact(label, value) {
    return '<div class="fact"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
  }

  function renderControls() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var sel = $('category');
    sel.innerHTML = '<option value="all">All categories</option>' + cats.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === state.category ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
    var q = $('q');
    if (q.value !== state.q) q.value = state.q;
    $('tab-pre').setAttribute('aria-pressed', state.tab === 'pre' ? 'true' : 'false');
    $('tab-live').setAttribute('aria-pressed', state.tab === 'live' ? 'true' : 'false');
  }

  function rowHtml(r, max) {
    var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
    var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
    return '<tr data-slug="' + esc(r.slug) + '" data-selected="' + (state.selected === r.slug ? 'true' : 'false') + '"' +
      (r.rank === 1 ? ' class="top1"' : '') + ' tabindex="0">' +
      '<td class="num">' + r.rank + '</td>' +
      '<td><div class="name"><b>' + esc(r.name) + '</b><span class="slug">' + esc(r.slug) + '</span>' +
      '<span class="sub">' + esc(r.category || 'Other') + ' on ' + esc(r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + '</span></div></td>' +
      '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
      '<td class="num ' + growthClass + '">' + growth + '</td>' +
      '<td class="num">' + fmtAge(r.age_days) + '</td>' +
      '<td><div class="implied"><div class="bar" aria-hidden="true"><i style="width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%"></i></div>' +
      '<span class="num">' + fmtUsd(r.implied_value_usd) + '</span></div></td>' +
      '<td><span class="status">no token</span></td></tr>';
  }

  function renderTable() {
    var body = $('board-body');
    var caption = $('table-caption');
    var empty = $('empty');
    document.querySelectorAll('th button[data-sort]').forEach(function (btn) {
      var key = btn.getAttribute('data-sort');
      btn.innerHTML = btn.textContent.replace(/ [v^]$/, '') + (state.sort === key ? ' <span class="arrow" aria-hidden="true">' + (state.dir < 0 ? 'v' : '^') + '</span>' : '');
    });
    if (state.tab === 'live') {
      caption.textContent = 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.';
      var live = DATA.live.slice().sort(function (a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); });
      body.innerHTML = live.map(function (r) {
        return '<tr data-slug="' + esc(r.slug) + '" tabindex="0"><td class="num">live</td>' +
          '<td><div class="name"><b>' + esc(r.name) + '</b><span class="slug">' + esc(r.slug) + '</span>' +
          '<span class="sub">' + esc(r.category || 'Other') + ' on ' + esc(r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + '</span></div></td>' +
          '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
          '<td class="num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</td>' +
          '<td class="num">—</td>' +
          '<td class="num">' + fmtUsd(r.mcap_usd) + '</td>' +
          '<td><span class="status live">already trades</span></td></tr>';
      }).join('');
      empty.hidden = true;
      $('count').textContent = DATA.live.length + ' live-token protocols';
      return;
    }
    caption.textContent = 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.';
    var list = sortedRows(filteredRows());
    $('count').textContent = list.length + ' rows shown';
    if (list.length === 0) {
      body.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    var max = list[0].implied_value_usd || 1;
    body.innerHTML = list.map(function (r) { return rowHtml(r, max); }).join('');
  }

  function renderDetail() {
    var empty = $('detail-empty');
    var body = $('detail-body');
    var row = null;
    if (state.selected) {
      for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === state.selected) { row = DATA.rows[i]; break; }
    }
    if (!row) {
      empty.hidden = false;
      body.hidden = true;
      body.innerHTML = '';
      return;
    }
    empty.hidden = true;
    body.hidden = false;
    var recomputed = impliedOf(row, DATA.fit);
    var match = recomputed === row.implied_value_usd;
    var steps = (row.farm_steps || []).map(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      return '<li><b>' + esc(action) + '</b><span class="cost">' + esc(tail) + '</span></li>';
    }).join('');
    body.innerHTML =
      '<div class="detail-head"><div><span class="rankline">RANK ' + row.rank + ' OF ' + DATA.board_size + '</span>' +
      '<h2>' + esc(row.name) + '</h2>' +
      '<p class="sub">' + esc(row.category || 'Other') + ' on ' + esc(row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + '</p></div>' +
      '<button class="close" type="button" id="detail-close" aria-label="Close details">Close</button></div>' +
      '<section class="detail-section"><h3>Implied value</h3><div class="equation">' +
      '<div><span>TVL</span><b>' + fmtUsd(row.tvl_usd) + '</b></div>' +
      '<div><span>Category group</span><b>' + esc(row.group) + ' (' + (row.group_adjustment >= 0 ? '+' : '') + row.group_adjustment.toFixed(4) + ')</b></div>' +
      '<div><span>Fitted log10 value</span><b>' + row.log10_implied.toFixed(4) + '</b></div>' +
      '<div><span>Implied value</span><b>' + fmtUsd(row.implied_value_usd) + '</b></div>' +
      '<div><span>Launch prior (1 year)</span><b>' + Math.round(row.launch_prior * 100) + '%</b></div>' +
      '<div><span>Expected value</span><b>' + fmtUsd(row.ev_usd) + '</b></div>' +
      '<div><span>Seven-day growth (context)</span><b>' + fmtPct(row.change_7d) + '</b></div>' +
      '<div><span>Age with no token (context)</span><b>' + fmtAge(row.age_days) + '</b></div>' +
      '<div><span>Chains (context)</span><b>' + (row.chains ? row.chains.length : 0) + '</b></div>' +
      '<div class="match">' + (match ? 'Recomputed from the fitted coefficients: ' + fmtUsd(recomputed) + ' — the same number the board carries.' : 'Recomputed: ' + fmtUsd(recomputed) + ' — differs from the board; the data would be stale.') + '</div>' +
      '</div><p class="sub">Model ' + esc(DATA.model_version) + ': the same fitted function scores every protocol. Expected value is the implied value times the launch prior. This is an estimate, not a price.</p></section>' +
      '<section class="detail-section"><h3>Farm plan</h3><ol class="steps">' + steps + '</ol></section>';
    $('detail-close').addEventListener('click', function () {
      state.selected = null;
      writeHash();
      render();
    });
  }

  function render() {
    renderMeta();
    renderControls();
    renderTable();
    renderDetail();
  }

  function openDetail(slug) {
    state.selected = slug;
    state.tab = 'pre';
    writeHash();
    render();
    var panel = document.getElementById('detail');
    if (panel && panel.scrollIntoView) panel.scrollIntoView({ block: 'nearest' });
  }

  document.querySelectorAll('th button[data-sort]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-sort');
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = -1; }
      render();
    });
  });
  $('q').addEventListener('input', function (e) { state.q = e.target.value; writeHash(); render(); });
  $('category').addEventListener('change', function (e) { state.category = e.target.value; writeHash(); render(); });
  $('tab-pre').addEventListener('click', function () { state.tab = 'pre'; state.selected = null; writeHash(); render(); });
  $('tab-live').addEventListener('click', function () { state.tab = 'live'; state.selected = null; writeHash(); render(); });
  $('clear-filters').addEventListener('click', function () { state.q = ''; state.category = 'all'; writeHash(); render(); });
  $('board-body').addEventListener('click', function (e) {
    var tr = e.target.closest ? e.target.closest('tr[data-slug]') : null;
    if (tr && state.tab === 'pre') openDetail(tr.getAttribute('data-slug'));
  });
  $('board-body').addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest) {
      var tr = e.target.closest('tr[data-slug]');
      if (tr && state.tab === 'pre') { e.preventDefault(); openDetail(tr.getAttribute('data-slug')); }
    }
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.selected) { state.selected = null; writeHash(); render(); }
  });

  readHash();
  render();
})();
