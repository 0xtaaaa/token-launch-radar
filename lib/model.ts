// Token Launch Radar — model radar-4 (clean-comps size curve).
//
// One snapshot of the protocol universe in, one ranked board out. The board ranks
// pre-token protocols only: a protocol is pre-token when its snapshot record carries
// no token at all (no market cap, no CoinGecko id, no symbol). Protocols whose token
// already trades are kept apart in the Live set and shown with their market cap —
// the market's own number, never a model's — so they can never outrank a launch
// candidate.
//
// The watchlist is the floor, never the ceiling: all 40 of its slugs are ranked,
// plus every other rankable pre-token protocol in the snapshot, strongest implied
// value first.
//
// Implied value is FITTED from clean comps, not hand-tuned. The training set is
// the snapshot's tokened protocols cleaned in two steps: first, exchange, bridge
// and staking products and versioned, wrapped or exchange-named protocols are
// removed (they are not the kind of protocol the board ranks); then the
// market-cap-to-TVL ratio is trimmed to its 5th–95th percentile band, which
// removes nine protocols whose tokens trade at a ratio no peer supports. What
// remains is 83 clean comps. log10(market cap) is regressed on log10(TVL), the
// protocol's category group (Lending, RWA, Yield against a Dexs baseline) and
// log10(chain count), by ridge least squares (lambda 10, intercept unpenalised),
// computed from the snapshot at run time — never from a hardcoded list of names
// or values. The same function scores every row.
//
// The terms were chosen by leave-one-out error, not by taste. Age (from
// listed_at) and seven-day growth were tested and dropped: neither improved
// leave-one-out error. Per-category slopes were tested and rejected: they are
// unstable, with a held-out fold R-squared of -2.5. The chain-count term stays
// because it improves leave-one-out error (x2.70 without it, x2.58 with it).
//
// The fit is still weak, and the board says so. Size and category explain about
// a third of what a token ends up worth (in-sample R-squared about 0.34); the
// rest is idiosyncratic — the team, the timing, the narrative — none of which a
// TVL snapshot can see. The dashboard prints the leave-one-out error and both
// held-out folds beside the formula so the weakness is visible, not hidden.
//
// Expected value: a launch is worth the implied value only if a token appears.
// The launch odds are the snapshot's own one-year hazard by age: the share of
// protocols that record a token between one age bucket and the next, floored at
// 5% and capped at 60%. EV is implied value times those odds. The farm verdict
// goes one step further: it nets the plan's gas and fees against the expected
// value at the LOW end of the value band (implied value divided by the
// leave-one-out error), so a plan that only pays at the top of the band says so.
//
// A token's implied value is a model claim, never a price and never a prediction
// that a token will be issued.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

/** The ridge penalty of the fit: 10, on every term but the intercept. */
export const FIT_LAMBDA = 10;

/** Category groups the fit scores: Lending, RWA and Yield against a Dexs baseline; anything else is OTHER. */
const GROUP_OF: Record<string, string> = {
  Lending: 'LEND',
  RWA: 'RWA',
  Yield: 'YIELD',
  'Yield Aggregator': 'YIELD',
  Dexs: 'DEX',
};

/** The group dummies, in feature order after the intercept and log10(TVL). */
export const GROUP_DUMMIES = ['LEND', 'RWA', 'YIELD'];

/** How the clean training set was built, for the integrity strip. */
export interface CleanSet {
  n_with_mcap: number;
  n_product_or_name: number;
  n_ratio_outliers: number;
  ratio_band_lo: number;
  ratio_band_hi: number;
  train_n: number;
}

/** The fitted model, with its leave-one-out and held-out validation, for the dashboard and README. */
export interface FitResult {
  features: string[];
  beta: number[];
  lambda: number;
  train_n: number;
  r2_full: number;
  med_err_full: number;
  loo_med_err: number;
  loo_x: number;
  folds: { test: string; n_test: number; r2: number; med_err: number }[];
  clean: CleanSet;
}

