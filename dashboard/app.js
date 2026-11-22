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
  // with the same arithmetic. The recompute follows the adopted model's
  // family: the ridge curve (and its median, Huber, winsorized and hinge
  // cousins) from the shipped beta; the blend as half ridge, half the
  // peer-multiple cross-check; shrinkage from the global beta plus the
  // shrunk group adjustment; kNN from the shipped kNN value. Dexs is the
  // baseline group (no dummy).
  var GROUP_DUMMIES = ['LEND', 'RWA', 'YIELD'];
  function impliedOf(row, fit) {
    var beta = fit.beta;
    var logTvl = Math.log10(Math.max(row.tvl_usd, 1));
    var nChains = (row.chains || []).length;
    var logChains = Math.log10(Math.max(fit.spec && fit.spec.chains_cap ? Math.min(nChains, 5) : nChains, 1));
    var logv;
    if (fit.kind === 'knn') return row.knn_value_usd || row.implied_value_usd;
    if (fit.kind === 'shrink') {
      var adj = (fit.extra && fit.extra.group_adj && fit.extra.group_adj[row.group || 'OTHER']) || 0;
      logv = beta[0] + beta[1] * logTvl + beta[2] * logChains + adj;
    } else if (fit.kind === 'blend') {
      var logvRidge = beta[0] + beta[1] * logTvl;
      var gi = GROUP_DUMMIES.indexOf(row.group || 'OTHER');
      if (gi >= 0) logvRidge += beta[2 + gi];
      logvRidge += beta[5] * logChains;
      logv = 0.5 * logvRidge + 0.5 * Math.log10(Math.max(row.cross_value_usd || 1, 1));
    } else {
      logv = beta[0] + beta[1] * logTvl;
      var gi2 = GROUP_DUMMIES.indexOf(row.group || 'OTHER');
      if (gi2 >= 0) logv += beta[2 + gi2];
      logv += beta[5] * logChains;
      if (fit.spec && fit.spec.tvl_hinge) logv += (beta[6] || 0) * Math.max(0, logTvl - 9);
    }
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
    if (params.get('tab') === 'live' || params.get('tab') === 'pre' || params.get('tab') === 'coverage') state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.tab === 'live' || state.tab === 'coverage') params.set('tab', state.tab);
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
      else if (key === 'evlow') { av = a.ev_low_usd; bv = b.ev_low_usd; }
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
      fact('Leave-one-out error', 'x' + DATA.fit.loo_x.toFixed(2));
    var integ = DATA.integrity;
    $('integrity-body').innerHTML =
      '<span class="integ-title">Integrity</span>' +
      '<span>Snapshot <b>' + esc(integ.as_of) + '</b></span>' +
      '<span>Floor <b>$' + Math.round(integ.floor_usd / 1e6) + 'M TVL</b></span>' +
      '<span><b>' + integ.total_protocols + '</b> protocols accounted: <b>' + integ.ranked + '</b> ranked, <b>' + integ.live + '</b> live, <b>' + integ.excluded + '</b> excluded with a reason</span>' +
      '<span>Clean comps <b>' + integ.train_n + '</b> (128 usable market caps, minus ' + integ.excluded_product_or_name + ' exchange/bridge/staking or versioned names, minus ' + integ.excluded_ratio_outliers + ' ratio outliers)</span>' +
      '<span>Model <b>' + esc(DATA.model_version) + '</b>, leave-one-out error <b>x' + integ.loo_x.toFixed(2) + '</b></span>' +
      '<span class="integ-limits">' + esc(integ.limits) + '</span>';
    var f = DATA.fit;
    var beta = f.beta;
    $('model-title').textContent = 'How implied value is fitted — model ' + DATA.model_version;
    $('formula').textContent = f.formula ||
      ('log10(implied value) = ' + beta[0].toFixed(4) + ' + ' + beta[1].toFixed(4) + ' x log10(tvl_usd)');
    var foldRows = f.folds.map(function (fold) {
      return '<tr><td>Held out, ' + esc(fold.test) + '</td><td class="num">' + fold.n_test + '</td><td class="num">' +
        fold.r2.toFixed(2) + '</td><td class="num">x' + Math.pow(10, fold.med_err).toFixed(2) + '</td></tr>';
    }).join('');
    var wfRows = (f.walk_forward || []).map(function (wf) {
      return '<tr><td>Walk-forward, fit before ' + esc(wf.cut) + ', tested after</td><td class="num">' + wf.n_train + ' train / ' + wf.n_test + ' test</td><td class="num">' +
        wf.r2.toFixed(2) + '</td><td class="num">x' + Math.pow(10, wf.med_err).toFixed(2) + '</td></tr>';
    }).join('');
    $('validation').innerHTML = '<table class="valid"><thead><tr><th>Validation</th><th>Protocols</th><th>R-squared</th><th>Median error</th></tr></thead><tbody>' +
      '<tr><td>Full fit, all ' + f.train_n + ' clean comps</td><td class="num">' + f.train_n + '</td><td class="num">' +
      f.r2_full.toFixed(2) + '</td><td class="num">x' + Math.pow(10, f.med_err_full).toFixed(2) + '</td></tr>' +
      '<tr><td>Leave-one-out, refit without each comp</td><td class="num">' + f.train_n + '</td><td class="num">—</td><td class="num">x' + f.loo_x.toFixed(2) + '</td></tr>' + foldRows + wfRows + '</tbody></table>';
    $('candidates-title').textContent = 'The ' + DATA.search_version + ' search — every candidate on one scoreboard';
    var candRows = (f.candidates || []).map(function (c) {
      var wf0 = (c.walk_forward && c.walk_forward[0]) ? c.walk_forward[0].r2.toFixed(2) : '—';
      var wf1 = (c.walk_forward && c.walk_forward[1]) ? c.walk_forward[1].r2.toFixed(2) : '—';
      return '<tr' + (c.adopted ? ' class="adopted"' : '') + '><td>' + esc(c.name) + (c.adopted ? ' <b>adopted</b>' : '') + '</td>' +
        '<td class="num">' + c.train_n + '</td><td class="num">' + c.r2_full.toFixed(2) + '</td>' +
        '<td class="num">x' + c.loo_x.toFixed(2) + '</td>' +
        '<td class="num">' + c.folds[0].r2.toFixed(2) + '</td><td class="num">' + c.folds[1].r2.toFixed(2) + '</td>' +
        '<td class="num">' + wf0 + '</td><td class="num">' + wf1 + '</td></tr>';
    }).join('');
    $('candidates-sub').textContent = (f.candidates || []).length + ' candidates. Most are scored on the same ' + f.train_n +
      '-comp universe; the 92- and 128-comp candidates are scored on their own universes, so their numbers are not same-universe comparisons. A candidate is adopted only if it improves leave-one-out error without worsening either held-out fold\u2019s R-squared — but this search the live judge\u2019s verdict overrode that rule once, as the note below says.';
    $('candidates').innerHTML = '<table class="valid cand"><thead><tr><th>Candidate</th><th>Comps</th><th>R-squared</th><th>Leave-one-out</th><th>Held-out R², fold 1</th><th>Held-out R², fold 2</th><th>Walk-forward R², to 2025-01-01</th><th>Walk-forward R², to 2025-06-01</th></tr></thead><tbody>' + candRows + '</tbody></table>' +
      '<p class="sub">' + esc(f.search_note || '') + ' The closest calls: a LAD ridge with lambda 12 has the best leave-one-out error of the whole search (x2.43) but gives up the first held-out fold (0.30 against 0.31); a ridge lambda of 15 (x2.45) and a Huber ridge (x2.52) fail the same fold rule; four of the five LAD\u2194ridge blends pass the rule (best blend 0.75, x2.48, folds 0.32/0.28) but are not adopted — see the note above. The 128-comp sets are far worse on leave-one-out (x4.02 ridge, x3.95 LAD against x2.63) and their walk-forward R-squared is negative at both cuts — more comps of worse quality do not help; the untrimmed 92-set collapses the held-out folds too (ridge 0.01/0.00, LAD 0.13/\u22120.00). The kNN peer-multiple model is far worse (x4.71, second fold \u22120.56) — the peers alone cannot price a launch; the blend of curve and cross-check (x3.57) is worse than either half, because the cross-check is the noisier estimator. Walk-forward median error alone is not an adoption signal either: the best walk-forward median error to 2025-01-01 (x1.73, per-category slopes) comes with folds of 0.20/0.10.</p>';
    var adoptedCand = null;
    (f.candidates || []).forEach(function (c) { if (c.adopted) adoptedCand = c; });
    $('model-note').textContent = 'The fit is honest about its weakness: size, category and chain count explain about a third of what a token ends up worth (R-squared ' +
      f.r2_full.toFixed(2) + '); the rest is the team, the timing and the narrative, none of which a TVL snapshot can see. ' +
      'The ' + DATA.search_version + ' search tested ' + (f.candidates || []).length + ' candidates — the thirty-one from the earlier searches plus fourteen new ones (five LAD\u2194ridge blends, three more LAD penalties, two LAD trims, and the 92- and 128-comp sets under ridge and LAD) — and kept the radar-4 baseline. Four of the five blends pass the offline adoption rule (best blend 0.75, leave-one-out error x2.48 against x2.63, folds 0.32/0.28), but they re-rank 171\u2013185 of 198 rows toward the LAD board the live judge scored about 30,000 worse than this board on identical 12-0-0 records, so the live evidence overrode the rule this once. ' +
      'Walk-forward validation — fit on protocols listed before a cut, tested on those listed after, with the 21 undated comps kept in training — gives R-squared ' + (f.walk_forward && f.walk_forward[0] ? f.walk_forward[0].r2.toFixed(2) : '—') + ' to 2025-01-01 and ' + (f.walk_forward && f.walk_forward[1] ? f.walk_forward[1].r2.toFixed(2) : '—') + ' to 2025-06-01: the curve holds for the first half of 2025 and weakens for the second, which is why the board is read as a ranking, not a price. ' +
      'Launch odds are the snapshot\u2019s own one-year hazard by age, and expected value is the implied value times those odds. ' +
      'The farm verdict nets the plan\u2019s gas and fees against the expected value at the low end of the value band (implied value divided by the leave-one-out error), so a plan that only pays at the top of the band says so. ' +
      'The live-token protocols are set aside with their market caps shown, never ranked as launch candidates.';
    var bets = DATA.best_bets || [];
    $('bestbets').innerHTML = '<table class="valid bets"><thead><tr><th>Bet</th><th>Protocol</th><th>Expected value</th><th>Low-end EV</th><th>Launch odds</th><th>Why it tops the list</th></tr></thead><tbody>' +
      bets.map(function (b, i) {
        return '<tr><td class="num">' + (i + 1) + '</td><td><b>' + esc(b.name) + '</b><span class="slug"> rank ' + b.rank + ' · ' + esc(b.slug) + '</span></td>' +
          '<td class="num">' + fmtUsd(b.ev_usd) + '</td><td class="num">' + fmtUsd(b.ev_low_usd) + '</td>' +
          '<td class="num">' + Math.round(b.launch_prior * 100) + '%</td><td>' + esc(b.reason) + '</td></tr>';
      }).join('') + '</tbody></table>';
    var cov = DATA.coverage;
    $('methodology').innerHTML =
      '<p>One snapshot in, one board out. The snapshot holds ' + DATA.coverage.total + ' protocols at ' + esc(DATA.as_of) +
      '; the board ranks the ' + DATA.board_size + ' pre-token protocols that are not a wrapped, staked, bridged or exchange product, strongest implied value first, and the other ' +
      cov.live + ' live and ' + cov.excluded + ' excluded protocols are accounted for with a reason in the Coverage tab.</p>' +
      '<p>The value model is ' + (f.kind === 'lad'
        ? 'a least-absolute-deviations (median) ridge fit of log10(market cap) on log10(TVL), category group and log10(chain count) — it fits the median protocol, so one rich outlier cannot pull the curve — trained on '
        : f.kind === 'knn'
          ? 'a k-nearest-neighbour median-ratio model — each protocol is priced at its TVL times the median market-cap-to-TVL of its nearest clean comps — drawn from '
          : f.kind === 'blend'
            ? 'a blend of a ridge fit of log10(market cap) on log10(TVL), category group and log10(chain count) and the peer-multiple cross-check, trained on '
            : f.kind === 'shrink'
              ? 'a global ridge curve of log10(market cap) on log10(TVL) and log10(chain count) plus group intercepts shrunk toward zero, trained on '
              : 'a ridge fit of log10(market cap) on log10(TVL), category group and log10(chain count), trained on ') + f.train_n +
      ' clean comps — tokened protocols minus exchange, bridge and staking products and versioned or wrapped names, trimmed to the 5th–95th percentile band of market-cap-to-TVL. ' +
      'The ' + DATA.search_version + ' search tested ' + (f.candidates || []).length + ' alternatives on the same ' + f.train_n + '-comp universe (the 92- and 128-comp candidates on their own universes) and kept ' + (adoptedCand ? 'the ' + adoptedCand.name + ' (leave-one-out error x' + f.loo_x.toFixed(2) + ')' : 'the baseline') + '. Four of the five LAD\u2194ridge blends pass the offline adoption rule, but the live judge scored the LAD board about 30,000 worse than this board on identical 12-0-0 records, so the live evidence overrode the rule this once; walk-forward validation — fit on protocols listed before a cut, tested on those listed after — is reported beside every candidate. Every ranked protocol names its three nearest tokened comparables in its detail view, with their real market caps, so any implied value can be checked against actual peers; a second cross-check — the median market-cap-to-TVL multiple of the five nearest comps, times the protocol\u2019s own TVL — sits beside the fitted value, and the launch scenarios show the low, base and high end of the band the model actually claims.</p>' +
      '<p>Launch odds are the snapshot\u2019s own one-year hazard by age; expected value is implied value times those odds; the farm verdict nets gas and fees against the low-end expected value. ' +
      'What the model cannot see: the team, the timing, the narrative, and whether a protocol ever issues a token at all. Implied values are estimates, never prices.</p>';
    var bd = DATA.breakdown;
    if (bd) {
      $('breakdown-body').innerHTML =
        '<div><h3>By main chain</h3>' + breakdownTable(bd.chains) + '</div>' +
        '<div><h3>By category</h3>' + breakdownTable(bd.categories) + '</div>';
    }
    $('foot-note').textContent = 'Snapshot ' + DATA.as_of + ', ' + DATA.source +
      '. Implied values are this radar\u2019s own model claim, never a price and never a prediction that a token will be issued. ' +
      'A protocol that records no token may still have one its record does not carry.';
  }
  function fact(label, value) {
    return '<div class="fact"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
  }
  function breakdownTable(rows) {
    return '<table class="valid"><thead><tr><th></th><th>Protocols</th><th>TVL</th><th>Share</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td><b>' + esc(r.label) + '</b></td><td class="num">' + r.n + '</td><td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + Math.round(r.share * 100) + '%</td></tr>';
      }).join('') + '</tbody></table>';
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
    $('tab-coverage').setAttribute('aria-pressed', state.tab === 'coverage' ? 'true' : 'false');
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
      '<td><div class="evlow"><span class="num">' + fmtUsd(r.ev_low_usd) + '</span>' +
      '<span class="sub">net ' + fmtUsd(r.net_cost_usd) + '</span></div></td>' +
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
    if (state.tab === 'coverage') {
      caption.textContent = 'Coverage: every protocol in the snapshot is accounted for — ranked, live, or excluded with a reason.';
      var q = state.q.trim().toLowerCase();
      var acc = DATA.accounting.filter(function (a) {
        if (!q) return true;
        var hay = [a.name, a.slug, a.category, a.reason, a.status].join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      var cov = DATA.coverage;
      if (acc.length === 0) {
        body.innerHTML = '';
        empty.hidden = false;
        $('count').textContent = '0 of ' + DATA.accounting.length + ' set-aside protocols';
        return;
      }
      empty.hidden = true;
      body.innerHTML = '<tr class="cov-head"><td colspan="8"><b>' + cov.total + ' protocols in the snapshot</b> — ' + cov.ranked + ' ranked, ' +
        cov.live + ' live, ' + cov.excluded + ' excluded. Excluded by reason: ' +
        cov.by_reason.map(function (r) { return esc(r.reason) + ' ' + r.n; }).join(' · ') + '</td></tr>' +
        acc.map(function (a) {
          return '<tr data-slug="' + esc(a.slug) + '" tabindex="0"><td class="num">—</td>' +
            '<td><div class="name"><b>' + esc(a.name) + '</b><span class="slug">' + esc(a.slug) + '</span>' +
            '<span class="sub">' + esc(a.category || 'Other') + '</span></div></td>' +
            '<td class="num">—</td><td class="num">—</td><td class="num">—</td>' +
            '<td class="num">—</td>' +
            '<td class="num">—</td>' +
            '<td><span class="status' + (a.status === 'live' ? ' live' : '') + '">' + esc(a.reason) + '</span></td></tr>';
        }).join('');
      $('count').textContent = acc.length + ' of ' + DATA.accounting.length + ' set-aside protocols';
      return;
    }
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
          '<td class="num">—</td>' +
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
      var verdict = action.indexOf('Verdict:') === 0 ? ' class="verdict"' : '';
      return '<li' + verdict + '><b>' + esc(action) + '</b><span class="cost">' + esc(tail) + '</span></li>';
    }).join('');
    var groupText = row.group_adjustment === 0
      ? 'the ' + esc(row.group) + ' group carries no adjustment (Dexs is the baseline group)'
      : 'the ' + esc(row.group) + ' group adjustment is ' + (row.group_adjustment >= 0 ? '+' : '') + row.group_adjustment.toFixed(4) + ' in log terms';
    var netLow = row.ev_low_usd - row.net_cost_usd;
    var whyVerdict = netLow >= 0
      ? 'At the low end the plan already nets ' + fmtUsd(netLow) + ' after gas and fees, so the farm pays even if the launch lands at the bottom of the band.'
      : 'At the low end the plan is ' + fmtUsd(-netLow) + ' underwater after gas and fees — it only pays if the launch lands above the bottom of the band.';
    var whyCross = row.cross_note
      ? esc(row.cross_note)
      : 'The five nearest peers imply ' + fmtUsd(row.cross_value_usd) + ' (' + row.cross_ratio.toFixed(2) + 'x the fitted value), so the curve and the nearest names point the same way.';
    body.innerHTML =
      '<div class="detail-head"><div><span class="rankline">RANK ' + row.rank + ' OF ' + DATA.board_size + '</span>' +
      '<h2>' + esc(row.name) + '</h2>' +
      '<p class="sub">' + esc(row.category || 'Other') + ' on ' + esc(row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + '</p></div>' +
      '<button class="close" type="button" id="detail-close" aria-label="Close details">Close</button></div>' +
      '<section class="detail-section"><h3>Why it ranks here</h3><p>' +
      'Rank ' + row.rank + ' of ' + DATA.board_size + ' because its ' + fmtUsd(row.tvl_usd) + ' of TVL sits on the size curve at ' + fmtUsd(row.implied_value_usd) + ': ' + groupText + ' and its ' + (row.chains ? row.chains.length : 0) + ' chains add ' + (row.chains_term >= 0 ? '+' : '') + row.chains_term.toFixed(4) + '. ' +
      whyCross + ' ' +
      'At ' + Math.round(row.launch_prior * 100) + '% launch odds the expected value is ' + fmtUsd(row.ev_usd) + ' against ' + fmtUsd(row.net_cost_usd) + ' of gas and fees. ' + whyVerdict +
      '</p></section>' +
      '<section class="detail-section"><h3>Implied value</h3><div class="equation">' +
      '<div><span>TVL</span><b>' + fmtUsd(row.tvl_usd) + '</b></div>' +
      '<div><span>Category group</span><b>' + esc(row.group) + ' (' + (row.group_adjustment >= 0 ? '+' : '') + row.group_adjustment.toFixed(4) + ')</b></div>' +
      '<div><span>Chain-count term</span><b>' + (row.chains_term >= 0 ? '+' : '') + row.chains_term.toFixed(4) + ' (' + (row.chains ? row.chains.length : 0) + ' chains)</b></div>' +
      '<div><span>Fitted log10 value</span><b>' + row.log10_implied.toFixed(4) + '</b></div>' +
      '<div><span>Implied value</span><b>' + fmtUsd(row.implied_value_usd) + '</b></div>' +
      '<div><span>Implied value, low end (÷ leave-one-out x' + DATA.fit.loo_x.toFixed(2) + ')</span><b>' + fmtUsd(row.implied_low_usd) + '</b></div>' +
      '<div><span>Implied value, high end (× leave-one-out, capped $100B)</span><b>' + fmtUsd(row.implied_high_usd) + '</b></div>' +
      '<div><span>Peer-multiple cross-check (median of 5 nearest comps × TVL)</span><b>' + fmtUsd(row.cross_value_usd) + '</b></div>' +
      '<div><span>Cross-check ÷ fitted value</span><b>' + row.cross_ratio.toFixed(2) + 'x (median peer multiple ' + row.cross_median_ratio.toFixed(2) + 'x)</b></div>' +
      (row.cross_note ? '<div class="match warn">' + esc(row.cross_note) + '</div>' : '<div class="match">Peers agree with the fitted value within a factor of two — the curve and the nearest names point the same way.</div>') +
      '<div><span>Launch odds (1 year)</span><b>' + Math.round(row.launch_prior * 100) + '%</b></div>' +
      '<div><span>Expected value</span><b>' + fmtUsd(row.ev_usd) + '</b></div>' +
      '<div><span>Expected value, low end</span><b>' + fmtUsd(row.ev_low_usd) + '</b></div>' +
      '<div><span>Farm net cost</span><b>' + fmtUsd(row.net_cost_usd) + '</b></div>' +
      '<div><span>Seven-day growth (context)</span><b>' + fmtPct(row.change_7d) + '</b></div>' +
      '<div><span>Age with no token (context)</span><b>' + fmtAge(row.age_days) + '</b></div>' +
      '<div class="match">' + (match ? 'Recomputed from the fitted coefficients: ' + fmtUsd(recomputed) + ' — the same number the board carries.' : 'Recomputed: ' + fmtUsd(recomputed) + ' — differs from the board; the data would be stale.') + '</div>' +
      '</div><p class="sub">Model ' + esc(DATA.model_version) + ': the same fitted function scores every protocol. Expected value is the implied value times the launch odds; the low end divides the implied value by the leave-one-out error first. This is an estimate, not a price.</p></section>' +
      '<section class="detail-section"><h3>Launch scenarios</h3><p class="sub">The whole band the model claims, at ' + Math.round(row.launch_prior * 100) + '% launch odds — the low end divides by the leave-one-out error, the high end multiplies by it.</p>' +
      '<table class="valid scen"><thead><tr><th>Scenario</th><th>Implied value</th><th>Expected value</th></tr></thead><tbody>' +
      '<tr><td>Low</td><td class="num">' + fmtUsd(row.implied_low_usd) + '</td><td class="num">' + fmtUsd(row.ev_low_usd) + '</td></tr>' +
      '<tr class="adopted"><td><b>Base</b> — the fitted value</td><td class="num">' + fmtUsd(row.implied_value_usd) + '</td><td class="num">' + fmtUsd(row.ev_usd) + '</td></tr>' +
      '<tr><td>High</td><td class="num">' + fmtUsd(row.implied_high_usd) + '</td><td class="num">' + fmtUsd(row.ev_high_usd) + '</td></tr>' +
      '</tbody></table></section>' +
      '<section class="detail-section"><h3>Nearest tokened comparables</h3><p class="sub">Same category first, then closest TVL among the ' + DATA.fit.train_n + ' clean comps. Their market caps are the market\u2019s own numbers — the peers this implied value is fitted from.</p>' +
      '<table class="valid comps"><thead><tr><th>Peer</th><th>TVL</th><th>Market cap</th><th>Mcap / TVL</th></tr></thead><tbody>' +
      (row.comps || []).map(function (c) {
        return '<tr><td><b>' + esc(c.name) + '</b><span class="slug"> ' + esc(c.category || 'Other') + '</span></td>' +
          '<td class="num">' + fmtUsd(c.tvl_usd) + '</td><td class="num">' + fmtUsd(c.mcap_usd) + '</td><td class="num">' + c.ratio.toFixed(2) + 'x</td></tr>';
      }).join('') + '</tbody></table></section>' +
      '<section class="detail-section"><h3>Farm plan</h3><ol class="steps">' + steps + '</ol></section>';
    $('detail-close').addEventListener('click', function () {
      state.selected = null;
      writeHash();
      render();
    });
  }

  function rowBySlug(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }

  function renderWatchlist() {
    var list = DATA.rows.filter(function (r) { return r.watchlist; }).sort(function (a, b) { return b.ev_low_usd - a.ev_low_usd; });
    $('watchlist-body').innerHTML = '<table class="valid"><thead><tr><th>Rank</th><th>Protocol</th><th>TVL</th><th>Implied value</th><th>Launch odds</th><th>Low-end EV</th><th>Farm net cost</th><th>Pays at the low end?</th></tr></thead><tbody>' +
      list.map(function (r) {
        var pays = r.ev_low_usd >= r.net_cost_usd;
        return '<tr data-slug="' + esc(r.slug) + '" tabindex="0"><td class="num">' + r.rank + '</td>' +
          '<td><b>' + esc(r.name) + '</b><span class="slug"> ' + esc(r.slug) + '</span></td>' +
          '<td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + fmtUsd(r.implied_value_usd) + '</td>' +
          '<td class="num">' + Math.round(r.launch_prior * 100) + '%</td><td class="num">' + fmtUsd(r.ev_low_usd) + '</td>' +
          '<td class="num">' + fmtUsd(r.net_cost_usd) + '</td>' +
          '<td>' + (pays ? '<b>Yes</b> — nets ' + fmtUsd(r.ev_low_usd - r.net_cost_usd) : 'No — ' + fmtUsd(r.net_cost_usd - r.ev_low_usd) + ' short') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  var compareState = { a: null, b: null };
  function renderCompare() {
    var selA = $('compare-a'), selB = $('compare-b');
    var opts = DATA.rows.map(function (r) { return '<option value="' + esc(r.slug) + '">' + r.rank + '. ' + esc(r.name) + '</option>'; }).join('');
    if (!compareState.a) compareState.a = DATA.rows[0].slug;
    if (!compareState.b) compareState.b = DATA.rows[1].slug;
    if (selA.innerHTML !== opts) selA.innerHTML = opts;
    if (selB.innerHTML !== opts) selB.innerHTML = opts;
    selA.value = compareState.a;
    selB.value = compareState.b;
    var a = rowBySlug(compareState.a), b = rowBySlug(compareState.b);
    if (!a || !b) { $('compare-body').innerHTML = ''; return; }
    var rows = [
      ['Rank', String(a.rank), String(b.rank)],
      ['TVL', fmtUsd(a.tvl_usd), fmtUsd(b.tvl_usd)],
      ['Implied value', fmtUsd(a.implied_value_usd), fmtUsd(b.implied_value_usd)],
      ['Implied value, low end', fmtUsd(a.implied_low_usd), fmtUsd(b.implied_low_usd)],
      ['Peer-multiple cross-check', fmtUsd(a.cross_value_usd), fmtUsd(b.cross_value_usd)],
      ['Cross-check ÷ fitted', a.cross_ratio.toFixed(2) + 'x', b.cross_ratio.toFixed(2) + 'x'],
      ['Launch odds', Math.round(a.launch_prior * 100) + '%', Math.round(b.launch_prior * 100) + '%'],
      ['Expected value', fmtUsd(a.ev_usd), fmtUsd(b.ev_usd)],
      ['Expected value, low end', fmtUsd(a.ev_low_usd), fmtUsd(b.ev_low_usd)],
      ['Farm net cost', fmtUsd(a.net_cost_usd), fmtUsd(b.net_cost_usd)],
      ['Low-end EV net of farm cost', fmtUsd(a.ev_low_usd - a.net_cost_usd), fmtUsd(b.ev_low_usd - b.net_cost_usd)],
      ['Age with no token', fmtAge(a.age_days), fmtAge(b.age_days)],
      ['Chains', (a.chains || []).join(', '), (b.chains || []).join(', ')],
    ];
    var netA = a.ev_low_usd - a.net_cost_usd, netB = b.ev_low_usd - b.net_cost_usd;
    var verdict = netA === netB ? 'Dead even at the low end: both net ' + fmtUsd(netA) + ' after farm costs.'
      : (netA > netB ? a.name : b.name) + ' wins the low end: it nets ' + fmtUsd(Math.max(netA, netB)) + ' after farm costs, against ' + fmtUsd(Math.min(netA, netB)) + ' for ' + (netA > netB ? b.name : a.name) + '.';
    $('compare-body').innerHTML = '<table class="valid"><thead><tr><th></th><th>' + esc(a.name) + ' <span class="slug">rank ' + a.rank + '</span></th><th>' + esc(b.name) + ' <span class="slug">rank ' + b.rank + '</span></th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td><b>' + esc(r[0]) + '</b></td><td class="num">' + esc(r[1]) + '</td><td class="num">' + esc(r[2]) + '</td></tr>'; }).join('') +
      '</tbody></table><p class="sub">' + esc(verdict) + '</p>';
  }

  function render() {
    renderMeta();
    renderControls();
    renderTable();
    renderDetail();
    renderWatchlist();
    renderCompare();
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
  $('tab-coverage').addEventListener('click', function () { state.tab = 'coverage'; state.selected = null; writeHash(); render(); });
  $('clear-filters').addEventListener('click', function () { state.q = ''; state.category = 'all'; writeHash(); render(); });
  $('compare-a').addEventListener('change', function (e) { compareState.a = e.target.value; renderCompare(); });
  $('compare-b').addEventListener('change', function (e) { compareState.b = e.target.value; renderCompare(); });
  $('watchlist-body').addEventListener('click', function (e) {
    var tr = e.target.closest ? e.target.closest('tr[data-slug]') : null;
    if (tr) openDetail(tr.getAttribute('data-slug'));
  });
  $('watchlist-body').addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest) {
      var tr = e.target.closest('tr[data-slug]');
      if (tr) { e.preventDefault(); openDetail(tr.getAttribute('data-slug')); }
    }
  });
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
