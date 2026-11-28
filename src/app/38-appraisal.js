  /* ===================== Credit appraisal (loan eligibility) =====================
     How much can this borrower safely be lent? Worked the way banks and NBFCs
     appraise a retail loan — the five Cs, with the papers as evidence:

       Capacity    income from the salary slip / ITR, cross-checked against what
                   actually reaches the bank; FOIR caps total EMIs to a share of it
       Banking     average bank balance must cover the EMI (ABB : EMI cover)
       Character   credit-bureau score, overdue/settled accounts, cheque/ECS
                   returns in the statement, and this borrower's record with us
       Collateral  loan-to-value cap on verified property, lower for commercial
                   and open plots
       Conditions  job / business vintage, age at the end of the loan

     Three amounts come out: minimum (every paper at its most cautious), average
     (the recommendation) and maximum (stretch). Each is the LOWEST of the limits
     that apply, then reduced for risk. A points score (0-100) gives a risk grade
     A-D; grade C recommends the minimum, grade D recommends declining.

     The repayment is this book's model — FLAT interest: EMI = P x (1/n + r).
     Interest-only (byaj) loans are assessed as if repaid over 24 months, so a
     borrower is never sanctioned more principal than he could ever pay back.

     Nothing here changes an existing loan's figures. The appraisal is stored on
     the loan as `appraisal` (plain JSON, so it syncs and backs up with it). */
  (function () {
    var APPR_KEY = 'shivam_appraisal_v1';
    var APPR_DEF = {
      foir: [40, 50, 60],          // % of income all EMIs may take (min / avg / max)
      ltv: [40, 50, 60],           // % of residential property value
      abbCover: [2, 1.5, 1],       // average balance must be this many times the EMI
      itrHaircut: [60, 70, 75],    // % of self-employed ITR income counted
      ltvAdj: { residential: 0, commercial: -5, plot: -10 },
      round: 5000,
      ioAssessMonths: 24
    };
    function _n(v) { v = Number(v); return isFinite(v) ? v : 0; }
    function _pos(v) { return Math.max(0, _n(v)); }
    function _okTriple(a) { return Array.isArray(a) && a.length === 3 && a.every(function (x) { return isFinite(x) && x > 0 && x <= 100; }); }

    function apprCfg() {
      var c = JSON.parse(JSON.stringify(APPR_DEF)), s = null;
      try { s = JSON.parse(localStorage.getItem(APPR_KEY) || 'null'); } catch (e) { s = null; }
      if (s && typeof s === 'object') {
        if (_okTriple(s.foir)) c.foir = s.foir.map(Number).sort(function (a, b) { return a - b; });
        if (_okTriple(s.ltv)) c.ltv = s.ltv.map(Number).sort(function (a, b) { return a - b; });
      }
      return c;
    }
    function apprSaveCfg(foir, ltv) {
      var s = {};
      if (_okTriple(foir)) s.foir = foir.map(Number);
      if (_okTriple(ltv)) s.ltv = ltv.map(Number);
      try { localStorage.setItem(APPR_KEY, JSON.stringify(s)); } catch (e) {}
    }

    /* ---- this borrower's record with us ------------------------------------ */
    function apprPast(key, excludeId, book) {
      var out = { loans: 0, active: 0, closed: 0, activeEmi: 0, bounces: 0, lateFees: 0, inArrears: 0 };
      if (!key) return out;
      (book || []).forEach(function (l) {
        if (!l || l.id === excludeId || l._test) return;
        var k = (typeof custKeyOf === 'function') ? custKeyOf(l) : '';
        if (k !== key) return;
        out.loans++;
        var closed = /closed|settled|foreclosed/i.test(String(l.status || ''));
        if (closed) out.closed++; else { out.active++; out.activeEmi += _pos(l.emi); }
        (Array.isArray(l.charges) ? l.charges : []).forEach(function (c) {
          if (!c) return;
          if (/bounce/i.test(String(c.type || ''))) out.bounces++;
          else if (/late/i.test(String(c.type || ''))) out.lateFees++;
        });
        if (!closed && _pos(l.arrears) > 0) out.inArrears++;
      });
      return out;
    }

    function _ageAt(dob, fromIso, months) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dob || ''))) return null;
      var b = new Date(dob + 'T00:00:00'), s = /^\d{4}-\d{2}-\d{2}$/.test(String(fromIso || '')) ? new Date(fromIso + 'T00:00:00') : new Date();
      if (isNaN(b) || isNaN(s)) return null;
      var e = new Date(s.getFullYear(), s.getMonth() + Math.max(0, Math.round(_n(months))), s.getDate());
      var a = e.getFullYear() - b.getFullYear();
      if (e.getMonth() < b.getMonth() || (e.getMonth() === b.getMonth() && e.getDate() < b.getDate())) a--;
      return a;
    }
    function _floorTo(v, step) {
      v = Math.max(0, v || 0);
      if (!isFinite(v)) return 0;
      if (v >= step) return Math.floor(v / step) * step;
      return Math.floor(v / 1000) * 1000;
    }

    /* ---- the engine (pure: data in, result out) ----------------------------- */
    function apprCompute(inp, cfg, past) {
      cfg = cfg || apprCfg(); inp = inp || {}; past = past || apprPast('', null, []);
      var res = { ok: false, errors: [], tiers: [], flags: [], grade: '', score: 0, recommended: 0, recTier: -1, knockouts: [] };
      var flag = function (lvl, text) { res.flags.push({ lvl: lvl, text: text }); };

      var self = inp.occ === 'self';
      var S = _pos(inp.salary), C = _pos(inp.credits), abb = _pos(inp.abb), emis = _pos(inp.emis);
      var itr = [_pos(inp.itr1), _pos(inp.itr2)].filter(function (x) { return x > 0; });
      var Im = itr.length ? itr.reduce(function (a, x) { return a + x; }, 0) / itr.length / 12 : 0;
      var b = Math.max(0, Math.round(_n(inp.bounces)));
      var r = _pos(inp.rate) / 100, n = Math.round(_pos(inp.tenure)), io = !!inp.interestOnly;
      var scoreRaw = (inp.score === '' || inp.score == null) ? null : _n(inp.score);
      var ntc = scoreRaw !== null && scoreRaw <= 0;
      var score = (scoreRaw !== null && !ntc) ? scoreRaw : null;

      if (!S && !Im && !C) res.errors.push('Enter the income: net salary, ITR income or average bank credits.');
      if (!io && !n) res.errors.push('Enter the tenure on the loan form.');
      if (io && !r) res.errors.push('Enter the interest rate on the loan form.');
      if (res.errors.length) return res;

      var per = io ? (1 / cfg.ioAssessMonths + r) : (1 / n + r);
      var secured = !!inp.secured && _pos(inp.propValue) > 0;
      var propOk = secured && !!inp.titleOk;
      var adj = (cfg.ltvAdj[inp.propType] != null) ? cfg.ltvAdj[inp.propType] : 0;

      var bouncePen = [1, 0.9, 0.8, 0.5][Math.min(b, 3)];
      var bureauPen = 1;
      if (score !== null) bureauPen = score >= 700 ? 1 : score >= 650 ? 0.85 : score >= 600 ? 0.6 : 0.4;
      else if (ntc) bureauPen = 0.9;
      var overduePen = inp.overdue ? 0.5 : 1;
      var riskMult = bouncePen * bureauPen * overduePen;

      for (var t = 0; t < 3; t++) {
        var It = Im ? Im * (self ? cfg.itrHaircut[t] / 100 : 1) : 0;
        var declared = [S, It].filter(function (x) { return x > 0; });
        var inc, basis;
        if (declared.length) {
          inc = t === 0 ? Math.min.apply(null, declared) : t === 2 ? Math.max.apply(null, declared)
              : declared.reduce(function (a, x) { return a + x; }, 0) / declared.length;
          basis = 'papers';
          if (C && inc > C) { inc = C; basis = 'bank'; }        // income must reach the bank
        } else { inc = C * [0.4, 0.5, 0.6][t]; basis = 'credits'; }
        var emiF = Math.max(0, inc * cfg.foir[t] / 100 - emis);
        var emiB = abb ? abb / cfg.abbCover[t] : Infinity;
        var emiCap = Math.min(emiF, emiB) * riskMult;
        var pInc = emiCap / per;
        var cap = propOk ? _pos(inp.propValue) * Math.max(0, cfg.ltv[t] + adj) / 100 : Infinity;
        var limitBy = emiB < emiF ? 'balance' : 'income';
        var p = pInc;
        if (cap < p) { p = cap; limitBy = 'property'; }
        res.tiers.push({ income: inc, basis: basis, foir: cfg.foir[t], emiIncome: emiF, emiBank: emiB, cap: cap,
                         ltv: propOk ? Math.max(0, cfg.ltv[t] + adj) : 0, limitBy: limitBy, principal: _floorTo(p, cfg.round) });
      }
      // a cautious figure can never exceed a less cautious one
      res.tiers[1].principal = Math.max(res.tiers[1].principal, res.tiers[0].principal);
      res.tiers[2].principal = Math.max(res.tiers[2].principal, res.tiers[1].principal);
      res.tiers.forEach(function (x) { x.emi = Math.round(io ? x.principal * r : x.principal * per); });
      res.riskMult = riskMult; res.per = per; res.interestOnly = io;

      /* ---- risk score (points out of 100) ---- */
      var mid = res.tiers[1], pts = 0, parts = [];
      var add = function (k, v, max) { pts += v; parts.push({ k: k, v: v, max: max }); };
      var bur = inp.overdue ? 0 : score === null ? (ntc ? 12 : 10) : score >= 750 ? 25 : score >= 700 ? 20 : score >= 650 ? 12 : score >= 600 ? 5 : 0;
      add('Credit bureau', bur, 25);
      add('Cheque / ECS returns', [20, 14, 8, 0][Math.min(b, 3)], 20);
      var obl = mid.income ? emis / mid.income : 1;
      add('Existing obligations', obl <= 0.10 ? 20 : obl <= 0.25 ? 15 : obl <= 0.40 ? 8 : 0, 20);
      var cover = (abb && mid.emi) ? abb / mid.emi : null;
      add('Bank balance cover', !abb ? 5 : !mid.emi ? 0 : cover >= 2 ? 15 : cover >= 1.5 ? 11 : cover >= 1 ? 6 : 0, 15);
      var vin = (inp.vintage === '' || inp.vintage == null) ? null : _pos(inp.vintage);
      add('Job / business stability', vin === null ? 4 : vin >= 3 ? 10 : vin >= (self ? 2 : 1) ? 6 : 0, 10);
      add('Security', propOk ? 10 : 0, 10);
      var pastAdj = (past.closed > 0 && past.bounces === 0 ? 5 : 0) - Math.min(15, past.bounces * 5) - (past.lateFees > 3 ? 5 : 0) - (past.inArrears ? 10 : 0);
      if (past.loans) add('Record with us', pastAdj, 5);
      res.score = Math.max(0, Math.min(100, Math.round(pts)));
      res.scoreParts = parts;

      var age = _ageAt(inp.dob, inp.disb, io ? cfg.ioAssessMonths : n);
      res.ageAtEnd = age;
      if (b >= 3 && score !== null && score < 650) res.knockouts.push('3 or more returns in 6 months and a bureau score under 650');
      if (inp.overdue && !propOk) res.knockouts.push('Overdue, settled or written-off loan in the credit report, with no verified security');
      if (age !== null && age > 70) res.knockouts.push('Borrower would be over 70 when the loan ends');
      if (!mid.principal) res.knockouts.push('No repayment capacity left after existing EMIs');
      res.grade = res.knockouts.length ? 'D' : res.score >= 75 ? 'A' : res.score >= 60 ? 'B' : res.score >= 45 ? 'C' : 'D';
      res.recTier = (res.grade === 'A' || res.grade === 'B') ? 1 : res.grade === 'C' ? 0 : -1;
      res.recommended = res.recTier >= 0 ? res.tiers[res.recTier].principal : 0;

      /* ---- observations ---- */
      res.knockouts.forEach(function (k) { flag('bad', k + '.'); });
      if (b >= 3) flag('bad', b + ' cheque / ECS returns in 6 months. Amounts halved; take a guarantor and post-dated cheques, or decline.');
      else if (b) flag('warn', b + ' cheque / ECS return' + (b > 1 ? 's' : '') + ' in 6 months. Amounts reduced ' + Math.round((1 - bouncePen) * 100) + '%.');
      if (inp.overdue) flag('bad', 'Credit report shows an overdue, settled or written-off loan. Amounts halved.');
      if (score !== null && score < 650) flag(score < 600 ? 'bad' : 'warn', 'Bureau score ' + score + ' is below the 650 most lenders accept. Amounts reduced ' + Math.round((1 - bureauPen) * 100) + '%.');
      else if (score !== null && score < 700) flag('warn', 'Bureau score ' + score + ' is fair. Amounts reduced 15%.');
      if (ntc) flag('warn', 'No credit history. Lean on the guarantor, security and bank statement.');
      if (scoreRaw === null && !inp.overdue) flag('info', 'Credit bureau not checked. Pull the CIBIL report before sanction.');
      if (S && Im && Math.abs(Im - S) / Math.max(Im, S) > 0.3) flag('warn', 'ITR income and salary differ by more than 30%. Ask why before relying on either.');
      var decl = Math.max(S, Im);
      if (C && decl && C > decl * 1.5) flag('warn', 'Bank credits are well above declared income. Check for cash deposits, transfers between own accounts or loan money routed in.');
      if (C && decl && decl > C * 1.2) flag('warn', 'Declared income is higher than what reaches the bank. Only the banked amount is counted.');
      if (!S && !Im) flag('warn', 'No income proof. Amounts are based on bank credits alone.');
      if (!abb) flag('info', 'Average bank balance not entered. The balance-cover check was skipped.');
      if (_pos(inp.minBal) && mid.emi && _pos(inp.minBal) < mid.emi) flag('warn', 'Balance around the EMI date falls below the recommended EMI. Set the EMI date after salary or sales credit.');
      if (inp.secured && !_pos(inp.propValue)) flag('warn', 'Secured loan without a property value. Property was not counted.');
      if (secured && !inp.titleOk) flag('bad', 'Property title not verified. Property was not counted until the chain of title is checked.');
      if (propOk && adj) flag('info', (inp.propType === 'plot' ? 'Open plot' : 'Commercial property') + ': loan-to-value set ' + Math.abs(adj) + ' points lower.');
      if (vin !== null && vin < (self ? 2 : 1)) flag('warn', (self ? 'Business' : 'Job') + ' vintage under ' + (self ? '2 years' : '1 year') + '.');
      if (age !== null && age > 60 && age <= 70) flag('warn', 'Borrower will be ' + age + ' when the loan ends. Prefer a younger co-applicant or shorter tenure.');
      if (past.active) flag('info', 'Already has ' + past.active + ' active loan' + (past.active > 1 ? 's' : '') + ' with you (EMI ' + inrA(past.activeEmi) + '). Make sure it is in existing EMIs.');
      if (past.inArrears) flag('bad', 'Behind on a current loan with you.');
      if (past.bounces) flag('warn', past.bounces + ' cheque bounce' + (past.bounces > 1 ? 's' : '') + ' on earlier loans with you.');
      if (past.closed && !past.bounces && !past.inArrears) flag('ok', past.closed + ' loan' + (past.closed > 1 ? 's' : '') + ' with you closed without a bounce.');
      if (io) flag('info', 'Interest-only loan: assessed as if repaid over ' + cfg.ioAssessMonths + ' months, so the principal stays within reach.');
      res.ok = true;
      return res;
    }
    function inrA(v) { return (typeof inr === 'function') ? inr(Math.round(v || 0)) : ('₹' + Math.round(v || 0).toLocaleString('en-IN')); }

    window.apprCfg = apprCfg;
    window.apprCompute = apprCompute;
    window.apprPast = apprPast;

    /* ===================== UI ===================== */
    var GRADE = {
      A: { t: 'Low risk', d: 'Lend the recommended amount.' },
      B: { t: 'Acceptable', d: 'Lend the recommended amount with standard security.' },
      C: { t: 'Elevated risk', d: 'Lend the minimum, with a guarantor and post-dated cheques.' },
      D: { t: 'High risk', d: 'Decline, or lend only against fully verified security.' }
    };
    var DOC_CATS = ['Salary Slip', 'ITR', 'Bank Statement', 'Property Document'];
    var _e = function (s) { return (typeof esc === 'function') ? esc(s) : String(s == null ? '' : s); };
    var _v = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var _c = function (id) { var el = document.getElementById(id); return !!(el && el.checked); };
    var _last = null;

    function _css() {
      if (document.getElementById('apprCss')) return;
      var s = document.createElement('style'); s.id = 'apprCss';
      s.textContent = ''
        + '#apprOverlay{z-index:10040}#apprOverlay .modal{max-width:1120px;width:100%}'
        + '.ap-head-sub{font-size:12.5px;color:var(--muted);margin-left:12px;font-weight:500}'
        + '.ap-body{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);gap:0;min-height:520px}'
        + '.ap-in{padding:18px 22px;border-right:1px solid var(--line);max-height:68vh;overflow:auto}'
        + '.ap-out{padding:18px 22px;max-height:68vh;overflow:auto;background:var(--bg)}'
        + '.ap-sec{border:1px solid var(--line);border-radius:12px;background:var(--panel);margin-bottom:14px}'
        + '.ap-sec-h{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--line)}'
        + '.ap-sec-n{width:22px;height:22px;border-radius:50%;background:#0b1f4b;color:#fff;font-size:11.5px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none}'
        + 'html.dark .ap-sec-n{background:#c8a02a;color:#0b1f4b}'
        + '.ap-sec-h b{font-size:13.5px;color:var(--navy)}.ap-sec-h span{font-size:11.5px;color:var(--muted);margin-left:auto}'
        + '.ap-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:11px 14px;padding:13px 14px}'
        + '.ap-f label{display:block;font-size:11.5px;font-weight:600;color:var(--grey);margin-bottom:4px}'
        + '.ap-f input,.ap-f select{width:100%;box-sizing:border-box;height:36px;border:1px solid var(--line2);border-radius:8px;padding:0 10px;font-size:13.5px;background:var(--field);color:var(--text);font-variant-numeric:tabular-nums}'
        + '.ap-f input:focus,.ap-f select:focus{outline:0;border-color:#0b1f4b;box-shadow:0 0 0 3px rgba(11,31,75,.12)}'
        + '.ap-f small{display:block;font-size:11px;color:var(--muted);margin-top:3px}'
        + '.ap-chk{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text);padding-top:20px}.ap-chk input{width:16px;height:16px;flex:none}'
        + '.ap-terms{display:flex;flex-wrap:wrap;gap:8px 18px;padding:12px 14px;font-size:12.5px;color:var(--grey)}.ap-terms b{color:var(--text);font-variant-numeric:tabular-nums}'
        + '.ap-grade{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:12px;border:1px solid var(--line);background:var(--panel)}'
        + '.ap-gl{width:52px;height:52px;border-radius:12px;font:700 26px Georgia,serif;display:flex;align-items:center;justify-content:center;flex:none}'
        + '.ap-gA{background:var(--ok-bg);color:#15803d}.ap-gB{background:#eef4ff;color:#1d4ed8}.ap-gC{background:var(--warn-bg);color:#b45309}.ap-gD{background:var(--bad-bg);color:#b91c1c}'
        + 'html.dark .ap-gB{background:#16243f;color:#93c5fd}html.dark .ap-gA{color:#4ade80}html.dark .ap-gC{color:#fbbf24}html.dark .ap-gD{color:#f87171}'
        + '.ap-gt b{display:block;font-size:15px;color:var(--navy)}.ap-gt span{font-size:12.5px;color:var(--grey)}'
        + '.ap-score{margin-left:auto;text-align:right;font-size:11.5px;color:var(--muted)}.ap-score b{display:block;font-size:20px;color:var(--text);font-variant-numeric:tabular-nums}'
        + '.ap-bar{height:6px;border-radius:3px;background:var(--line);margin:10px 0 2px;overflow:hidden}.ap-bar i{display:block;height:100%;background:#0b1f4b;border-radius:3px}'
        + 'html.dark .ap-bar i{background:#c8a02a}'
        + '.ap-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}'
        + '.ap-tile{border:1px solid var(--line);border-radius:12px;padding:11px 12px;background:var(--panel)}'
        + '.ap-tile.rec{border:2px solid #0b1f4b;padding:10px 11px}html.dark .ap-tile.rec{border-color:#c8a02a}'
        + '.ap-tile .k{font-size:11px;font-weight:600;color:var(--muted);display:flex;align-items:center;justify-content:space-between;gap:6px;white-space:nowrap}'
        + '.ap-tile .k em{font-style:normal;color:#0b1f4b;background:#f3ecd6;border-radius:6px;padding:0 6px;font-size:10.5px}html.dark .ap-tile .k em{background:#c8a02a;color:#0b1f4b}'
        + '.ap-tile .v{font-size:19px;font-weight:700;color:var(--text);margin-top:3px;font-variant-numeric:tabular-nums}'
        + '.ap-tile .s{font-size:11.5px;color:var(--grey);margin-top:2px;font-variant-numeric:tabular-nums}'
        + '.ap-h{font-size:11.5px;font-weight:700;color:var(--grey);letter-spacing:.3px;margin:16px 0 6px}'
        + '.ap-tbl{width:100%;border-collapse:collapse;font-size:12.5px;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}'
        + '.ap-tbl th{font-size:11px;font-weight:600;color:var(--muted);text-align:right;padding:7px 10px;border-bottom:1px solid var(--line)}.ap-tbl th:first-child{text-align:left}'
        + '.ap-tbl td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums;color:var(--text)}.ap-tbl td:first-child{text-align:left;color:var(--grey)}'
        + '.ap-tbl tr:last-child td{border-bottom:0}'
        + '.ap-flag{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.45;padding:8px 11px;border-radius:9px;margin-bottom:6px;border:1px solid}'
        + '.ap-flag i{flex:none;width:7px;height:7px;border-radius:50%;margin-top:6px}'
        + '.ap-f-bad{background:var(--bad-bg);border-color:#fecaca;color:#991b1b}.ap-f-bad i{background:#dc2626}'
        + '.ap-f-warn{background:var(--warn-bg);border-color:#fde68a;color:#92400e}.ap-f-warn i{background:#d97706}'
        + '.ap-f-info{background:var(--panel);border-color:var(--line);color:var(--grey)}.ap-f-info i{background:#94a3b8}'
        + '.ap-f-ok{background:var(--ok-bg);border-color:#bbf7d0;color:#166534}.ap-f-ok i{background:#16a34a}'
        + 'html.dark .ap-flag{border-color:var(--line)}html.dark .ap-f-bad{color:#fca5a5}html.dark .ap-f-warn{color:#fcd34d}html.dark .ap-f-ok{color:#86efac}'
        + '.ap-docs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;padding:12px 14px 4px}'
        + '.ap-doc{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--grey)}.ap-doc b{font-weight:600;color:var(--text)}'
        + '.ap-dot{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--line2);flex:none;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff}'
        + '.ap-dot.on{background:#16a34a;border-color:#16a34a}'
        + '.ap-up{display:flex;gap:8px;align-items:center;padding:8px 14px 13px;flex-wrap:wrap}.ap-up select{height:32px;border:1px solid var(--line2);border-radius:8px;background:var(--field);color:var(--text);font-size:12.5px;padding:0 8px}'
        + '.ap-up input[type=file]{font-size:12px;color:var(--grey);max-width:230px}'
        + '.ap-lim{display:grid;grid-template-columns:auto repeat(3,64px);gap:6px 8px;align-items:center;padding:12px 14px;font-size:12.5px;color:var(--grey)}'
        + '.ap-lim input{height:30px;border:1px solid var(--line2);border-radius:7px;text-align:center;background:var(--field);color:var(--text);font-size:12.5px}'
        + '.ap-lim .hd{font-size:11px;font-weight:600;color:var(--muted);text-align:center}'
        + '.ap-err{padding:28px 18px;text-align:center;color:var(--grey);font-size:13px;border:1px dashed var(--line2);border-radius:12px;background:var(--panel)}'
        + '.ap-foot-note{font-size:11.5px;color:var(--muted);margin-right:auto}'
        + '@media(max-width:900px){.ap-body{grid-template-columns:1fr}.ap-in{border-right:0;border-bottom:1px solid var(--line);max-height:none}.ap-out{max-height:none}}';
      document.head.appendChild(s);
    }

    function _field(id, label, val, opts) {
      opts = opts || {};
      return '<div class="ap-f"><label for="' + id + '">' + label + '</label>'
        + '<input id="' + id + '" type="number" min="0" step="' + (opts.step || 'any') + '" value="' + _e(val == null ? '' : val) + '"' + (opts.ph ? ' placeholder="' + _e(opts.ph) + '"' : '') + ' oninput="apprRecalc()">'
        + (opts.hint ? '<small>' + opts.hint + '</small>' : '') + '</div>';
    }
    function _sec(n, title, note, inner) {
      return '<div class="ap-sec"><div class="ap-sec-h"><div class="ap-sec-n">' + n + '</div><b>' + title + '</b>' + (note ? '<span>' + note + '</span>' : '') + '</div>' + inner + '</div>';
    }

    /* What the form says about the loan right now (the appraisal never edits it). */
    function _formLoan() {
      return {
        id: (typeof editId !== 'undefined') ? editId : null,
        name: _v('m_name').trim(), acno: _v('m_acno').trim(), phone: _v('m_phone'),
        dob: _v('m_dob'), disb: _v('m_disb'), rate: _n(_v('m_rate')), tenure: _n(_v('m_tenure')),
        interestOnly: _c('m_intonly'), secured: _v('m_secured') === 'yes', propvalue: _n(_v('m_propvalue')),
        occupation: _v('m_occupation')
      };
    }
    function _custKey(f) { try { return (typeof custKeyOf === 'function' && f.name) ? custKeyOf({ name: f.name, phone: f.phone }) : ''; } catch (e) { return ''; } }

    function _inputs() {
      var f = _formLoan();
      return {
        occ: _v('ap_occ') || 'salaried', salary: _v('ap_sal'), itr1: _v('ap_itr1'), itr2: _v('ap_itr2'), vintage: _v('ap_vin'),
        credits: _v('ap_cr'), abb: _v('ap_abb'), minBal: _v('ap_minbal'), emis: _v('ap_emis'), bounces: _v('ap_bnc'),
        score: _v('ap_score'), overdue: _c('ap_od'),
        secured: f.secured, propValue: _v('ap_pv'), propType: _v('ap_pt') || 'residential', titleOk: _c('ap_title'),
        rate: f.rate, tenure: f.tenure, interestOnly: f.interestOnly, dob: f.dob, disb: f.disb
      };
    }

    window.apprOpen = function () {
      var f = _formLoan();
      if (!f.name) { toast('Enter the borrower’s name first'); try { loanTab('borrower'); } catch (e) {} return; }
      _css();
      var prev = window._apprDraft || (function () { var l = f.id && loans.find(function (x) { return x.id === f.id; }); return l && l.appraisal; })() || null;
      var p = (prev && prev.inputs) || {};
      var cfg = apprCfg();
      var occ = p.occ || (/business|shop|self|trader|contract|dukan|proprietor/i.test(f.occupation || '') ? 'self' : 'salaried');
      var ov = document.getElementById('apprOverlay');
      if (!ov) { ov = document.createElement('div'); ov.id = 'apprOverlay'; ov.className = 'overlay'; document.body.appendChild(ov); }
      var termsTxt = f.interestOnly
        ? ('Interest-only · <b>' + (f.rate || 0) + '%</b> per month')
        : ('Flat <b>' + (f.rate || 0) + '%</b> per month · <b>' + (f.tenure || 0) + '</b> months');
      ov.innerHTML = '<div class="modal" role="dialog" aria-label="Credit appraisal">'
        + '<div class="modal-head"><h3>Credit appraisal</h3><span class="ap-head-sub">' + _e(f.name) + (f.acno ? (' · A/C ' + _e(f.acno)) : '') + '</span>'
        + '<button class="x" aria-label="Close" onclick="apprClose()">✕</button></div>'
        + '<div class="ap-body"><div class="ap-in">'
        + _sec(1, 'Income', 'Salary slip · ITR',
            '<div class="ap-grid"><div class="ap-f"><label for="ap_occ">Occupation</label><select id="ap_occ" onchange="apprRecalc()"><option value="salaried"' + (occ === 'salaried' ? ' selected' : '') + '>Salaried</option><option value="self"' + (occ === 'self' ? ' selected' : '') + '>Self-employed / business</option></select></div>'
            + _field('ap_sal', 'Net salary per month (₹)', p.salary, { hint: 'Take-home, average of last 3 slips' })
            + _field('ap_vin', 'Years in job / business', p.vintage, { step: '0.5' })
            + _field('ap_itr1', 'ITR income, latest year (₹)', p.itr1, { hint: 'Business: net profit + depreciation' })
            + _field('ap_itr2', 'ITR income, year before (₹)', p.itr2)
            + '</div>')
        + _sec(2, 'Bank statement', 'Last 6 months',
            '<div class="ap-grid">'
            + _field('ap_cr', 'Average credits per month (₹)', p.credits, { hint: 'Leave out transfers between own accounts' })
            + _field('ap_abb', 'Average balance (₹)', p.abb, { hint: 'Balances on the 5th, 15th and 25th, averaged' })
            + _field('ap_minbal', 'Lowest balance near EMI date (₹)', p.minBal)
            + _field('ap_emis', 'Existing EMIs per month (₹)', p.emis, { hint: 'All loans, including any with you' })
            + _field('ap_bnc', 'Cheque / ECS returns', p.bounces == null ? 0 : p.bounces, { step: '1', hint: 'Inward returns for insufficient funds' })
            + '</div>')
        + _sec(3, 'Credit bureau', 'CIBIL / CRIF report',
            '<div class="ap-grid">'
            + _field('ap_score', 'Bureau score', p.score, { step: '1', ph: 'Not checked', hint: 'Enter 0 if no credit history' })
            + '<label class="ap-chk"><input type="checkbox" id="ap_od" onchange="apprRecalc()"' + (p.overdue ? ' checked' : '') + '> Overdue, settled or written-off account</label>'
            + '</div>')
        + _sec(4, 'Security', f.secured ? 'Secured loan' : 'Unsecured — change in Borrower tab',
            '<div class="ap-grid">'
            + _field('ap_pv', 'Market value (₹)', (p.propValue != null && p.propValue !== '') ? p.propValue : (f.propvalue || ''))
            + '<div class="ap-f"><label for="ap_pt">Property type</label><select id="ap_pt" onchange="apprRecalc()">'
            + [['residential', 'Residential house / flat'], ['commercial', 'Shop / commercial'], ['plot', 'Open plot']].map(function (o) { return '<option value="' + o[0] + '"' + (p.propType === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('')
            + '</select></div>'
            + '<label class="ap-chk"><input type="checkbox" id="ap_title" onchange="apprRecalc()"' + (p.titleOk ? ' checked' : '') + '> Title chain and papers verified</label>'
            + '</div>')
        + _sec(5, 'Loan terms', 'From the loan form', '<div class="ap-terms"><span>' + termsTxt + '</span>' + (f.dob ? '' : '<span>Add date of birth to check age at the end of the loan</span>') + '</div>')
        + _sec(6, 'Papers on file', 'Stored with the borrower’s documents',
            '<div class="ap-docs" id="ap_docs">' + DOC_CATS.map(function (c) { return '<div class="ap-doc"><span class="ap-dot"></span>' + c + '</div>'; }).join('') + '</div>'
            + '<div class="ap-up"><select id="ap_dcat">' + DOC_CATS.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>'
            + '<input type="file" id="ap_dfile" multiple accept=".pdf,image/*"><button type="button" class="btn btn-ghost btn-sm" onclick="apprAttach()">Attach</button></div>')
        + _sec(7, 'Lending limits', 'Your policy — applies to every appraisal',
            '<div class="ap-lim"><span></span><span class="hd">Minimum</span><span class="hd">Average</span><span class="hd">Maximum</span>'
            + '<span>EMIs as % of income</span>' + cfg.foir.map(function (x, i) { return '<input id="ap_foir' + i + '" type="number" min="1" max="100" value="' + x + '" oninput="apprLimits()">'; }).join('')
            + '<span>Loan as % of property value</span>' + cfg.ltv.map(function (x, i) { return '<input id="ap_ltv' + i + '" type="number" min="1" max="100" value="' + x + '" oninput="apprLimits()">'; }).join('')
            + '</div>')
        + '</div><div class="ap-out" id="ap_out"></div></div>'
        + '<div class="modal-foot"><span class="ap-foot-note" id="ap_note"></span>'
        + '<button class="btn btn-ghost" onclick="apprClose()">Cancel</button>'
        + '<button class="btn btn-ghost" onclick="apprPrint()">Print appraisal</button>'
        + '<button class="btn btn-ghost" onclick="apprKeep(false)">Save appraisal</button>'
        + '<button class="btn btn-primary" id="ap_apply" onclick="apprKeep(true)">Use amount</button>'
        + '</div></div>';
      ov.classList.add('show');
      window.apprRecalc();
      _docsRefresh();
    };

    window.apprClose = function () { var ov = document.getElementById('apprOverlay'); if (ov) ov.classList.remove('show'); };

    window.apprLimits = function () {
      var rd = function (p) { return [0, 1, 2].map(function (i) { return _n(_v(p + i)); }); };
      var foir = rd('ap_foir'), ltv = rd('ap_ltv');
      if (_okTriple(foir) && _okTriple(ltv)) apprSaveCfg(foir, ltv);
      window.apprRecalc();
    };

    window.apprRecalc = function () {
      var out = document.getElementById('ap_out'); if (!out) return;
      var f = _formLoan(), inp = _inputs();
      var past = apprPast(_custKey(f), f.id, (typeof loans !== 'undefined') ? loans : []);
      var res = apprCompute(inp, apprCfg(), past);
      _last = { inputs: inp, res: res, past: past, form: f };
      var btn = document.getElementById('ap_apply');
      if (!res.ok) {
        out.innerHTML = '<div class="ap-err">' + res.errors.map(_e).join('<br>') + '</div>';
        if (btn) btn.textContent = 'Use amount';
        return;
      }
      var g = GRADE[res.grade], T = res.tiers;
      var tile = function (i, k) {
        var x = T[i], rec = res.recTier === i;
        return '<div class="ap-tile' + (rec ? ' rec' : '') + '"><div class="k">' + k + (rec ? '<em>Recommended</em>' : '') + '</div>'
          + '<div class="v">' + inrA(x.principal) + '</div><div class="s">EMI ' + inrA(x.emi) + (res.interestOnly ? ' interest' : '') + '</div></div>';
      };
      var row = function (k, a, fmt) { return '<tr><td>' + k + '</td>' + a.map(function (v) { return '<td>' + (fmt ? fmt(v) : v) + '</td>'; }).join('') + '</tr>'; };
      var money = function (v) { return isFinite(v) ? inrA(v) : '—'; };
      out.innerHTML = ''
        + '<div class="ap-grade"><div class="ap-gl ap-g' + res.grade + '">' + res.grade + '</div><div class="ap-gt"><b>' + g.t + '</b><span>' + g.d + '</span></div>'
        + '<div class="ap-score">Risk score<b>' + res.score + '<span style="font-size:12px;color:var(--muted);font-weight:500"> / 100</span></b></div></div>'
        + '<div class="ap-bar"><i style="width:' + res.score + '%"></i></div>'
        + '<div class="ap-tiles">' + tile(0, 'Minimum') + tile(1, 'Average') + tile(2, 'Maximum') + '</div>'
        + '<div class="ap-h">How it was worked out</div>'
        + '<table class="ap-tbl"><tr><th></th><th>Minimum</th><th>Average</th><th>Maximum</th></tr>'
        + row('Income counted / month', T.map(function (x) { return x.income; }), money)
        + row('EMI room at ' + T.map(function (x) { return x.foir + '%'; }).join(' / ') + ', less existing EMIs', T.map(function (x) { return x.emiIncome; }), money)
        + row('EMI the bank balance supports', T.map(function (x) { return x.emiBank; }), money)
        + row('Property limit' + (T[0].ltv ? (' at ' + T.map(function (x) { return x.ltv + '%'; }).join(' / ')) : ''), T.map(function (x) { return x.cap; }), money)
        + row('Risk adjustment', T.map(function () { return res.riskMult < 1 ? ('−' + Math.round((1 - res.riskMult) * 100) + '%') : 'none'; }))
        + row('Limited by', T.map(function (x) { return x.limitBy; }))
        + '</table>'
        + '<div class="ap-h">Risk score</div>'
        + '<table class="ap-tbl">' + res.scoreParts.map(function (p) { return '<tr><td>' + p.k + '</td><td>' + p.v + ' / ' + p.max + '</td></tr>'; }).join('') + '</table>'
        + '<div class="ap-h">Observations</div>'
        + (res.flags.length ? res.flags.map(function (x) { return '<div class="ap-flag ap-f-' + x.lvl + '"><i></i><span>' + _e(x.text) + '</span></div>'; }).join('')
            : '<div class="ap-flag ap-f-ok"><i></i><span>No warning signs in these figures.</span></div>');
      if (btn) btn.textContent = res.recommended ? ('Use ' + inrA(res.recommended)) : 'Use amount';
      var note = document.getElementById('ap_note');
      if (note) note.textContent = past.loans ? ('Record with you: ' + past.loans + ' earlier loan' + (past.loans > 1 ? 's' : '')) : 'New borrower';
    };

    function _docsRefresh() {
      var box = document.getElementById('ap_docs'); if (!box) return;
      var key = _custKey(_formLoan());
      if (!key || typeof vaultList !== 'function') return;
      vaultList(key).then(function (docs) {
        var have = {}; (docs || []).forEach(function (d) { have[d.category] = (have[d.category] || 0) + 1; });
        box.innerHTML = DOC_CATS.map(function (c) {
          return '<div class="ap-doc"><span class="ap-dot' + (have[c] ? ' on' : '') + '">' + (have[c] ? '✓' : '') + '</span>' + (have[c] ? ('<b>' + c + '</b>&nbsp;· ' + have[c]) : c) + '</div>';
        }).join('');
      }).catch(function () {});
    }
    window.apprAttach = function () {
      var inp = document.getElementById('ap_dfile'), cat = _v('ap_dcat') || 'Other';
      var key = _custKey(_formLoan());
      if (!inp || !inp.files || !inp.files.length) { toast('Choose a file first'); return; }
      if (!key || typeof vaultAdd !== 'function') { toast('Document storage is not available'); return; }
      var files = [].slice.call(inp.files);
      Promise.all(files.map(function (fl) { return vaultAdd(key, fl, cat); })).then(function () {
        inp.value = ''; _docsRefresh();
        try { logAudit('Document Uploaded', files.length + ' file(s) · ' + cat + ' (appraisal)'); } catch (e) {}
        toast(files.length + ' document' + (files.length > 1 ? 's' : '') + ' attached');
      }).catch(function () { toast('Could not store the document'); });
    };

    function _record() {
      if (!_last || !_last.res || !_last.res.ok) return null;
      var r = _last.res, i = _last.inputs;
      return {
        at: new Date().toISOString(), by: (typeof currentUser !== 'undefined' && currentUser && (currentUser.name || currentUser.user)) || '',
        inputs: { occ: i.occ, salary: i.salary, itr1: i.itr1, itr2: i.itr2, vintage: i.vintage, credits: i.credits, abb: i.abb, minBal: i.minBal,
                  emis: i.emis, bounces: i.bounces, score: i.score, overdue: i.overdue, propValue: i.propValue, propType: i.propType, titleOk: i.titleOk },
        terms: { rate: i.rate, tenure: i.tenure, interestOnly: i.interestOnly, secured: i.secured },
        cfg: { foir: apprCfg().foir, ltv: apprCfg().ltv },
        min: r.tiers[0].principal, avg: r.tiers[1].principal, max: r.tiers[2].principal,
        emi: [r.tiers[0].emi, r.tiers[1].emi, r.tiers[2].emi],
        recommended: r.recommended, grade: r.grade, score: r.score,
        flags: r.flags.map(function (x) { return x.lvl + ':' + x.text; }),
        past: _last.past
      };
    }
    window.apprHint = function (a) {
      var h = document.getElementById('m_apprHint'); if (!h) return;
      if (!a) { h.textContent = ''; return; }
      h.innerHTML = 'Appraisal grade <b>' + _e(a.grade) + '</b> · eligible ' + inrA(a.min) + ' – ' + inrA(a.max)
        + (a.recommended ? (' · recommended <b>' + inrA(a.recommended) + '</b>') : ' · not recommended');
    };
    window.apprKeep = function (apply) {
      var rec = _record();
      if (!rec) { toast('Complete the appraisal first'); return; }
      if (apply && !rec.recommended) { toast('Grade ' + rec.grade + ': no amount is recommended. Save the appraisal instead.'); return; }
      window._apprDraft = rec;
      if (apply) {
        var pr = document.getElementById('m_principal');
        if (pr) { pr.value = rec.recommended; }
        var pv = document.getElementById('m_propvalue');
        if (pv && !_n(pv.value) && _n(rec.inputs.propValue)) pv.value = _n(rec.inputs.propValue);
        try { if (typeof recalc === 'function') recalc(); } catch (e) {}
      }
      window.apprHint(rec);
      window.apprClose();
      toast(apply ? ('Loan amount set to ' + inrA(rec.recommended) + ' — save the loan to keep the appraisal') : 'Appraisal kept — save the loan to store it');
    };

    /* ---- printable memo (internal: it is NOT part of the borrower's Loan File,
       which is sent to the borrower; this is the lender's own working) ---- */
    function apprMemoHTML(a, info) {
      info = info || {};
      var F = (typeof FIRM === 'function') ? FIRM() : { name: 'Shivam Enterprises', address: '' };
      var i = a.inputs || {}, t = a.terms || {}, g = GRADE[a.grade] || { t: '', d: '' };
      var m = function (v) { return (v === '' || v == null || !isFinite(Number(v)) || Number(v) === 0) ? '—' : inrA(Number(v)); };
      var d = function (iso) { try { return (typeof fmtDate === 'function') ? fmtDate(String(iso).slice(0, 10)) : String(iso).slice(0, 10); } catch (e) { return ''; } };
      var kv = function (k, v) { return '<tr><td>' + k + '</td><td>' + v + '</td></tr>'; };
      var lvlName = { bad: 'Adverse', warn: 'Caution', info: 'Note', ok: 'Positive' };
      return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Credit_Appraisal_' + _e((info.acno || info.name || '').replace(/[^\w-]+/g, '_')) + '</title><style>'
        + '@page{size:A4;margin:14mm}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#141414;margin:0;font-size:12.5px;line-height:1.5;font-variant-numeric:lining-nums tabular-nums}'
        + '.wrap{max-width:740px;margin:0 auto;padding:6px}.hd{display:flex;justify-content:space-between;gap:18px;border-bottom:2px solid #0b1f4b;padding-bottom:10px}'
        + '.fn{font-family:Georgia,"Times New Roman",serif;font-size:21px;font-weight:700;letter-spacing:.6px;color:#0b1f4b}.mut{color:#555;font-size:11.5px}'
        + '.ttl{font-size:16px;font-weight:700;color:#0b1f4b;text-align:right}.meta{text-align:right;font-size:11.5px;color:#555;line-height:1.7;white-space:nowrap}.meta b{color:#141414}'
        + 'h4{font-size:11.5px;letter-spacing:.4px;color:#0b1f4b;margin:16px 0 6px;text-transform:uppercase}'
        + '.rec{display:flex;align-items:center;gap:14px;border:1px solid #d8d2bd;background:#faf7ee;padding:10px 12px;margin-top:12px}'
        + '.gl{width:44px;height:44px;border:2px solid #0b1f4b;font:700 24px Georgia,serif;color:#0b1f4b;display:flex;align-items:center;justify-content:center}'
        + 'table{width:100%;border-collapse:collapse}td,th{padding:5px 8px;border-bottom:1px solid #e2e2e2;text-align:left;vertical-align:top}th{font-size:11px;color:#555;font-weight:600;border-bottom:1px solid #999}'
        + '.num td:not(:first-child),.num th:not(:first-child){text-align:right}.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}'
        + '.kv td:first-child{color:#555;width:56%}.ob{margin:0;padding:0;list-style:none}.ob li{padding:4px 0;border-bottom:1px solid #eee}.ob b{display:inline-block;min-width:62px;font-size:11px;color:#0b1f4b}'
        + '.dec{border:1px solid #bbb;padding:10px 12px;margin-top:14px}.ln{display:inline-block;border-bottom:1px solid #333;min-width:150px;height:14px}'
        + '.sig{display:flex;justify-content:space-between;margin-top:34px}.sig div{border-top:1px solid #333;padding-top:4px;min-width:200px;text-align:center;font-size:11.5px}'
        + '.foot{margin-top:14px;font-size:10.5px;color:#777;text-align:center}'
        + '</style></head><body><div class="wrap">'
        + '<div class="hd"><div><div class="fn">' + _e(F.name || 'Shivam Enterprises') + '</div><div class="mut">' + _e(F.address || '') + '</div></div>'
        + '<div><div class="ttl">Credit appraisal memo</div><div class="meta">A/C <b>' + _e(info.acno || '—') + '</b><br>Date <b>' + _e(d(a.at)) + '</b><br>Appraised by <b>' + _e(a.by || '—') + '</b></div></div></div>'
        + '<div class="two" style="margin-top:10px"><div><h4>Applicant</h4><table class="kv">'
        + kv('Name', '<b>' + _e(info.name || '') + '</b>') + kv('Occupation', i.occ === 'self' ? 'Self-employed / business' : 'Salaried')
        + kv('Years in job / business', i.vintage !== '' && i.vintage != null ? _e(i.vintage) : '—') + kv('Phone', _e(info.phone || '—')) + '</table></div>'
        + '<div><h4>Proposed loan</h4><table class="kv">'
        + kv('Loan amount on file', m(info.principal)) + kv('Repayment', t.interestOnly ? ('Interest only, ' + _e(t.rate) + '% per month') : ('Flat ' + _e(t.rate) + '% per month, ' + _e(t.tenure) + ' months'))
        + kv('Security', t.secured ? ('Property, ' + m(i.propValue) + (i.titleOk ? ', title verified' : ', title not verified')) : 'Unsecured') + '</table></div></div>'
        + '<div class="rec"><div class="gl">' + _e(a.grade) + '</div><div><b style="font-size:14px">' + _e(g.t) + ' · risk score ' + _e(a.score) + ' / 100</b><br>'
        + (a.recommended ? ('Recommended loan <b>' + inrA(a.recommended) + '</b>') : '<b>No amount recommended</b>') + ' · eligible range ' + inrA(a.min) + ' – ' + inrA(a.max) + '</div></div>'
        + '<h4>Eligibility</h4><table class="num"><tr><th></th><th>Minimum</th><th>Average</th><th>Maximum</th></tr>'
        + '<tr><td>Loan amount</td><td>' + inrA(a.min) + '</td><td>' + inrA(a.avg) + '</td><td>' + inrA(a.max) + '</td></tr>'
        + '<tr><td>' + (t.interestOnly ? 'Monthly interest' : 'Monthly EMI') + '</td><td>' + (a.emi || []).map(inrA).join('</td><td>') + '</td></tr>'
        + '<tr><td>EMIs as % of income</td><td>' + (a.cfg.foir || []).join('%</td><td>') + '%</td></tr>'
        + (t.secured ? ('<tr><td>Loan as % of property value</td><td>' + (a.cfg.ltv || []).join('%</td><td>') + '%</td></tr>') : '')
        + '</table>'
        + '<div class="two"><div><h4>Income and bank statement</h4><table class="kv">'
        + kv('Net salary per month', m(i.salary)) + kv('ITR income, latest year', m(i.itr1)) + kv('ITR income, year before', m(i.itr2))
        + kv('Average credits per month', m(i.credits)) + kv('Average bank balance', m(i.abb)) + kv('Lowest balance near EMI date', m(i.minBal)) + '</table></div>'
        + '<div><h4>Obligations and conduct</h4><table class="kv">'
        + kv('Existing EMIs per month', m(i.emis)) + kv('Cheque / ECS returns, 6 months', _e(i.bounces || 0))
        + kv('Bureau score', (i.score === '' || i.score == null) ? 'Not checked' : (Number(i.score) <= 0 ? 'No credit history' : _e(i.score)))
        + kv('Overdue / settled accounts', i.overdue ? 'Yes' : 'None reported')
        + kv('Earlier loans with us', a.past && a.past.loans ? (a.past.loans + ' (' + a.past.closed + ' closed, ' + a.past.bounces + ' bounces)') : 'None') + '</table></div></div>'
        + '<h4>Observations</h4><ul class="ob">' + ((a.flags || []).length ? a.flags.map(function (s) { var k = s.split(':')[0]; return '<li><b>' + (lvlName[k] || 'Note') + '</b>' + _e(s.slice(k.length + 1)) + '</li>'; }).join('') : '<li>No warning signs in the figures.</li>') + '</ul>'
        + '<div class="dec"><b>Decision</b><br><br>Approved &#9744;&nbsp;&nbsp; Approved with conditions &#9744;&nbsp;&nbsp; Declined &#9744;&nbsp;&nbsp;&nbsp; Sanctioned amount ₹ <span class="ln"></span><br><br>Conditions <span class="ln" style="min-width:560px"></span></div>'
        + '<div class="sig"><div>Appraised by</div><div>Approved by, for ' + _e(F.name || 'Shivam Enterprises') + '</div></div>'
        + '<div class="foot">Internal credit document — not to be given to the borrower. Figures are as entered from the documents on file.</div>'
        + '</div></body></html>';
    }
    window.apprMemoHTML = apprMemoHTML;

    function _openMemo(a, info) {
      var ov = document.getElementById('apprMemo');
      if (!ov) { ov = document.createElement('div'); ov.id = 'apprMemo'; ov.className = 'overlay'; ov.style.zIndex = '10060'; document.body.appendChild(ov); }
      ov.innerHTML = '<div class="modal" style="max-width:860px;width:100%"><div class="modal-head"><h3>Credit appraisal memo</h3><span class="ap-head-sub">' + _e(info.name || '') + '</span>'
        + '<button class="x" aria-label="Close" onclick="apprMemoClose()">✕</button></div>'
        + '<div style="padding:12px 16px"><iframe id="apprMemoFrame" style="width:100%;height:72vh;border:1px solid var(--line);border-radius:8px;background:#fff"></iframe></div>'
        + '<div class="modal-foot"><button class="btn btn-ghost" onclick="apprMemoClose()">Close</button><button class="btn btn-primary" onclick="apprMemoPrint()">Print / Save PDF</button></div></div>';
      ov.classList.add('show');
      var fr = document.getElementById('apprMemoFrame');
      try { fr.srcdoc = apprMemoHTML(a, info); } catch (e) {}
      try { logAudit('Credit Appraisal Printed', (info.name || '') + (info.acno ? (' (' + info.acno + ')') : '')); } catch (e) {}
    }
    window.apprPrint = function () {
      var rec = _record(); if (!rec) { toast('Complete the appraisal first'); return; }
      var f = _formLoan();
      _openMemo(rec, { name: f.name, acno: f.acno, phone: f.phone, principal: _n(_v('m_principal')) });
    };
    window.apprMemoClose = function () { var ov = document.getElementById('apprMemo'); if (ov) ov.classList.remove('show'); };
    window.apprMemoPrint = function () { var fr = document.getElementById('apprMemoFrame'); try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
  })();
