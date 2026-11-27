// End-to-end: the real cloud-sync module against an in-memory Supabase.
//
// Reported: "whenever I feed payment details or update anything, after a few
// days when I log in those details are wiped and I have to enter everything
// again, just to vanish after some time."
//
// Each scenario runs the shipped 20-cloud-sync.js unchanged, with fetch, timers
// and localStorage faked, across a simulated app restart.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', '20-cloud-sync.js'), 'utf8');

let fails = 0;
function chk(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label +
    (ok ? '' : '\n        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want)));
}

// ---------------------------------------------------------------- fake cloud
function makeCloud() {
  let tick = 0;
  const ts = () => new Date(Date.UTC(2026, 10, 1, 0, 0, ++tick)).toISOString();
  const rows = {};
  const cloud = { rows, netDown: false, signIns: 0 };
  const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  cloud.put = (id, data, by) => { rows[id] = { id, data: JSON.parse(JSON.stringify(data)), deleted: false, updated_at: ts(), updated_by: by }; };
  cloud.fetch = async (url, opts) => {
    opts = opts || {};
    if (cloud.netDown) throw new TypeError('Failed to fetch');
    const u = new URL(url);
    if (u.pathname.endsWith('/auth/v1/token')) {
      if (u.searchParams.get('grant_type') === 'password') cloud.signIns++;
      return res(200, { access_token: 'tok' + tick, refresh_token: 'ref' + tick, expires_in: 3600 });
    }
    const table = u.pathname.split('/').pop();
    const method = (opts.method || 'GET').toUpperCase();
    if (table === 'loans') {
      if (method === 'POST') {
        JSON.parse(opts.body).forEach((r) => {
          rows[r.id] = { id: r.id, data: JSON.parse(JSON.stringify(r.data)), deleted: !!r.deleted, updated_at: ts(), updated_by: r.updated_by };
        });
        return res(201, null);
      }
      let list = Object.values(rows);
      for (const [k, v] of u.searchParams) {
        if (k === 'id' && v.startsWith('eq.')) list = list.filter((r) => r.id === v.slice(3));
        if (k === 'updated_by' && v.startsWith('neq.')) list = list.filter((r) => r.updated_by !== v.slice(4));
        if (k === 'updated_at' && v.startsWith('gt.')) list = list.filter((r) => r.updated_at > v.slice(3));
      }
      list.sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1));
      return res(200, JSON.parse(JSON.stringify(list)));
    }
    if (method === 'GET') return res(200, []);
    return res(201, null);
  };
  return cloud;
}

