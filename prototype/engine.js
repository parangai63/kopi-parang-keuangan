/* Mesin hitung Kopi Parang — terjemahan rumus Excel v2 (lihat dokumen spesifikasi, bagian Logika perhitungan) */
const N = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const BLN3 = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function calcDay(r) {
  const tot = N(r.c) + N(r.e);
  const noShift = r.s1 == null && r.s2 == null;
  const cdiff = noShift ? 0 : N(r.c) - N(r.s1) - N(r.s2);
  const ediff = r.es == null ? 0 : N(r.e) - N(r.es);
  const unexp = noShift ? 0 : cdiff - N(r.bon) - N(r.comp) - N(r.own);
  const cost = ediff + unexp;
  const net = tot - cost;
  let st = '';
  if (tot === 0) st = '';
  else if (N(r.c) > 0 && noShift) st = 'Belum direalisasi';
  else if (N(r.e) > 0 && r.es == null) st = 'EDC belum settle';
  else if (Math.abs(unexp) > 50000) st = 'Cek selisih tunai';
  else st = 'OK';
  return { tot, real: N(r.s1) + N(r.s2) + N(r.es), cdiff, ediff, unexp, cost, net, st,
           ticket: N(r.trx) ? net / N(r.trx) : null };
}

function lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }

function compute(st) {
  const { year: Y, rate, inkl, accr } = st.settings;
  const BLN = st.bln;
  const acc = st.accounts.map(a => ({ code: a[0], name: a[1], group: a[2], normal: a[3], cat: a[4], line: a[5], ob: a[6] }));
  const A = Object.fromEntries(acc.map(a => [a.name, a]));
  const eq = acc.filter(a => a.group === 'ASET' && a.normal === 'D').reduce((s, a) => s + a.ob, 0)
           - acc.filter(a => a.group === 'ASET' && a.normal === 'K').reduce((s, a) => s + a.ob, 0)
           - acc.filter(a => a.group === 'LIABILITAS').reduce((s, a) => s + a.ob, 0);
  A['Ekuitas Kopi Parang'].ob = eq;

  // omzet harian
  const days = st.daily.map(r => ({ ...r, m: +r.d.slice(5, 7), x: calcDay(r) }));
  const ms = Array.from({ length: 13 }, () => ({ tot: 0, cash: 0, edc: 0, net: 0, real: 0, s: 0, es: 0, bon: 0, comp: 0, own: 0, cdiff: 0, unexp: 0, ediff: 0, items: 0, trx: 0, open: 0, notok: 0 }));
  for (const r of days) {
    const o = ms[r.m], x = r.x;
    o.tot += x.tot; o.cash += N(r.c); o.edc += N(r.e); o.net += x.net; o.real += x.real;
    o.s += N(r.s1) + N(r.s2); o.es += N(r.es); o.bon += N(r.bon); o.comp += N(r.comp); o.own += N(r.own);
    o.cdiff += x.cdiff; o.unexp += x.unexp; o.ediff += x.ediff; o.items += N(r.items); o.trx += N(r.trx);
    if (x.tot > 0) { o.open++; if (x.st !== 'OK') o.notok++; }
  }

  // penyusutan
  const assets = st.assets.map(a => {
    const [y, mo] = a[1].split('-').map(Number);
    const sy = mo === 12 ? y + 1 : y, sm = mo === 12 ? 1 : mo + 1;
    const per = Math.round(a[2] / (a[3] * 12));
    const sched = [0];
    for (let m = 1; m <= 12; m++) {
      const idx = (Y - sy) * 12 + (m - sm);
      sched.push(m <= BLN && idx >= 0 && idx < a[3] * 12 ? per : 0);
    }
    const akum = sched.reduce((s, v) => s + v, 0);
    return { name: a[0], date: a[1], cost: a[2], life: a[3], per, start: `${sy}-${String(sm).padStart(2, '0')}-01`, sched, akum, book: a[2] - akum };
  });
  const dep = m => assets.reduce((s, a) => s + a.sched[m], 0);

  // PBJT
  const pbjt = m => {
    const om = ms[m].tot;
    const dpp = inkl ? om / (1 + rate) : om;
    const ter = Math.round(dpp * rate);
    return { om, ter, kb: ter - N(st.paid[m]) };
  };

  // jurnal otomatis
  const auto = [];
  for (let m = 1; m <= BLN; m++) {
    const d = lastDay(Y, m), o = ms[m], nm = BULAN[m - 1];
    const push = (deb, kre, nom, ket, kind = 'OTOMATIS', sub = '') => { if (nom) auto.push({ no: `AUTO-${String(m).padStart(2, '0')}-${auto.length + 1}`, d, m, y: Y, deb, kre, nom, ket, tag: '', sub, kind }); };
    push('Piutang Usaha Cafe', 'Pendapatan Cafe', o.net, `Omzet bersih bulan ${nm} (dari Omzet Harian)`);
    push('Kas Tunai', 'Piutang Usaha Cafe', o.s, `Realisasi tunai omzet bulan ${nm}`);
    push('Kas Bank', 'Piutang Usaha Cafe', o.es, `Realisasi EDC/QRIS omzet bulan ${nm}`);
    push('Piutang Lainnya', 'Piutang Usaha Cafe', o.bon, `Bon karyawan bulan ${nm}`);
    push('Biaya Compliment', 'Piutang Usaha Cafe', o.comp, `Compliment bulan ${nm}`);
    push('Prive', 'Piutang Usaha Cafe', o.own, `Bill owner bulan ${nm}`, 'OTOMATIS', 'Bill Owner');
    push('Beban Penyusutan Peralatan', 'Akumulasi Penyusutan Peralatan', dep(m), `Penyusutan peralatan bulan ${nm}`);
    if (accr) push('Pajak Restoran', 'Utang Pajak Daerah (PBJT)', Math.max(0, pbjt(m).kb), `Estimasi PBJT kurang bayar bulan ${nm}`, 'PENYESUAIAN');
  }
  const manual = st.journal.map(j => ({ no: j[0], d: j[1], m: +j[1].slice(5, 7), y: +j[1].slice(0, 4), deb: j[2], kre: j[3], nom: j[4], ket: j[5], tag: j[6], sub: j[7], nota: j[8] || '', kind: 'UMUM' }));

  // Penyesuaian persediaan dari nilai stok akhir Parang-ops (jurnal 9, spesifikasi bagian 2).
  // Hanya dibuat untuk bulan yang punya ops[m].stock; Jan–Sep 2026 tidak punya, jadi angka patokan tetap.
  const ops = st.ops || {};
  const INV = 'Inventori', BB = 'Biaya Bahan Baku';
  const invBase = Array(13).fill(0);
  for (const j of manual.concat(auto)) {
    if (j.y !== Y) continue;
    if (j.deb === INV) invBase[j.m] += j.nom;
    if (j.kre === INV) invBase[j.m] -= j.nom;
  }
  let invRun = A[INV].ob;
  for (let m = 1; m <= BLN; m++) {
    invRun += invBase[m];
    const sv = ops[m] && ops[m].stock;
    if (sv == null) continue;
    const adj = Math.round(sv - invRun);
    if (adj) {
      auto.push({ no: `AUTO-${String(m).padStart(2, '0')}-INV`, d: lastDay(Y, m), m, y: Y, deb: adj > 0 ? INV : BB, kre: adj > 0 ? BB : INV, nom: Math.abs(adj),
        ket: `Penyesuaian persediaan bulan ${BULAN[m - 1]} (nilai stok Parang-ops ${sv.toLocaleString('id-ID')})`, tag: '', sub: '', kind: 'PENYESUAIAN', inv: true });
      invRun += adj;
    }
  }
  const all = manual.concat(auto).filter(j => j.y === Y);

  // mutasi
  const mut = Object.fromEntries(acc.map(a => [a.name, Array(13).fill(0)]));
  for (const j of all) { mut[j.deb][j.m] += j.nom; mut[j.kre][j.m] -= j.nom; }
  const sob = n => A[n].normal === 'D' ? A[n].ob : -A[n].ob;
  const upto = (n, M = BLN) => mut[n].slice(1, M + 1).reduce((s, v) => s + v, 0);
  const end = n => sob(n) + upto(n);

  // laba rugi
  const pl = [null];
  for (let m = 1; m <= 12; m++) {
    const g = n => mut[n][m];
    const cafe = -g('Pendapatan Cafe'), non = -g('Pendapatan non Cafe'), kotor = cafe + non, pajak = g('Pajak Restoran'), net = kotor - pajak;
    const bb = g('Biaya Bahan Baku'), saji = g('Biaya Penyajian'), hpp = bb + saji, gross = net - hpp;
    const op = {};
    acc.filter(a => a.code.startsWith('61')).forEach(a => op[a.name] = g(a.name));
    const bu = Object.values(op).reduce((s, v) => s + v, 0);
    const usaha = gross - bu, ebitda = usaha + op['Beban Penyusutan Peralatan'];
    const lainP = -g('Pendapatan Lainnya'), lainB = g('Biaya Lainnya'), lain = lainP - lainB, np = usaha + lain;
    pl.push({ cafe, non, kotor, pajak, net, bb, saji, hpp, gross, op, bu, usaha, ebitda, lainP, lainB, lain, np });
  }
  const sumPL = k => pl.slice(1, BLN + 1).reduce((s, p) => s + p[k], 0);
  const plTot = {}; ['cafe','non','kotor','pajak','net','bb','saji','hpp','gross','bu','usaha','ebitda','lainP','lainB','lain','np'].forEach(k => plTot[k] = sumPL(k));
  plTot.op = {}; Object.keys(pl[1].op).forEach(k => plTot.op[k] = pl.slice(1, BLN + 1).reduce((s, p) => s + p.op[k], 0));

  // neraca
  const bal = (n, open) => open ? sob(n) : end(n);
  const nr = open => {
    const b = n => bal(n, open);
    const o = { kasT: b('Kas Tunai'), kasB: b('Kas Bank'), kasW: b('Kas Warung'), piut: b('Piutang Usaha Cafe') + b('Piutang Usaha non Cafe'), piutL: b('Piutang Lainnya'), inv: b('Inventori'), perl: b('Perlengkapan'), dimuka: b('Beban Dibayar di Muka'), alat: b('Peralatan'), akum: b('Akumulasi Penyusutan Peralatan') };
    o.al = o.kasT + o.kasB + o.kasW + o.piut + o.piutL + o.inv + o.perl + o.dimuka; o.atl = o.alat + o.akum; o.ta = o.al + o.atl;
    o.uu = -b('Utang Usaha Lancar'); o.upj = -b('Utang Pajak Daerah (PBJT)'); o.ul = -b('Utang Lainnya'); o.lp = o.uu + o.upj + o.ul; o.ujp = -b('Utang Usaha Jangka Panjang'); o.tl = o.lp + o.ujp;
    o.modal = -b('Ekuitas Kopi Parang'); o.prive = -b('Prive');
    o.lr = open ? 0 : -acc.filter(a => a.group === 'PENDAPATAN' || a.group === 'BEBAN').reduce((s, a) => s + upto(a.name), 0);
    o.te = o.modal + o.prive + o.lr; o.tle = o.tl + o.te; o.cek = Math.round(o.ta - o.tle);
    return o;
  };
  const neraca = { open: nr(true), close: nr(false) };

  // arus kas
  const lines = ['OP1','OP2','OP3','OP4','OP5','OP6','OP7','IN1','FN1','FN2','FN3'];
  const cf = Object.fromEntries(lines.map(l => [l, Array(13).fill(0)]));
  for (const j of all) {
    if (j.m > BLN) continue;
    const kd = A[j.deb].cat === 'KAS', kk = A[j.kre].cat === 'KAS';
    if (kd === kk) continue;
    const law = kd ? j.kre : j.deb, eff = kd ? j.nom : -j.nom, ln = A[law].line;
    j.cash = eff; j.lawan = law;
    if (cf[ln]) cf[ln][m_(j)] += eff;
  }
  function m_(j) { return j.m; }
  const kasAccts = acc.filter(a => a.cat === 'KAS').map(a => a.name);
  const kasAwal = kasAccts.reduce((s, n) => s + sob(n), 0);
  const cfm = [null]; let run = kasAwal;
  for (let m = 1; m <= BLN; m++) {
    const g = l => cf[l][m];
    const op = ['OP1','OP2','OP3','OP4','OP5','OP6','OP7'].reduce((s, l) => s + g(l), 0), inv = g('IN1'), fin = g('FN1') + g('FN2') + g('FN3');
    const awal = run, naik = op + inv + fin; run = awal + naik;
    cfm.push({ op, inv, fin, naik, awal, akhir: run });
  }
  const kasLedger = kasAccts.reduce((s, n) => s + end(n), 0);

  // perubahan ekuitas
  const pe = [null]; let ea = -(sob('Ekuitas Kopi Parang') + sob('Prive'));
  for (let m = 1; m <= BLN; m++) {
    const setor = -mut['Ekuitas Kopi Parang'][m], prive = -mut['Prive'][m], lb = pl[m].np;
    const akhir = ea + setor + lb + prive; pe.push({ awal: ea, setor, lb, prive, akhir }); ea = akhir;
  }

  // neraca saldo
  const ns = acc.map(a => { const s = end(a.name); return { ...a, end: s, dr: Math.max(s, 0), cr: Math.max(-s, 0) }; });
  const nsDiff = Math.round(ns.reduce((s, r) => s + r.dr - r.cr, 0));

  // event
  const tags = [...new Set(manual.map(j => j.tag).filter(Boolean))];
  const events = tags.map(t => {
    const js = manual.filter(j => j.tag === t);
    const pend = js.filter(j => A[j.kre].group === 'PENDAPATAN').reduce((s, j) => s + j.nom, 0);
    const biaya = js.filter(j => A[j.deb].group === 'BEBAN').reduce((s, j) => s + j.nom, 0);
    return { name: t, first: js.map(j => j.d).sort()[0], pend, biaya, laba: pend - biaya, ratio: pend ? biaya / pend : null, n: js.length };
  }).sort((a, b) => a.first.localeCompare(b.first));

  // Cek dengan Parang-ops (spesifikasi bagian 12). Tidak memblokir tutup buku.
  const tolP = st.settings.tolP ?? 0.05, tolS = st.settings.tolS ?? 0.02;
  const opsCheck = [null];
  for (let m = 1; m <= 12; m++) {
    const o = ops[m] || {};
    const kPurch = manual.filter(j => j.y === Y && j.m === m && (j.deb === 'Biaya Bahan Baku' || j.deb === 'Biaya Penyajian')).reduce((s, j) => s + j.nom, 0);
    const dP = o.purch == null ? null : o.purch - kPurch;
    const dS = o.sales == null ? null : o.sales - ms[m].tot;
    opsCheck.push({ m, stock: o.stock ?? null, purch: o.purch ?? null, sales: o.sales ?? null, kPurch, omzet: ms[m].tot, dP, dS,
      flagP: dP != null && Math.abs(dP) > tolP * kPurch, flagS: dS != null && Math.abs(dS) > tolS * ms[m].tot });
  }

  const openDays = ms.slice(1, BLN + 1).reduce((s, o) => s + o.open, 0);
  const netYtd = ms.slice(1, BLN + 1).reduce((s, o) => s + o.net, 0);
  const trxYtd = ms.slice(1, BLN + 1).reduce((s, o) => s + o.trx, 0);

  const checks = [
    { label: 'Neraca seimbang', ok: neraca.close.cek === 0, diff: neraca.close.cek },
    { label: 'Neraca saldo seimbang', ok: nsDiff === 0, diff: nsDiff },
    { label: 'Kas di arus kas = kas di neraca', ok: BLN === 0 || Math.round(cfm[BLN].akhir - kasLedger) === 0, diff: BLN ? Math.round(cfm[BLN].akhir - kasLedger) : 0 },
    { label: 'Ekuitas: laporan perubahan = neraca', ok: BLN === 0 || Math.round(pe[BLN].akhir - neraca.close.te) === 0, diff: BLN ? Math.round(pe[BLN].akhir - neraca.close.te) : 0 },
  ];

  return { BLN, Y, acc, A, days, ms, assets, auto, manual, all, mut, sob, end, pl, plTot, neraca, cf, cfm, kasLedger, pe, ns, events, checks, pbjt, opsCheck, tolP, tolS,
           perDay: openDays ? netYtd / openDays : 0, ticket: trxYtd ? netYtd / trxYtd : 0 };
}

if (typeof module !== 'undefined') module.exports = { compute, calcDay, BULAN, BLN3 };