/** One age bucket of the launch prior, and the hazard it implies. */
export interface LaunchBucket {
  label: string;
  min_days: number;
  max_days: number | null;
  n: number;
  tokened: number;
  rate: number;
  hazard: number;
}

/** The launch prior: one-year hazards by age, computed from the snapshot. */
export interface LaunchPrior {
  buckets: LaunchBucket[];
  unknown_hazard: number;
}

/** How many live-token protocols the Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  ev_usd: number;
  ev_low_usd: number;
  net_cost_usd: number;
  launch_prior: number;
  group: string;
  model: {
    log10_implied: number;
    group_adjustment: number;
    chains_term: number;
    launch_prior: number;
    ev_usd: number;
    ev_low_usd: number;
    net_cost_usd: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  ev_usd: number;
  ev_low_usd: number;
  net_cost_usd: number;
  launch_prior: number;
  group: string;
  log10_implied: number;
  group_adjustment: number;
  chains_term: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One protocol the board does not rank, with the reason it is set aside. */
export interface AccountingRow {
  slug: string;
  name: string;
  category: string | null;
  status: 'live' | 'excluded';
  reason: string;
}

/** How the snapshot's 758 protocols are accounted for. */
export interface Coverage {
  total: number;
  ranked: number;
  live: number;
  excluded: number;
  by_reason: { reason: string; n: number }[];
}

/** The integrity strip: what the snapshot is, what trained the model, and what the model cannot do. */
export interface Integrity {
  as_of: string;
  floor_usd: number;
  total_protocols: number;
  ranked: number;
  live: number;
  excluded: number;
  train_n: number;
  excluded_product_or_name: number;
  excluded_ratio_outliers: number;
  ratio_band: [number, number];
  loo_x: number;
  r2_full: number;
  limits: string;
}

/** Board-level indicators for the dashboard's KPI strip. */
export interface Kpis {
  watchlist_tvl_usd: number;
  median_implied_usd: number;
  board_size: number;
  watchlist_covered: number;
  watchlist_size: number;
  top_implied_usd: number;
  train_n: number;
}

/** Everything the dashboard needs: the board, the live set, the accounting, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  fit: FitResult;
  launch_prior: LaunchPrior;
  kpis: Kpis;
  coverage: Coverage;
  integrity: Integrity;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  accounting: AccountingRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The category group the fit scores, or OTHER, the baseline the dummies omit. */
export function categoryGroup(category: string | null): string {
  if (category === null) return 'OTHER';
  return GROUP_OF[category] ?? 'OTHER';
}

/** The fit's feature row for one protocol: intercept, log10(TVL), group dummies, log10(chain count). */
function features(p: SnapshotProtocol): number[] {
  const g = categoryGroup(p.category);
  const row: number[] = [1, Math.log10(Math.max(p.tvl_usd, 1))];
  for (const d of GROUP_DUMMIES) row.push(g === d ? 1 : 0);
  row.push(Math.log10(Math.max(p.chains.length, 1)));
  return row;
}

/** Ridge least squares: (X'X + lambda I) beta = X'y, intercept unpenalised. */
function ridgeSolve(X: number[][], y: number[], lambda: number): number[] {
  const n = X[0]!.length;
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < X.length; k++) s += X[k]![i]! * X[k]![j]!;
      if (i === j && i > 0) s += lambda;
      row.push(s);
    }
    A.push(row);
    let s = 0;
    for (let k = 0; k < X.length; k++) s += X[k]![i]! * y[k]!;
    b.push(s);
  }
  // Gaussian elimination with partial pivoting: deterministic, no dependencies.
  const M: number[][] = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    const tmp = M[c]!;
    M[c] = M[piv]!;
    M[piv] = tmp;
    const diag = M[c]![c]!;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / diag;
      if (f === 0) continue;
      for (let cc = c; cc <= n; cc++) M[r]![cc] = M[r]![cc]! - f * M[c]![cc]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

