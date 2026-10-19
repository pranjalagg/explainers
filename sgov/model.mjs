// SGOV vs a high-yield savings account: the pure model. Everything the figure, readout and chart show comes from here.
// Fund facts as of Oct 16, 2026 (iShares): 30-day SEC yield 3.74%, expense ratio 0.09%, effective duration 0.10 yrs,
// 52-week price range $100.27 to $100.73, last distribution $0.3005 (ex-date Oct 1, 2026), paid monthly.
export const FEE = 0.09;
export const BILLS = 13;
export const TERM = 91;
export const BASE = 100.24;
export const DEFAULTS = { rate: 3.83, apy: 3.75, deposit: 10000, fed: 22, state: 5 };
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const STARTS = MONTH_DAYS.reduce((list, days, i) => (list.push(i ? list[i - 1] + MONTH_DAYS[i - 1] : 0), list), []);
export const YEAR = 365;
export const WEEKS = Math.ceil(YEAR / 7) + 1;
export const DAY_SECONDS = 0.16;

export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

// A T-bill pays $100 at maturity and is sold below that. Its price is the discount the rate implies.
export const billPrice = (rate, days = TERM) => 100 / (1 + (rate / 100) * (days / 365));

export const monthOf = (day) => {
  let m = 0;
  while (m < 11 && day >= STARTS[m + 1]) m++;
  return m;
};

// One bill matures and one is bought every week. A schedule holds the rate each week's new bill was bought at;
// weeks before the year started are bought at the first week's rate.
export function scheduleOf(rate = DEFAULTS.rate) {
  return new Float64Array(WEEKS).fill(rate);
}
export const boughtAt = (schedule, week) => schedule[clamp(week, 0, WEEKS - 1)];

// The 13 bills held on a day, oldest first. age is in weeks since purchase (0 is the newest).
export function ladderOf(schedule, day) {
  const week = Math.floor(day / 7);
  return Array.from({ length: BILLS }, (_, i) => {
    const age = BILLS - 1 - i;
    return { week: week - age, age, rate: boughtAt(schedule, week - age) };
  });
}

export function grossAt(schedule, day) {
  const ladder = ladderOf(schedule, day);
  return ladder.reduce((sum, bill) => sum + bill.rate, 0) / ladder.length;
}
export const netAt = (schedule, day) => Math.max(0, grossAt(schedule, day) - FEE);

// Day-by-day run of both accounts. SGOV: income accrues into the share price each day and is paid out as cash on the
// first of each month, so the price falls back by the payout. HYSA: interest accrues daily and is credited monthly.
export function run(schedule, { apy, deposit }) {
  const shares = deposit / BASE;
  const price = new Float64Array(YEAR + 1);
  const paid = new Float64Array(YEAR + 1);
  const net = new Float64Array(YEAR + 1);
  const bank = new Float64Array(YEAR + 1);
  const pending = new Float64Array(YEAR + 1);
  const payouts = [];
  const credits = [];
  const daily = Math.pow(1 + apy / 100, 1 / 365) - 1;
  let accrued = 0, cash = 0, balance = deposit, owed = 0;
  for (let d = 0; d <= YEAR; d++) {
    if (d > 0 && STARTS.includes(d % YEAR) || d === YEAR) {
      payouts.push({ day: d, perShare: accrued, total: accrued * shares });
      cash += accrued * shares;
      accrued = 0;
      credits.push({ day: d, total: owed });
      balance += owed;
      owed = 0;
    }
    price[d] = BASE + accrued;
    paid[d] = cash;
    net[d] = netAt(schedule, Math.min(d, YEAR - 1));
    bank[d] = balance;
    pending[d] = owed;
    if (d < YEAR) {
      accrued += (BASE * net[d]) / 100 / 365;
      owed += (balance + owed) * daily;
    }
  }
  return { shares, price, paid, net, bank, pending, payouts, credits };
}

const lerp = (arr, t) => {
  const i = Math.floor(clamp(t, 0, YEAR));
  const f = clamp(t, 0, YEAR) - i;
  return i >= YEAR ? arr[YEAR] : arr[i] + (arr[i + 1] - arr[i]) * f;
};

// Everything shown at time t (days, fractional) within the year.
export function stateAt(sim, schedule, t, opts) {
  const day = clamp(t, 0, YEAR - 1e-6);
  const d = Math.floor(day);
  const month = monthOf(d);
  const start = STARTS[month];
  // The price jumps down at the ex-date; interpolating across it would draw a slope, so hold the last day's step.
  const price = d + 1 < YEAR && STARTS.includes(d + 1) ? sim.price[d] + (sim.price[d] - sim.price[Math.max(0, d - 1)]) * (day - d) : lerp(sim.price, day);
  const accrued = price - BASE;
  const net = sim.net[d];
  const sgovValue = sim.shares * price + sim.paid[d];
  const bankValue = lerp(sim.bank, day) + lerp(sim.pending, day);
  const paidCount = sim.payouts.filter((p) => p.day <= d).length;
  const nextPay = sim.payouts.find((p) => p.day > d) || sim.payouts[sim.payouts.length - 1];
  const fed = opts.fed / 100, state = opts.state / 100;
  const sgovAfter = net * (1 - fed);
  const bankAfter = opts.apy * (1 - fed - state);
  return {
    day, month, start, price, accrued, net, gross: grossAt(schedule, d),
    sgovValue, bankValue, paidCount, nextPay, sgovAfter, bankAfter,
    // Tax-equivalent: the bank APY that would match SGOV after both taxes.
    breakEven: sgovAfter / (1 - fed - state),
    week: day / 7,
    ladder: ladderOf(schedule, d),
    monthly: (sim.shares * BASE * net) / 100 / 12,
  };
}

export const money = (v, digits = 2) => `$${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const pct = (v, digits = 2) => `${v.toFixed(digits)}%`;