// ---------------------------------------------------------------- one app run
function startApp(cloud, store, deviceStoreSession) {
  let now = 0;
  const timers = [];
  const el = () => ({ style: {}, textContent: '', value: '', disabled: false, setAttribute() {}, querySelector() { return null; },
    addEventListener() {}, remove() {}, appendChild() {} });
  const app = { signInShown: 0 };
  const ctx = {
    console, JSON, Object, Array, String, Number, Math, Date, Promise, Error, TypeError, URL, encodeURIComponent,
    TextEncoder, TextDecoder, crypto: globalThis.crypto, btoa, atob, Uint8Array,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    setTimeout: (fn, ms) => { const t = { fn, at: now + (ms || 0), id: timers.length + 1 }; timers.push(t); return t.id; },
    clearTimeout: (id) => { const t = timers.find((x) => x.id === id); if (t) t.done = true; },
    setInterval: () => 99, clearInterval: () => {},
    fetch: (u, o) => cloud.fetch(u, o),
    document: {
      readyState: 'complete',
      getElementById: (id) => (id === 'cloudSignIn' ? null : el()),
      createElement: () => el(),
      body: { appendChild: () => { app.signInShown++; } },
    },
    toast() {}, logAudit() {}, confirm: () => true, prompt: () => null,
    todayISO: () => '2026-11-27',
    loans: JSON.parse(store.shivam_loans_v1 || '[]'),
    STORE: 'shivam_loans_v1',
  };
  ctx.window = ctx;
  ctx.CLOUD = { enabled: true, url: 'https://x.supabase.co', key: 'anon', pollMs: 7000, encryptIds: false };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const flush = async () => { for (let i = 0; i < 60; i++) await new Promise((r) => setImmediate(r)); };
  app.ctx = ctx;
  app.advance = async (ms) => {
    const end = now + ms;
    for (;;) {
      const due = timers.filter((t) => !t.done && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at; due.done = true; due.fn(); await flush();
    }
    now = end; await flush();
  };
  app.save = async () => {            // what the app's save() does for sync
    store.shivam_loans_v1 = JSON.stringify(ctx.loans);
    ctx.cloudPush(ctx.loans);
    await app.advance(700);
  };
  app.poll = async () => { ctx.cloudPullNow(); await flush(); };
  app.loan = (id) => ctx.loans.find((l) => l.id === id);
  return app;
}

const pay = (n) => ({ date: '2026-11-' + String(n).padStart(2, '0'), amount: 5000 });
const seed = () => ([
  { id: 'L1', acno: '16289', name: 'Borrower One', payments: [pay(1)] },
  { id: 'L2', acno: '16290', name: 'Borrower Two', payments: [pay(1)] },
]);
const signedIn = () => JSON.stringify({ access_token: 'old', refresh_token: 'r0', expires_at: 0 }); // expired: must refresh

// ============ 1. the reported case: payment entered while the refresh could not reach the server
(async () => {
  {
    const cloud = makeCloud(), store = {};
    store.shivam_device_id = 'dev_office';
    store.shivam_loans_v1 = JSON.stringify(seed());
    store.shivam_cloud_sess = signedIn();
    seed().forEach((l) => cloud.put(l.id, l, 'dev_office'));

    // day 1: app opened, synced, then the laptop sleeps; on waking the token is renewed while Wi-Fi is still down
    let app = startApp(cloud, store);
    await app.advance(1000);
    store.shivam_cloud_sess = signedIn();                      // token has expired overnight
    app = startApp(cloud, store); cloud.netDown = true;
    await app.advance(1000);
    chk('a refresh that cannot reach the server does not sign this computer out', !!store.shivam_cloud_sess, true);
    cloud.netDown = false;

    // the owner records a payment (it may or may not upload at once)
    app.loan('L1').payments.push(pay(5));
    cloud.netDown = true; await app.save(); cloud.netDown = false;

    // a few days later: app opened again; if it had been signed out, he signs in
    if (!store.shivam_cloud_sess) store.shivam_cloud_sess = signedIn();
    app = startApp(cloud, store);
    await app.advance(1000);
    chk('after the restart the payment is still on screen', app.loan('L1').payments.length, 2);
    await app.poll(); await app.poll();
    // he then works on another loan — the save that used to upload the old copy over the payment
    app.loan('L2').payments.push(pay(6)); await app.save(); await app.poll();
    chk('  still there after the next save', app.loan('L1').payments.length, 2);
    chk('  and the cloud has it, so the other computer gets it', cloud.rows.L1.data.payments.length, 2);
    chk('  the other loan\'s new payment is in the cloud too', cloud.rows.L2.data.payments.length, 2);

    // and once more after another restart
    app = startApp(cloud, store);
    await app.advance(1000); await app.poll();
    chk('  and after another restart', app.loan('L1').payments.length, 2);
  }

  // ============ 2. app opened while offline: the first sync must be retried, not abandoned
  {
    const cloud = makeCloud(), store = {};
    store.shivam_device_id = 'dev_office';
    store.shivam_loans_v1 = JSON.stringify(seed());
    store.shivam_cloud_sess = JSON.stringify({ access_token: 'ok', refresh_token: 'r0', expires_at: 9e15 });
    seed().forEach((l) => cloud.put(l.id, l, 'dev_office'));
    cloud.netDown = true;
    const app = startApp(cloud, store);
    await app.advance(1000);
    app.loan('L2').payments.push(pay(9)); await app.save();
    cloud.netDown = false;
    await app.advance(31000);
    chk('offline at start: the payment reaches the cloud once the network is back', cloud.rows.L2.data.payments.length, 2);
  }

  // ============ 3. the other computer's payment still arrives (nothing waiting here)
  {
    const cloud = makeCloud(), store = {};
    store.shivam_device_id = 'dev_office';
    store.shivam_loans_v1 = JSON.stringify(seed());
    store.shivam_cloud_sess = JSON.stringify({ access_token: 'ok', refresh_token: 'r0', expires_at: 9e15 });
    seed().forEach((l) => cloud.put(l.id, l, 'dev_office'));
    const app = startApp(cloud, store);
    await app.advance(1000);
    const theirs = JSON.parse(JSON.stringify(cloud.rows.L1.data)); theirs.payments.push(pay(7));
    cloud.put('L1', theirs, 'dev_home');
    await app.poll();
    chk('a payment entered on the other computer appears here', app.loan('L1').payments.length, 2);
  }

  // ============ 4. both computers changed the same loan: neither copy is overwritten until the owner chooses
  {
    const cloud = makeCloud(), store = {};
    store.shivam_device_id = 'dev_office';
    store.shivam_loans_v1 = JSON.stringify(seed());
    store.shivam_cloud_sess = JSON.stringify({ access_token: 'ok', refresh_token: 'r0', expires_at: 9e15 });
    seed().forEach((l) => cloud.put(l.id, l, 'dev_office'));
    let app = startApp(cloud, store);
    await app.advance(1000);
    // office records a payment while offline
    app.loan('L1').payments.push(pay(3));
    cloud.netDown = true; await app.save(); cloud.netDown = false;
    // home records a different one on the same loan
    const theirs = JSON.parse(JSON.stringify(cloud.rows.L1.data)); theirs.payments.push(pay(4));
    cloud.put('L1', theirs, 'dev_home');
    await app.poll();
    chk('clash: our payment stays on screen', app.loan('L1').payments.length, 2);
    chk('  the clash is recorded for the owner', JSON.parse(store.shivam_cloud_conflicts_v1 || '[]').length, 1);
    // an ordinary save of ANOTHER loan used to push our copy of L1 over theirs
    app.loan('L2').payments.push(pay(8)); await app.save(); await app.poll();
    chk('  the other computer\'s copy is not overwritten meanwhile', cloud.rows.L1.data.payments.map((p) => p.date), ['2026-11-01', '2026-11-04']);
    chk('  the unrelated save still uploads', cloud.rows.L2.data.payments.length, 2);
    // owner keeps ours
    await app.ctx.cloudResolveConflict('L1', 'mine'); await app.poll();
    chk('  after "keep mine" our copy uploads', cloud.rows.L1.data.payments.map((p) => p.date), ['2026-11-01', '2026-11-03']);
  }

  console.log(fails ? '\n' + fails + ' CHECK(S) FAILED' : '\nALL RESTART-SYNC CHECKS PASS');
  process.exitCode = fails ? 1 : 0;
})();