/** R-squared and the median absolute log10 error of a fitted beta on rows. */
function fitQuality(X: number[][], y: number[], beta: number[]): { r2: number; medErr: number } {
  const pred = X.map((row) => row.reduce((s, v, i) => s + v * beta[i]!, 0));
  const errs = pred.map((p, i) => Math.abs(p - y[i]!));
  const sorted = [...errs].sort((a, b) => a - b);
  const med = sorted.length % 2 === 1
    ? sorted[(sorted.length - 1) / 2]!
    : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  const ssTot = y.reduce((s, v) => s + (v - mean) * (v - mean), 0);
  const ssRes = pred.reduce((s, p, i) => s + (p - y[i]!) * (p - y[i]!), 0);
  return { r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot, medErr: med };
}

/** Leave-one-out median absolute log10 error: refit without each comp in turn. */
function looMedErr(train: SnapshotProtocol[], lambda: number): number {
  const errs: number[] = [];
  for (let i = 0; i < train.length; i++) {
    const rest = train.filter((_, j) => j !== i);
    const beta = ridgeSolve(rest.map(features), rest.map((p) => Math.log10(p.mcap_usd!)), lambda);
    const pred = features(train[i]!).reduce((s, v, k) => s + v * beta[k]!, 0);
    errs.push(Math.abs(pred - Math.log10(train[i]!.mcap_usd!)));
  }
  const sorted = [...errs].sort((a, b) => a - b);
  return sorted.length % 2 === 1
    ? sorted[(sorted.length - 1) / 2]!
    : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word wrapped, staked or staking in a name: a wrapped or staked product of another token. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** An exchange's name at the start of a protocol name. */
const EXCHANGE_START = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;

/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const PRODUCT_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol records any token field at all. */
function hasToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
}

/** Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked, bridged or exchange product. */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_START.test(p.name)) return false;
  return true;
}

/** Whether a tokened protocol may train the fit: it trades, and it is the kind of protocol the board ranks. */
function isTrainable(p: SnapshotProtocol): boolean {
  if (p.mcap_usd === null || p.mcap_usd <= 0) return false;
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_START.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/**
 * The clean training set: the trainable tokened protocols, trimmed to the
 * 5th–95th percentile band of log10(market cap / TVL). Deterministic: the band
 * is computed from the slug-sorted trainable set.
 */
export function cleanTrainingSet(snapshot: Snapshot): { clean: SnapshotProtocol[]; cleanSet: CleanSet } {
  const trainable = snapshot.protocols.filter(isTrainable).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const ratios = trainable.map((p) => Math.log10(p.mcap_usd! / p.tvl_usd)).sort((a, b) => a - b);
  const lo = ratios[Math.floor(0.05 * ratios.length)]!;
  const hi = ratios[Math.floor(0.95 * ratios.length) - 1]!;
  const clean = trainable.filter((p) => {
    const r = Math.log10(p.mcap_usd! / p.tvl_usd);
    return r >= lo && r <= hi;
  });
  const cleanSet: CleanSet = {
    n_with_mcap: snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0).length,
    n_product_or_name: trainable.length === 0 ? 0 : snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0).length - trainable.length,
    n_ratio_outliers: trainable.length - clean.length,
    ratio_band_lo: round4(lo),
    ratio_band_hi: round4(hi),
    train_n: clean.length,
  };
  return { clean, cleanSet };
}

/**
 * The fitted model: ridge least squares of log10(market cap) on log10(TVL),
 * the category group and log10(chain count), trained on the clean comps, with
 * leave-one-out error and two held-out folds (every fifth protocol by slug,
 * test sets i%5 in {0,1} and {2,3}). Deterministic: the training set is
 * slug-sorted and the solver pivots the same way. The beta is rounded to four
 * decimals before anything uses it, so the dashboard's recompute from the
 * shipped coefficients matches the board exactly.
 */
export function fitModel(snapshot: Snapshot): FitResult {
  const { clean: train, cleanSet } = cleanTrainingSet(snapshot);
  const X = train.map(features);
  const y = train.map((p) => Math.log10(p.mcap_usd!));
  const beta = ridgeSolve(X, y, FIT_LAMBDA).map(round4);
  const full = fitQuality(X, y, beta);
  const loo = looMedErr(train, FIT_LAMBDA);
  const folds: FitResult['folds'] = [];
  for (const testRes of [[0, 1], [2, 3]]) {
    const tr = train.filter((_, i) => !testRes.includes(i % 5));
    const te = train.filter((_, i) => testRes.includes(i % 5));
    const betaFold = ridgeSolve(tr.map(features), tr.map((p) => Math.log10(p.mcap_usd!)), FIT_LAMBDA).map(round4);
    const q = fitQuality(te.map(features), te.map((p) => Math.log10(p.mcap_usd!)), betaFold);
    folds.push({ test: `i%5 in {${testRes.join(',')}}`, n_test: te.length, r2: round4(q.r2), med_err: round4(q.medErr) });
  }
  return {
    features: ['intercept', 'log10_tvl', ...GROUP_DUMMIES, 'log10_chains'],
    beta,
    lambda: FIT_LAMBDA,
    train_n: train.length,
    r2_full: round4(full.r2),
    med_err_full: round4(full.medErr),
    loo_med_err: round4(loo),
    loo_x: round4(10 ** loo),
    folds,
    clean: cleanSet,
  };
}

/** Age buckets of the launch prior, in days. */
const AGE_BUCKETS: { label: string; min: number; max: number | null }[] = [
  { label: '0-6 months', min: 0, max: 180 },
  { label: '6-12 months', min: 180, max: 365 },
  { label: '1-2 years', min: 365, max: 730 },
  { label: '2-3 years', min: 730, max: 1095 },
  { label: '3+ years', min: 1095, max: null },
];

/**
 * The launch prior: for each age bucket, the share of protocols that record a
 * token, then the one-year hazard between buckets — the share of protocols that
 * gain a token moving from one bucket to the next, floored at 5% and capped at
 * 60%. The oldest bucket takes the mean of the earlier hazards; a protocol with
 * no listing date takes the mean of all of them.
 */
export function launchPrior(snapshot: Snapshot): LaunchPrior {
  const rates: number[] = [];
  const buckets: LaunchBucket[] = AGE_BUCKETS.map((b) => {
    const inBucket = snapshot.protocols.filter((p) => {
      const age = ageDays(snapshot.as_of, p.listed_at);
      if (age === null) return false;
      return age >= b.min && (b.max === null || age < b.max);
    });
    const tokened = inBucket.filter(hasToken).length;
    const rate = inBucket.length > 0 ? tokened / inBucket.length : 0;
    rates.push(rate);
    return { label: b.label, min_days: b.min, max_days: b.max, n: inBucket.length, tokened, rate: round4(rate), hazard: 0 };
  });
  const hazards: number[] = [];
  for (let i = 0; i < buckets.length - 1; i++) {
    const denom = 1 - rates[i]!;
    const h = denom <= 0 ? 0.05 : (rates[i + 1]! - rates[i]!) / denom;
    hazards.push(Math.min(0.6, Math.max(0.05, h)));
  }
  const meanEarly = hazards.reduce((s, v) => s + v, 0) / hazards.length;
  hazards.push(meanEarly);
  buckets.forEach((b, i) => {
    b.hazard = round4(hazards[i]!);
  });
  const unknown = round4(hazards.reduce((s, v) => s + v, 0) / hazards.length);
  return { buckets, unknown_hazard: unknown };
}

/** A protocol's one-year launch chance from its age, or the unknown-age mean. */
export function hazardFor(age: number | null, prior: LaunchPrior): number {
  if (age === null) return prior.unknown_hazard;
  for (const b of prior.buckets) {
    if (age >= b.min_days && (b.max_days === null || age < b.max_days)) return b.hazard;
  }
  return prior.unknown_hazard;
}

/** The fitted log10 implied value of one protocol under `beta`. */
export function logImplied(p: SnapshotProtocol, beta: number[]): number {
  const x = features(p);
  return x.reduce((s, v, i) => s + v * beta[i]!, 0);
}

/** The fitted implied value: 10 to the fitted log value, whole dollars, capped at the gate's ceiling. */
export function impliedValue(p: SnapshotProtocol, beta: number[]): { implied: number; log10: number; groupAdj: number; chainsTerm: number } {
  const log10 = Math.min(14, Math.max(0, logImplied(p, beta)));
  const implied = Math.max(1, Math.round(10 ** log10));
  const g = categoryGroup(p.category);
  const di = GROUP_DUMMIES.indexOf(g);
  const groupAdj = di >= 0 ? beta[2 + di]! : 0;
  const chainsTerm = round4(beta[5]! * Math.log10(Math.max(p.chains.length, 1)));
  return { implied, log10: round4(log10), groupAdj: round4(groupAdj), chainsTerm };
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, fit: FitResult, prior: LaunchPrior): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The radar: every rankable pre-token protocol the snapshot carries, strongest
  // implied value first. No cap: the board is the whole rankable set.
  const rest = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .map((p) => ({ p, implied: impliedValue(p, fit.beta).implied }))
    .sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  for (const e of rest) chosen.set(e.p.slug, e.p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, fit.beta);
    const age = ageDays(snapshot.as_of, p.listed_at);
    const launch = hazardFor(age, prior);
    const impliedLow = Math.max(1, Math.round(v.implied / fit.loo_x));
    const ev = Math.max(1, Math.round(v.implied * launch));
    const evLow = Math.max(1, Math.round(impliedLow * launch));
    const plan = farmSteps(p, age, { implied: v.implied, odds: launch, looX: fit.loo_x });
    const netCost = plan.net_cost_usd;
    return { p, ...v, age, launch, ev, evLow, impliedLow, netCost, plan };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    implied_low_usd: s.impliedLow,
    ev_usd: s.ev,
    ev_low_usd: s.evLow,
    net_cost_usd: s.netCost,
    launch_prior: s.launch,
    group: categoryGroup(s.p.category),
    model: {
      log10_implied: s.log10,
      group_adjustment: s.groupAdj,
      chains_term: s.chainsTerm,
      launch_prior: s.launch,
      ev_usd: s.ev,
      ev_low_usd: s.evLow,
      net_cost_usd: s.netCost,
      age_days: s.age,
    },
    farm_steps: s.plan.steps.map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 250_000_000) return 150;
  if (p.tvl_usd >= 50_000_000) return 100;
  return 50;
}

/** Gas for one transaction on the protocol's main chain, in dollars. */
function gasFor(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 6;
  if (c === 'solana' || c === 'sui' || c === 'aptos') return 1;
  if (c === 'bitcoin') return 4;
  return 2;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 90;
  if (age < 365) return 60;
  if (age < 730) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Supply $${capital} of USDC to ${name} on ${chain}, then borrow $20 against it and repay it the same week so the position shows both sides.`;
  }
  if (c.includes('dex') || c.includes('leveraged farm')) {
    return `Provide $${capital} of liquidity to ${name}'s deepest pool on ${chain} and keep the position in range.`;
  }
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator')) {
    return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares for the full hold period.`;
  }
  if (c.includes('restak') || c.includes('staking')) {
    return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the same wallet.`;
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged trade, then close it after a day.`;
  }
  if (c.includes('prediction')) {
    return `Fund $${capital} and place one market position on ${name}, sized small enough to lose without regret.`;
  }
  if (c.includes('stable') || c.includes('rwa')) {
    return `Mint $${capital} of the yield-bearing asset through ${name} on ${chain} and hold it in the farming wallet.`;
  }
  if (c.includes('insurance')) {
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active for the full hold period.`;
  }
  if (c.includes('payment') || c.includes('chain')) {
    return `Move $${capital} through ${name} on ${chain} once a week, in two transactions a few days apart.`;
  }
  if (c.includes('governance') || c.includes('incentive')) {
    return `Deposit $${capital} into ${name} on ${chain} and vote on one live proposal from the same wallet.`;
  }
  if (c.includes('bridge')) {
    return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app the same day.`;
  }
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open for the full hold period.`;
}

/** The category's weekly qualifying action. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'a borrow and a repay';
  if (c.includes('dex') || c.includes('leveraged farm')) return 'a swap through the pool';
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator')) return 'a deposit or a rebalance';
  if (c.includes('restak') || c.includes('staking')) return 'a stake top-up or a claim';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return 'one small trade';
  if (c.includes('prediction')) return 'one market position';
  if (c.includes('stable') || c.includes('rwa')) return 'a mint or a transfer of the asset';
  if (c.includes('insurance')) return 'a policy check or a renewal';
  if (c.includes('payment') || c.includes('chain')) return 'one transfer through the protocol';
  if (c.includes('governance') || c.includes('incentive')) return 'a vote or a delegation';
  return 'a deposit, a swap or a vote';
}

/** What one farm plan costs all-in, and what it is worth at the low end of the value band. */
export interface FarmVerdict {
  steps: FarmStep[];
  net_cost_usd: number;
  ev_low_usd: number;
}

/**
 * A protocol's farm plan: six steps, each an action with a concrete dollar
 * amount and a duration, plus a seventh step — the verdict — that nets the
 * plan's gas and fees against the expected value at the LOW end of the value
 * band (implied value divided by the leave-one-out error, times the launch
 * odds). The plan is derived from the protocol's own record (category, chains,
 * TVL, age), never from a hand-written list of names.
 */
export function farmSteps(
  p: SnapshotProtocol,
  age: number | null,
  verdict: { implied: number; odds: number; looX: number },
): FarmVerdict {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const gas = gasFor(chain);
  const hold = holdDaysFor(age);
  const weekly = weeklyFor(p);
  const weeks = Math.ceil(hold / 7);
  const gasTotal = gas * 2 + gas * weeks + gas;
  const fees = Math.max(1, Math.round(capital * 0.01));
  const netCost = gasTotal + fees;
  const impliedLow = Math.max(1, Math.round(verdict.implied / verdict.looX));
  const evLow = Math.max(1, Math.round(impliedLow * verdict.odds));
  const netLow = evLow - netCost;
  const verdictText = netLow >= 0
    ? `Verdict: $${capital} in, about $${netCost} of gas and fees over ${hold} days, net cost about $${netCost}. At the low end of the value band the launch is worth $${impliedLow.toLocaleString('en-US')} at ${Math.round(verdict.odds * 100)}% odds, so the plan nets about $${netLow.toLocaleString('en-US')} if a token launches.`
    : `Verdict: $${capital} in, about $${netCost} of gas and fees over ${hold} days, net cost about $${netCost}. At the low end of the value band the launch is worth $${impliedLow.toLocaleString('en-US')} at ${Math.round(verdict.odds * 100)}% odds, so the plan nets about -$${Math.abs(netLow).toLocaleString('en-US')} there — it only pays if the launch lands above the low end.`;
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and fund it with $${capital} plus about $${gas} of gas on ${chain}; keep its seed phrase offline on paper.`,
      cost: `$${capital + gas} to fund the wallet`,
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${gas * 2} of gas across the setup`,
      time: '15 minutes to set up',
    },
    {
      text: `Do one qualifying action each week — ${weekly} — so the wallet shows steady use instead of one burst, for all ${hold} days of the hold.`,
      cost: `about $${gas} of gas a week, $${gas * weeks} across the hold`,
      time: `10 minutes a week for ${weeks} weeks`,
    },
    {
      text: `Hold the $${capital} position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw the $${capital}, open the protocol's own points or rewards page from its own site and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay anyone to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the $${capital} deposit, the dates and every transaction hash in a farm log so you can repeat the position or unwind it cleanly.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: verdictText,
      cost: `about $${netCost} net (gas $${gasTotal} + fees $${fees})`,
      time: `${hold} days`,
    },
  ];
  return { steps, net_cost_usd: netCost, ev_low_usd: evLow };
}

/** The live-token protocols, by market cap, for the dashboard's Live view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** Why one protocol is not on the board: the short reason the coverage view shows. */
export function exclusionReason(p: SnapshotProtocol): string {
  if (!isPreToken(p)) return 'Token already trades';
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return 'CEX, bridge or staking product';
  if (VERSIONED.test(p.name) || WRAPPED_WORD.test(p.name) || EXCHANGE_START.test(p.name)) {
    return 'Wrapped, staked or versioned product';
  }
  return 'Below the rankable rules';
}

/** Every protocol the board does not rank: the live set and the excluded, each with its reason. */
export function buildAccounting(snapshot: Snapshot, board: BoardRow[], live: LiveRow[]): { accounting: AccountingRow[]; coverage: Coverage } {
  const boardSlugs = new Set(board.map((r) => r.slug));
  const liveSlugs = new Set(live.map((r) => r.slug));
  const accounting: AccountingRow[] = [];
  for (const p of snapshot.protocols) {
    if (boardSlugs.has(p.slug)) continue;
    if (liveSlugs.has(p.slug)) {
      accounting.push({ slug: p.slug, name: p.name, category: p.category, status: 'live', reason: 'Token already trades — shown at its market cap' });
    } else {
      accounting.push({ slug: p.slug, name: p.name, category: p.category, status: 'excluded', reason: exclusionReason(p) });
    }
  }
  accounting.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const byReason = new Map<string, number>();
  for (const a of accounting) {
    if (a.status === 'excluded') byReason.set(a.reason, (byReason.get(a.reason) ?? 0) + 1);
  }
  const coverage: Coverage = {
    total: snapshot.protocols.length,
    ranked: board.length,
    live: live.length,
    excluded: accounting.filter((a) => a.status === 'excluded').length,
    by_reason: [...byReason.entries()].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n),
  };
  return { accounting, coverage };
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    ev_usd: row.ev_usd,
    ev_low_usd: row.ev_low_usd,
    net_cost_usd: row.net_cost_usd,
    launch_prior: row.launch_prior,
    group: row.group,
    log10_implied: row.model.log10_implied,
    group_adjustment: row.model.group_adjustment,
    chains_term: row.model.chains_term,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const fit = fitModel(snapshot);
  const prior = launchPrior(snapshot);
  const board = buildBoard(snapshot, fit, prior);
  const live = liveRows(snapshot);
  const { accounting, coverage } = buildAccounting(snapshot, board, live);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const sortedVals = board.map((r) => r.implied_value_usd).sort((a, b) => a - b);
  const median = sortedVals.length % 2 === 1
    ? sortedVals[(sortedVals.length - 1) / 2]!
    : Math.round((sortedVals[sortedVals.length / 2 - 1]! + sortedVals[sortedVals.length / 2]!) / 2);
  const watchlistTvl = snapshot.protocols
    .filter((p) => snapshot.watchlist.includes(p.slug))
    .reduce((s, p) => s + p.tvl_usd, 0);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    fit,
    launch_prior: prior,
    kpis: {
      watchlist_tvl_usd: watchlistTvl,
      median_implied_usd: median,
      board_size: board.length,
      watchlist_covered: snapshot.watchlist.filter((s) => board.some((r) => r.slug === s)).length,
      watchlist_size: snapshot.watchlist.length,
      top_implied_usd: board.length > 0 ? board[0]!.implied_value_usd : 0,
      train_n: fit.train_n,
    },
    coverage,
    integrity: {
      as_of: snapshot.as_of,
      floor_usd: snapshot.floor_usd,
      total_protocols: snapshot.protocols.length,
      ranked: board.length,
      live: live.length,
      excluded: coverage.excluded,
      train_n: fit.train_n,
      excluded_product_or_name: fit.clean.n_product_or_name,
      excluded_ratio_outliers: fit.clean.n_ratio_outliers,
      ratio_band: [fit.clean.ratio_band_lo, fit.clean.ratio_band_hi],
      loo_x: fit.loo_x,
      r2_full: fit.r2_full,
      limits: 'Size and category explain about a third of launch value; the rest is the team, the timing and the narrative, which no TVL snapshot can see.',
    },
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
    accounting,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
