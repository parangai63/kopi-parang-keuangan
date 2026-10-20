(function () {
const D = window.KP_DATA;
const TODAY = '2026-10-12';
const st = {
  settings: { ...D.settings, tolP: 0.05, tolS: 0.02 }, bln: D.settings.bln, accounts: D.accounts, assets: D.assets, paid: { ...D.paid }, reported: {},
  ops: {}, // angka bulanan dari Parang-ops, diinput manual saat tutup buku: { [bulan]: { stock, purch, sales } }
  daily: D.daily.map(r => ({ d: r[0], c: r[1], e: r[2], s1: r[3], s2: r[4], es: r[5], bon: r[6], comp: r[7], own: r[8], items: r[9], trx: r[10] })),
  journal: D.journal.slice(),
};
const LIM = { food: 0.35, pay: 0.30, occ: 0.10, prime: 0.65, net: 0.10 };
let R = compute(st);
const ui = { role: 'owner', view: 'dashboard', om: 10, sel: null, rep: 'lr', bb: 'Kas Bank', jf: { q: '', m: '', acct: '', ev: '', kind: '' }, jLimit: 60, jForm: false, jErr: '', confirmReopen: false, ack: {}, pinOk: false, pinErr: '' };
const DEMO_PIN = '123456';
const NAV = [
  { id: 'dashboard', label: 'Ringkasan', roles: ['owner', 'admin'] },
  { id: 'omzet', label: 'Omzet Harian', roles: ['owner', 'admin', 'kasir'] },
  { id: 'jurnal', label: 'Jurnal', roles: ['owner', 'admin'] },
  { id: 'laporan', label: 'Laporan', roles: ['owner', 'admin'] },
  { id: 'aset', label: 'Aset Tetap', roles: ['owner', 'admin'] },
  { id: 'tutup', label: 'Tutup Buku', roles: ['owner'] },
];
const ROLES = [['owner', 'Owner'], ['admin', 'Admin'], ['kasir', 'Kasir']];

/* ---------- format ---------- */
const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const f0 = n => nf.format(Math.round(n || 0));
const rp = n => (n < 0 ? '−Rp' : 'Rp') + nf.format(Math.abs(Math.round(n || 0)));
const acct = n => n == null || n === '' ? '' : (n < 0 ? '(' + nf.format(Math.abs(Math.round(n))) + ')' : nf.format(Math.round(n)));
const jt = n => { const v = n / 1e6; return (v < 0 ? '−' : '') + new Intl.NumberFormat('id-ID', { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 1 }).format(Math.abs(v)) + ' jt'; };
const pct = (n, d = 1) => n == null || !isFinite(n) ? '–' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n * 100) + '%';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tgl = d => { const [y, m, dd] = d.split('-').map(Number); return `${dd} ${BLN3[m - 1]} ${y}`; };
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const dow = d => new Date(d + 'T00:00:00Z').getUTCDay();
const periode = () => R.BLN ? `Periode 1 Januari – ${+lastDayStr(R.BLN).slice(8)} ${BULAN[R.BLN - 1]} ${R.Y}` : 'Belum ada bulan ditutup';
const lastDayStr = m => new Date(Date.UTC(R.Y, m, 0)).toISOString().slice(0, 10);
const parseMoney = v => { const s = String(v ?? '').replace(/[^\d-]/g, ''); return s === '' || s === '-' ? null : Number(s); };
const stClass = s => s === 'OK' ? 'ok' : s === 'Cek selisih tunai' ? 'bad' : s ? 'wait' : '';

/* ---------- shell ---------- */
function render() {
  const allowed = NAV.filter(n => n.roles.includes(ui.role));
  if (!allowed.find(n => n.id === ui.view)) ui.view = allowed[0].id;
  const oct = R.ms[ui.role === 'kasir' ? 10 : 10];
  document.getElementById('nav').innerHTML = allowed.map(n => {
    const badge = n.id === 'omzet' && R.ms[R.BLN + 1] && R.ms[R.BLN + 1].notok ? `<span class="count">${R.ms[R.BLN + 1].notok}</span>` : '';
    return `<button data-act="nav" data-v="${n.id}" ${ui.view === n.id ? 'aria-current="page"' : ''}>${n.label}${badge}</button>`;
  }).join('');
  const views = { dashboard: vDash, omzet: ui.role === 'kasir' ? vKasir : vOmzet, jurnal: vJurnal, laporan: vLaporan, aset: vAset, tutup: vTutup };
  const [title, sub, body] = ui.role === 'kasir' && !ui.pinOk ? vPin() : views[ui.view]();
  document.getElementById('main').innerHTML = `
    <header class="top">
      <div><h1>${title}</h1><div class="sub">${sub}</div></div>
      <div class="top-right">
        <span class="chip">Tutup buku s.d. ${R.BLN ? BULAN[R.BLN - 1] + ' ' + R.Y : '–'}</span>
        <span class="seg-label">Masuk sebagai</span>
        <div class="seg" role="group" aria-label="Peran">${ROLES.map(([k, l]) => `<button data-act="role" data-v="${k}" aria-pressed="${ui.role === k}">${l}</button>`).join('')}</div>
      </div>
    </header>
    <div class="proto"><b>Prototipe.</b> Angka di sini dihitung ulang dari data asli Excel v2 dan sama dengan Excel. Aplikasi ini berdiri sendiri: tidak terhubung ke Majoo maupun Parang-ops. Coba ganti peran, isi omzet, tambah jurnal, atau tutup buku Oktober. Perubahan hilang saat halaman dimuat ulang.</div>
    ${body}`;
}

/* ---------- dashboard ---------- */
function vDash() {
  const B = R.BLN, T = R.plTot;
  const nm = T.net ? T.np / T.net : null, gm = T.net ? T.gross / T.net : null;
  const next = R.ms[B + 1];
  const kpis = `<div class="kpis">
    ${kpi('Pendapatan bersih', rp(T.net), `rata-rata ${jt(T.net / B)} / bulan`)}
    ${kpi('Laba kotor', rp(T.gross), `margin ${pct(gm)}`)}
    ${kpi('Laba bersih', rp(T.np), `margin ${pct(nm)} · target ≥ ${pct(LIM.net, 0)}`, T.np < 0 ? 'neg' : 'pos')}
    ${kpi('Omzet bersih / hari', rp(R.perDay), 'rata-rata hari buka')}
    ${kpi('Rata-rata / transaksi', rp(R.ticket), 'avg ticket')}
  </div>`;
  const costs = [
    ['HPP (food cost)', T.hpp, LIM.food], ['Gaji', T.op['Beban Gaji'], LIM.pay], ['Sewa', T.op['Biaya Sewa Tempat'], LIM.occ],
    ['Marketing & event', T.op['Biaya Marketing & Promosi']], ['Tagihan bulanan', T.op['Biaya Tagihan Bulanan']],
    ['Beban lainnya', T.bu - T.op['Beban Gaji'] - T.op['Biaya Sewa Tempat'] - T.op['Biaya Marketing & Promosi'] - T.op['Biaya Tagihan Bulanan']],
  ];
  const costHtml = costs.map(([l, v, lim]) => {
    const p = v / T.net, over = lim && p > lim;
    return `<div class="cost-row"><span>${l}</span><div class="bar" title="${rp(v)}"><span class="${over ? 'over' : ''}" style="width:${Math.min(100, Math.max(0, p * 100 / 0.6))}%"></span>${lim ? `<em style="left:${lim * 100 / 0.6}%" title="batas ${pct(lim, 0)}"></em>` : ''}</div><span class="p ${over ? 'neg' : ''}">${pct(p)}</span></div>`;
  }).join('');
  const checks = `<ul class="checks">${R.checks.map(c => `<li><span class="dot ${c.ok ? 'ok' : 'bad'}">${c.ok ? '✓' : '!'}</span>${c.label}${c.ok ? '' : ` <span class="neg">selisih ${f0(c.diff)}</span>`}</li>`).join('')}</ul>`;
  const attn = next ? `<p class="note" style="margin-top:14px">${BULAN[B]} berjalan: ${next.open} hari buka, <b class="${next.notok ? 'neg' : ''}">${next.notok} hari perlu dicek</b> sebelum tutup buku.</p>` : '';
  return ['Ringkasan keuangan', periode(), `<div class="grid">
    ${kpis}
    <div class="two">
      <section class="panel chart"><h2>Kinerja bulanan</h2><p class="hint">Pendapatan bersih dan laba bersih per bulan yang sudah ditutup.</p>${chart()}</section>
      <div class="grid">
        <section class="panel"><h2>Struktur biaya</h2><p class="hint">Persen dari pendapatan bersih s.d. ${BULAN[B - 1]}. Garis tipis = batas di Pengaturan.</p><div class="costs">${costHtml}</div></section>
        <section class="panel"><h2>Cek kesehatan data</h2><p class="hint">Harus semua hijau sebelum laporan dibagikan.</p>${checks}${attn}</section>
      </div>
    </div>
    ${eventPanel()}
  </div>`];
}
function kpi(l, v, s, cls = '') { return `<div class="kpi"><span class="l">${l}</span><span class="v ${cls}">${v}</span><span class="s">${s}</span></div>`; }
function eventPanel() {
  const ev = R.events;
  return `<section class="panel"><h2>Hasil per event</h2><p class="hint">Dari jurnal yang diberi tag event. Biaya tanpa tag tidak ikut terhitung.</p>
    <div class="tw"><table class="t"><thead><tr><th>Event</th><th>Mulai</th><th class="r">Pendapatan</th><th class="r">Biaya</th><th class="r">Laba (rugi)</th></tr></thead><tbody>
    ${ev.map(e => `<tr><td>${esc(e.name.replace(/^Event /, ''))}</td><td class="acc">${tgl(e.first)}</td><td class="r">${f0(e.pend)}</td><td class="r">${f0(e.biaya)}</td><td class="r ${e.laba < 0 ? 'neg' : 'pos'}">${acct(e.laba)}</td></tr>`).join('')}
    </tbody></table></div></section>`;
}
function chart() {
  const B = R.BLN, W = 720, H = 300, L = 56, Rr = 12, Tp = 14, Bt = 30;
  const net = [], np = [];
  for (let m = 1; m <= B; m++) { net.push(R.pl[m].net); np.push(R.pl[m].np); }
  const step = 20e6;
  const max = Math.ceil(Math.max(...net, 0) / step) * step, min = Math.floor(Math.min(...np, 0) / step) * step;
  const y = v => Tp + (max - v) / (max - min) * (H - Tp - Bt);
  const bw = (W - L - Rr) / Math.max(B, 1), bar = Math.min(18, bw * 0.3);
  let g = '';
  for (let v = min; v <= max; v += step) g += `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" ${v === 0 ? 'stroke-width="1.5" stroke="var(--faint)"' : ''}/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${v === 0 ? '0' : (v / 1e6) + ' jt'}</text>`;
  let b = '';
  for (let i = 0; i < B; i++) {
    const cx = L + bw * i + bw / 2;
    const y0 = y(0), yn = y(net[i]), yp = y(np[i]);
    b += `<rect x="${cx - bar - 1}" y="${yn}" width="${bar}" height="${y0 - yn}" rx="2" fill="var(--accent)"><title>${BULAN[i]}: pendapatan bersih ${rp(net[i])}</title></rect>`;
    b += `<rect x="${cx + 1}" y="${Math.min(yp, y0)}" width="${bar}" height="${Math.abs(y0 - yp) || 1}" rx="2" fill="${np[i] < 0 ? 'var(--crit)' : 'var(--good)'}"><title>${BULAN[i]}: laba bersih ${rp(np[i])}</title></rect>`;
    b += `<text x="${cx}" y="${H - 10}" text-anchor="middle" font-size="11.5" fill="var(--muted)">${BLN3[i]}</text>`;
  }
  return `<div class="legend"><span><i style="background:var(--accent)"></i>Pendapatan bersih</span><span><i style="background:var(--good)"></i>Laba bersih</span><span><i style="background:var(--crit)"></i>Rugi bersih</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pendapatan bersih dan laba bersih per bulan">${g}${b}</svg>`;
}

/* ---------- omzet (admin/owner) ---------- */
function vOmzet() {
  const m = ui.om, o = R.ms[m], locked = m <= R.BLN;
  const days = R.days.filter(r => r.m === m);
  const first = dow(days[0].d), pad = (first + 6) % 7;
  let cells = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(w => `<div class="wd">${w}</div>`).join('');
  for (let i = 0; i < pad; i++) cells += '<div></div>';
  for (const r of days) {
    const x = r.x, cls = x.tot ? 's-' + stClass(x.st) : 'empty';
    cells += `<button class="day ${cls} ${ui.sel === r.d ? 'sel' : ''} ${r.d === TODAY ? 'today' : ''}" data-act="day" data-v="${r.d}" aria-label="${tgl(r.d)} ${x.st || 'kosong'}"><span class="n">${+r.d.slice(8)}</span>${x.tot ? `<span class="a">${jt(x.net)}</span>` : ''}</button>`;
  }
  const months = BULAN.map((n, i) => `<button data-act="om" data-v="${i + 1}" aria-pressed="${ui.om === i + 1}" class="${i + 1 <= R.BLN ? 'locked' : ''}" title="${i + 1 <= R.BLN ? 'sudah ditutup' : ''}">${BLN3[i]}</button>`).join('');
  const target = st.settings.target;
  const strip = `<div class="sumstrip">
    <span>Omzet tercatat (POS)<b>${rp(o.tot)}</b></span><span>Omzet bersih<b>${rp(o.net)}</b></span>
    <span>Hari buka<b>${o.open}</b></span><span>Rata-rata / hari<b>${o.open ? rp(o.net / o.open) : '–'}</b></span>
    <span>Pencapaian target<b>${o.net ? pct(o.net / target) : '–'}</b></span><span>Perlu dicek<b class="${o.notok ? 'neg' : ''}">${o.notok} hari</b></span></div>`;
  const sel = ui.sel && +ui.sel.slice(5, 7) === m ? R.days.find(r => r.d === ui.sel) : null;
  return ['Omzet harian', `${BULAN[m - 1]} ${R.Y} · ${locked ? 'bulan sudah ditutup, hanya bisa dilihat' : 'bulan berjalan, bisa diisi'}`, `
    <div class="months" role="group" aria-label="Bulan">${months}</div>${strip}
    <div class="two">
      <section class="panel"><div class="cal">${cells}</div>
        <div class="cal-legend"><span><i style="background:var(--good)"></i>OK</span><span><i style="background:var(--warn)"></i>Belum direalisasi / EDC belum settle</span><span><i style="background:var(--crit)"></i>Cek selisih tunai (> Rp50.000)</span></div></section>
      <section class="panel" id="daypanel">${sel ? dayForm(sel, locked) : `<h2>Pilih tanggal</h2><p class="hint">Klik satu tanggal di kalender untuk melihat atau mengisi angka POS, setoran, dan penjelasan selisih.</p>`}</section>
    </div>`];
}
const FIELDS = [
  ['Angka tutup kasir Majoo', [['c', 'Tunai (POS)'], ['e', 'EDC / QRIS (POS)']]],
  ['Realisasi masuk kas', [['s1', 'Setoran tunai shift 1'], ['s2', 'Setoran tunai shift 2'], ['es', 'Settlement EDC']]],
  ['Penjelasan selisih tunai', [['bon', 'Bon karyawan'], ['comp', 'Compliment'], ['own', 'Bill owner']]],
  ['Operasional', [['items', 'Produk terjual'], ['trx', 'Jumlah transaksi']]],
];
function dayForm(r, locked) {
  const x = r.x;
  return `<h2>${HARI[dow(r.d)]}, ${tgl(r.d)} ${x.st ? `<span class="pill ${stClass(x.st)}">${x.st}</span>` : ''}</h2>
    <p class="hint">Kosong berarti belum diisi. Setoran yang masih kosong tidak dihitung sebagai selisih.</p>
    ${locked ? `<div class="lock" style="margin-bottom:12px">Bulan ${BULAN[r.m - 1]} sudah ditutup. Owner harus membuka kembali bulan ini untuk mengubah data.</div>` : ''}
    <form class="f" data-form="day" data-d="${r.d}">
      ${FIELDS.map(([lg, fs]) => `<fieldset><legend class="wide">${lg}</legend>${fs.map(([k, l]) => `<label class="fld">${l}<input id="f-${k}" name="${k}" class="money" inputmode="numeric" autocomplete="off" value="${r[k] == null ? '' : f0(r[k])}" ${locked ? 'disabled' : ''}></label>`).join('')}</fieldset>`).join('')}
      <div class="calc" id="calc">${calcHtml(x)}</div>
      ${locked ? '' : `<div class="btns"><button class="btn" type="submit">Simpan</button><button class="btn ghost" type="button" data-act="closeday">Batal</button></div>`}
    </form>`;
}
function calcHtml(x) {
  return `<span>Total tercatat</span><span>${f0(x.tot)}</span><span>Total realisasi</span><span>${f0(x.real)}</span>
    <span>Selisih tunai</span><span>${acct(x.cdiff)}</span><span>Selisih tunai tak terjelaskan</span><span class="${Math.abs(x.unexp) > 50000 ? 'neg' : ''}">${acct(x.unexp)}</span>
    <span>Selisih EDC</span><span>${acct(x.ediff)}</span><span class="big">Omzet bersih</span><span class="big">${f0(x.net)}</span>
    <span>Rata-rata / transaksi</span><span>${x.ticket ? f0(x.ticket) : '–'}</span>`;
}
function readForm(form) {
  const o = {};
  form.querySelectorAll('input[name]').forEach(i => o[i.name] = parseMoney(i.value));
  return o;
}

/* ---------- PIN kasir (terpisah dari PIN Parang-ops) ---------- */
function vPin() {
  return ['Masuk kasir', 'PIN 6 digit, dikelola di aplikasi ini (bukan PIN Parang-ops)', `<section class="panel" style="max-width:360px">
    <h2>Masukkan PIN</h2><p class="hint">PIN demo: ${DEMO_PIN}. Di aplikasi nyata, akun dikunci 15 menit setelah 5 kali salah.</p>
    <form class="f" data-form="pin"><label class="fld">PIN<input id="pin" name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></label>
    ${ui.pinErr ? `<div class="err" role="alert">${ui.pinErr}</div>` : ''}<div class="btns"><button class="btn" type="submit">Masuk</button></div></form></section>`];
}

/* ---------- kasir ---------- */
function vKasir() {
  const t = R.days.find(r => r.d === TODAY);
  const pend = R.days.filter(r => r.d < TODAY && r.m > R.BLN && r.x.st === 'Belum direalisasi');
  const fs = [['c', 'Tunai (POS)'], ['e', 'EDC / QRIS (POS)'], ['items', 'Produk terjual'], ['trx', 'Jumlah transaksi'], ['bon', 'Bon karyawan'], ['comp', 'Compliment'], ['own', 'Bill owner']];
  return ['Omzet hari ini', `${HARI[dow(TODAY)]}, ${tgl(TODAY)} · tampilan kasir di HP`, `<div class="kasir">
    <section class="panel"><h2>Angka tutup kasir Majoo</h2><p class="hint">Isi saat tutup toko, salin dari laporan tutup kasir di Majoo.</p>
      <form class="f" data-form="kasir" data-d="${TODAY}"><fieldset>
      ${fs.map(([k, l]) => `<label class="fld">${l}<input id="k-${k}" name="${k}" class="money" inputmode="numeric" autocomplete="off" value="${t[k] == null ? '' : f0(t[k])}"></label>`).join('')}
      </fieldset><div class="btns"><button class="btn" type="submit">Simpan omzet hari ini</button></div></form></section>
    <section class="panel"><h2>Setoran tunai yang belum diisi</h2><p class="hint">Isi jumlah uang tunai yang benar-benar disetor per shift (H+1). Settlement EDC diisi admin.</p>
      ${pend.length ? pend.map(r => `<form class="setor-row" data-form="setor" data-d="${r.d}"><div class="dl"><b>${tgl(r.d)}</b><div class="note">POS tunai ${f0(r.c)}</div></div>
        <label class="fld">Shift 1<input id="s1-${r.d}" name="s1" class="money" inputmode="numeric" autocomplete="off"></label>
        <label class="fld">Shift 2<input id="s2-${r.d}" name="s2" class="money" inputmode="numeric" autocomplete="off"></label>
        <button class="btn" type="submit">Simpan</button></form>`).join('') : '<p class="note">Semua setoran sudah diisi.</p>'}
    </section></div>`];
}

/* ---------- jurnal ---------- */
function jRows() {
  const f = ui.jf, q = f.q.toLowerCase();
  let rows = R.manual.concat(R.auto).filter(j => j.y === R.Y);
  if (f.m) rows = rows.filter(j => j.m === +f.m);
  if (f.acct) rows = rows.filter(j => j.deb === f.acct || j.kre === f.acct);
  if (f.ev) rows = rows.filter(j => j.tag === f.ev);
  if (f.kind) rows = rows.filter(j => f.kind === 'UMUM' ? j.kind === 'UMUM' : j.kind !== 'UMUM');
  if (q) rows = rows.filter(j => (j.ket + ' ' + j.no + ' ' + j.sub).toLowerCase().includes(q));
  return rows.sort((a, b) => b.d.localeCompare(a.d) || (a.kind === 'UMUM') - (b.kind === 'UMUM') || b.no.localeCompare(a.no));
}
function acctOptions(sel, blank) {
  const groups = {};
  R.acc.forEach(a => (groups[a.group] = groups[a.group] || []).push(a));
  return (blank ? `<option value="">${blank}</option>` : '') + Object.entries(groups).map(([g, as]) => `<optgroup label="${g}">${as.map(a => `<option value="${esc(a.name)}" ${sel === a.name ? 'selected' : ''}>${a.code} · ${esc(a.name)}</option>`).join('')}</optgroup>`).join('');
}
function vJurnal() {
  const rows = jRows(), f = ui.jf, tags = R.events.map(e => e.name);
  const total = rows.reduce((s, j) => s + j.nom, 0);
  const form = ui.jForm ? `<section class="panel" style="margin-bottom:16px"><h2>Transaksi baru</h2><p class="hint">Satu transaksi = satu akun debet dan satu akun kredit. Nomor bukti dibuat otomatis.</p>
    <form class="f" data-form="jurnal"><fieldset>
      <label class="fld">Tanggal<input id="j-date" type="date" name="date" value="${TODAY}" min="${R.Y}-01-01" max="${R.Y}-12-31"></label>
      <label class="fld">Akun debet<select id="j-deb" name="deb">${acctOptions('', 'Pilih akun…')}</select></label>
      <label class="fld">Akun kredit<select id="j-kre" name="kre">${acctOptions('', 'Pilih akun…')}</select></label>
      <label class="fld">Nominal (Rp)<input id="j-nom" name="nom" class="money" inputmode="numeric" autocomplete="off"></label>
      <label class="fld wide">Keterangan<input id="j-ket" name="ket" autocomplete="off" placeholder="mis. Belanja susu fresh milk 2 karton"></label>
      <label class="fld">No. nota<input id="j-nota" name="nota" autocomplete="off" placeholder="sama dengan di Parang-ops"></label>
      <label class="fld">Tag event<select id="j-tag" name="tag"><option value="">Tanpa event</option>${tags.map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
      <label class="fld">Pihak (opsional)<input id="j-sub" name="sub" autocomplete="off" placeholder="mis. Yantos"></label>
    </fieldset>${ui.jErr ? `<div class="err" role="alert">${ui.jErr}</div>` : ''}
    <div class="btns"><button class="btn" type="submit">Simpan transaksi</button><button class="btn ghost" type="button" data-act="jcancel">Batal</button></div></form></section>` : '';
  return ['Jurnal transaksi', `${f0(rows.length)} transaksi · total ${rp(total)}`, `${form}
    <div class="toolbar">
      <label class="fld q">Cari<input id="jf-q" data-jf="q" value="${esc(f.q)}" placeholder="keterangan, no. bukti, pihak"></label>
      <label class="fld">Bulan<select id="jf-m" data-jf="m"><option value="">Semua bulan</option>${BULAN.map((n, i) => `<option value="${i + 1}" ${+f.m === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="fld">Akun<select id="jf-acct" data-jf="acct">${acctOptions(f.acct, 'Semua akun')}</select></label>
      <label class="fld">Event<select id="jf-ev" data-jf="ev"><option value="">Semua</option>${tags.map(t => `<option ${f.ev === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label class="fld">Jenis<select id="jf-kind" data-jf="kind"><option value="">Semua</option><option value="UMUM" ${f.kind === 'UMUM' ? 'selected' : ''}>Input manual</option><option value="AUTO" ${f.kind === 'AUTO' ? 'selected' : ''}>Otomatis sistem</option></select></label>
      ${ui.jForm ? '' : '<button class="btn" data-act="jnew">+ Transaksi baru</button>'}
    </div>
    <div class="tw"><table class="t"><thead><tr><th>No. bukti</th><th>Tanggal</th><th>Debet</th><th>Kredit</th><th class="r">Nominal</th><th>Keterangan</th></tr></thead><tbody>
    ${rows.slice(0, ui.jLimit).map(j => `<tr><td class="mono acc">${j.kind === 'UMUM' ? esc(j.no) : `<span class="pill ${j.kind === 'OTOMATIS' ? 'auto' : 'adj'}">${j.kind === 'OTOMATIS' ? 'otomatis' : 'penyesuaian'}</span>`}</td><td class="acc">${tgl(j.d)}</td><td class="acc">${esc(j.deb)}</td><td class="acc">${esc(j.kre)}</td><td class="r">${f0(j.nom)}</td><td class="ket">${esc(j.ket)}${j.tag ? ` <span class="pill tag">${esc(j.tag)}</span>` : ''}${j.sub ? ` <span class="note">· ${esc(j.sub)}</span>` : ''}${j.nota ? ` <span class="note">· nota ${esc(j.nota)}</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="note">Tidak ada transaksi yang cocok dengan filter.</td></tr>'}
    </tbody></table>${rows.length > ui.jLimit ? `<div class="more"><button class="btn ghost" data-act="jmore">Tampilkan ${Math.min(100, rows.length - ui.jLimit)} lagi (sisa ${f0(rows.length - ui.jLimit)})</button></div>` : ''}</div>`];
}

/* ---------- laporan ---------- */
const REPS = [['lr', 'Laba Rugi'], ['nr', 'Neraca'], ['ak', 'Arus Kas'], ['pe', 'Perubahan Ekuitas'], ['ns', 'Neraca Saldo'], ['bb', 'Buku Besar']];
function vLaporan() {
  const tabs = `<div class="tabs" role="tablist">${REPS.map(([k, l]) => `<button role="tab" data-act="rep" data-v="${k}" aria-selected="${ui.rep === k}">${l}</button>`).join('')}</div>`;
  const body = { lr: repLR, nr: repNR, ak: repAK, pe: repPE, ns: repNS, bb: repBB }[ui.rep]();
  return ['Laporan keuangan', periode(), tabs + `<div class="rep-head">KOPI PARANG · ${periode()} · dalam Rupiah</div>` + body];
}
const ms = () => Array.from({ length: R.BLN }, (_, i) => i + 1);
function rowM(label, fn, cls = '', tot) {
  const vals = ms().map(m => fn(m));
  const t = tot !== undefined ? tot : vals.reduce((s, v) => s + v, 0);
  return `<tr class="${cls}"><td class="${cls === 'ind' ? 'ind' : ''}">${label}</td>${vals.map(v => `<td class="r">${acct(v)}</td>`).join('')}<td class="r">${acct(t)}</td></tr>`;
}
const hdr = (l = 'Keterangan') => `<thead><tr><th>${l}</th>${ms().map(m => `<th class="r">${BLN3[m - 1]}</th>`).join('')}<th class="r">s.d. ${BLN3[R.BLN - 1]}</th></tr></thead>`;
const hrow = l => `<tr class="h"><td>${l}</td>${ms().map(() => '<td></td>').join('')}<td></td></tr>`;
function ratioRow(label, fn, lim) {
  const T = R.plTot, cells = ms().map(m => fn(R.pl[m])), t = fn(T);
  const c = v => `<td class="r ${lim && v > lim ? 'over' : ''}">${pct(v)}</td>`;
  return `<tr class="ratio"><td class="ind">${label}${lim ? ` <span class="note">(batas ${pct(lim, 0)})</span>` : ''}</td>${cells.map(c).join('')}${c(t)}</tr>`;
}
function repLR() {
  if (!R.BLN) return '<p class="note">Belum ada bulan yang ditutup.</p>';
  const P = m => R.pl[m], op = R.acc.filter(a => a.code.startsWith('61'));
  const LBL = { 'Beban Gaji': 'Gaji karyawan', 'Biaya Sewa Tempat': 'Sewa tempat', 'Biaya Tagihan Bulanan': 'Listrik, air, internet & langganan', 'Biaya Marketing & Promosi': 'Marketing, promosi & event', 'Beban Perlengkapan': 'Perlengkapan', 'Biaya Operasional Harian': 'Operasional harian', 'Biaya Pemeliharaan': 'Pemeliharaan', 'Biaya Compliment': 'Compliment', 'Biaya R&D': 'Riset & pengembangan menu', 'Dana Sosial & CSR': 'Dana sosial & CSR', 'Beban Penyusutan Peralatan': 'Penyusutan peralatan' };
  const sd = d => (d ? 1 : null);
  return `<div class="tw"><table class="t rep">${hdr()}<tbody>
    ${hrow('Pendapatan usaha')}${rowM('Penjualan cafe', m => P(m).cafe, 'ind')}${rowM('Pendapatan event & non-cafe', m => P(m).non, 'ind')}
    ${rowM('Pendapatan kotor', m => P(m).kotor, 'sum')}${rowM('Dikurangi: pajak restoran (PBJT)', m => -P(m).pajak, 'ind')}${rowM('Pendapatan bersih', m => P(m).net, 'sum')}
    ${hrow('Beban pokok penjualan')}${rowM('Bahan baku', m => P(m).bb, 'ind')}${rowM('Penyajian & kemasan', m => P(m).saji, 'ind')}${rowM('Total beban pokok penjualan', m => P(m).hpp, 'sum')}
    ${rowM('Laba kotor', m => P(m).gross, 'grand')}${ratioRow('Margin laba kotor', p => p.net ? p.gross / p.net : null)}
    ${hrow('Beban usaha')}${op.map(a => rowM(LBL[a.name] || a.name, m => P(m).op[a.name], 'ind')).join('')}${rowM('Total beban usaha', m => P(m).bu, 'sum')}
    ${rowM('Laba (rugi) usaha', m => P(m).usaha, 'sum')}${rowM('EBITDA', m => P(m).ebitda, 'ind')}
    ${hrow('Pendapatan (beban) lain-lain')}${rowM('Pendapatan lain-lain', m => P(m).lainP, 'ind')}${rowM('Beban lain-lain', m => -P(m).lainB, 'ind')}
    ${rowM('Laba (rugi) bersih', m => P(m).np, 'grand')}${ratioRow('Margin laba bersih', p => p.net ? p.np / p.net : null)}
    ${hrow('Indikator biaya (terhadap pendapatan bersih)')}
    ${ratioRow('Food cost (HPP)', p => p.net ? p.hpp / p.net : null, LIM.food)}${ratioRow('Payroll (gaji)', p => p.net ? p.op['Beban Gaji'] / p.net : null, LIM.pay)}
    ${ratioRow('Occupancy (sewa)', p => p.net ? p.op['Biaya Sewa Tempat'] / p.net : null, LIM.occ)}${ratioRow('Prime cost (HPP + gaji)', p => p.net ? (p.hpp + p.op['Beban Gaji']) / p.net : null, LIM.prime)}
  </tbody></table></div>`;
}
function repNR() {
  const o = R.neraca.open, c = R.neraca.close;
  const r = (l, k, cls = '') => `<tr class="${cls}"><td class="${cls === 'ind' ? 'ind' : ''}">${l}</td><td class="r">${acct(o[k])}</td><td class="r">${acct(c[k])}</td></tr>`;
  const h = l => `<tr class="h"><td>${l}</td><td></td><td></td></tr>`;
  return `<div class="tw"><table class="t rep"><thead><tr><th>Keterangan</th><th class="r">1 Jan ${R.Y}</th><th class="r">${tgl(lastDayStr(R.BLN))}</th></tr></thead><tbody>
    ${h('Aset lancar')}${r('Kas tunai', 'kasT', 'ind')}${r('Kas di bank', 'kasB', 'ind')}${r('Kas kecil (warung)', 'kasW', 'ind')}${r('Piutang usaha', 'piut', 'ind')}${r('Piutang lain-lain', 'piutL', 'ind')}${r('Persediaan bahan baku', 'inv', 'ind')}${r('Perlengkapan', 'perl', 'ind')}${r('Beban dibayar di muka', 'dimuka', 'ind')}${r('Total aset lancar', 'al', 'sum')}
    ${h('Aset tidak lancar')}${r('Peralatan (harga perolehan)', 'alat', 'ind')}${r('Akumulasi penyusutan', 'akum', 'ind')}${r('Total aset tidak lancar', 'atl', 'sum')}
    ${r('Total aset', 'ta', 'grand')}
    ${h('Liabilitas jangka pendek')}${r('Utang usaha', 'uu', 'ind')}${r('Utang pajak daerah (PBJT)', 'upj', 'ind')}${r('Utang lain-lain', 'ul', 'ind')}${r('Total liabilitas jangka pendek', 'lp', 'sum')}
    ${h('Liabilitas jangka panjang')}${r('Utang usaha jangka panjang', 'ujp', 'ind')}${r('Total liabilitas', 'tl', 'sum')}
    ${h('Ekuitas')}${r('Modal pemilik', 'modal', 'ind')}${r('Prive (pengambilan pemilik)', 'prive', 'ind')}${r('Laba (rugi) tahun berjalan', 'lr', 'ind')}${r('Total ekuitas', 'te', 'sum')}
    ${r('Total liabilitas dan ekuitas', 'tle', 'grand')}${r('Cek keseimbangan (harus 0)', 'cek', 'ratio')}
  </tbody></table></div>`;
}
function repAK() {
  const g = l => m => R.cf[l][m], C = m => R.cfm[m];
  return `<div class="tw"><table class="t rep">${hdr()}<tbody>
    ${hrow('Arus kas dari aktivitas operasi')}${rowM('Penerimaan dari pelanggan', g('OP1'), 'ind')}${rowM('Penerimaan (pembayaran) lain-lain bersih', g('OP2'), 'ind')}${rowM('Pembayaran bahan baku & penyajian', g('OP3'), 'ind')}${rowM('Pembayaran gaji', g('OP4'), 'ind')}${rowM('Pembayaran sewa', g('OP5'), 'ind')}${rowM('Pembayaran beban operasional lainnya', g('OP6'), 'ind')}${rowM('Pembayaran pajak restoran (PBJT)', g('OP7'), 'ind')}${rowM('Kas bersih dari aktivitas operasi', m => C(m).op, 'sum')}
    ${hrow('Arus kas dari aktivitas investasi')}${rowM('Pembelian peralatan', g('IN1'), 'ind')}${rowM('Kas bersih dari aktivitas investasi', m => C(m).inv, 'sum')}
    ${hrow('Arus kas dari aktivitas pendanaan')}${rowM('Pengambilan pemilik (prive)', g('FN1'), 'ind')}${rowM('Setoran modal pemilik', g('FN2'), 'ind')}${rowM('Penerimaan (pembayaran) utang', g('FN3'), 'ind')}${rowM('Kas bersih dari aktivitas pendanaan', m => C(m).fin, 'sum')}
    ${rowM('Kenaikan (penurunan) kas bersih', m => C(m).naik, 'grand')}
    ${rowM('Kas awal periode', m => C(m).awal, 'ind', C(1).awal)}${rowM('Kas akhir periode', m => C(m).akhir, 'sum', C(R.BLN).akhir)}
  </tbody></table></div><p class="note" style="margin-top:10px">Disusun dari setiap transaksi yang melibatkan tepat satu akun kas, dikelompokkan menurut akun lawannya. Pindah dana antar-kas tidak dihitung.</p>`;
}
function repPE() {
  const P = m => R.pe[m];
  return `<div class="tw"><table class="t rep">${hdr()}<tbody>
    ${rowM('Ekuitas awal', m => P(m).awal, '', P(1).awal)}${rowM('Setoran modal', m => P(m).setor, 'ind')}${rowM('Laba (rugi) bersih', m => P(m).lb, 'ind')}${rowM('Prive (pengambilan pemilik)', m => P(m).prive, 'ind')}${rowM('Ekuitas akhir', m => P(m).akhir, 'grand', P(R.BLN).akhir)}
  </tbody></table></div>`;
}
function repNS() {
  let td = 0, tc = 0;
  const rows = R.ns.map(a => { td += a.dr; tc += a.cr; return `<tr><td class="mono">${a.code}</td><td>${esc(a.name)}</td><td class="r">${a.dr ? f0(a.dr) : ''}</td><td class="r">${a.cr ? f0(a.cr) : ''}</td></tr>`; }).join('');
  return `<div class="tw"><table class="t rep"><thead><tr><th>Kode</th><th>Nama akun</th><th class="r">Saldo debet</th><th class="r">Saldo kredit</th></tr></thead><tbody>${rows}
    <tr class="grand"><td></td><td>Total</td><td class="r">${f0(td)}</td><td class="r">${f0(tc)}</td></tr></tbody></table></div>`;
}
function repBB() {
  const a = R.A[ui.bb], debN = a.normal === 'D';
  const rows = R.all.filter(j => j.m <= R.BLN && (j.deb === ui.bb || j.kre === ui.bb))
    .sort((x, y) => x.d.localeCompare(y.d) || (y.kind === 'UMUM') - (x.kind === 'UMUM'));
  let bal = a.ob, td = 0, tc = 0;
  const body = rows.map(j => {
    const dr = j.deb === ui.bb ? j.nom : 0, cr = j.kre === ui.bb ? j.nom : 0; td += dr; tc += cr;
    bal += debN ? dr - cr : cr - dr;
    return `<tr><td class="acc">${tgl(j.d)}</td><td class="mono acc">${j.kind === 'UMUM' ? esc(j.no) : 'otomatis'}</td><td class="ket">${esc(j.ket)}</td><td class="acc">${esc(dr ? j.kre : j.deb)}</td><td class="r">${dr ? f0(dr) : ''}</td><td class="r">${cr ? f0(cr) : ''}</td><td class="r">${acct(bal)}</td></tr>`;
  }).join('');
  return `<div class="toolbar"><label class="fld" style="max-width:360px">Akun<select id="bb-acct" data-act="bb">${acctOptions(ui.bb)}</select></label>
    <div class="sumstrip" style="margin:0"><span>Saldo normal<b>${debN ? 'Debet' : 'Kredit'}</b></span><span>Total debet<b>${f0(td)}</b></span><span>Total kredit<b>${f0(tc)}</b></span><span>Saldo akhir<b>${acct(bal)}</b></span></div></div>
    <div class="tw"><table class="t rep"><thead><tr><th>Tanggal</th><th>No. bukti</th><th>Keterangan</th><th>Akun lawan</th><th class="r">Debet</th><th class="r">Kredit</th><th class="r">Saldo</th></tr></thead><tbody>
    <tr class="h"><td>1 Jan</td><td></td><td>Saldo awal</td><td></td><td></td><td></td><td class="r">${acct(a.ob)}</td></tr>${body}</tbody></table></div>`;
}

/* ---------- aset ---------- */
function vAset() {
  const as = R.assets, tc = as.reduce((s, a) => s + a.cost, 0), tk = as.reduce((s, a) => s + a.akum, 0);
  return ['Aset tetap', `${as.length} aset · garis lurus, mulai bulan setelah perolehan`, `
    <div class="tw"><table class="t rep"><thead><tr><th>Nama aset</th><th>Diperoleh</th><th class="r">Harga</th><th class="r">Masa (thn)</th><th>Mulai susut</th><th class="r">Per bulan</th><th class="r">Akum. s.d. ${BLN3[R.BLN - 1] || '–'}</th><th class="r">Nilai buku</th></tr></thead><tbody>
    ${as.map(a => `<tr><td>${esc(a.name)}</td><td class="acc">${tgl(a.date)}</td><td class="r">${f0(a.cost)}</td><td class="r">${a.life}</td><td class="acc">${tgl(a.start)}</td><td class="r">${f0(a.per)}</td><td class="r">${f0(a.akum)}</td><td class="r">${f0(a.book)}</td></tr>`).join('')}
    <tr class="grand"><td>Total</td><td></td><td class="r">${f0(tc)}</td><td></td><td></td><td></td><td class="r">${f0(tk)}</td><td class="r">${f0(tc - tk)}</td></tr></tbody></table></div>
    <p class="note" style="margin-top:10px">Penyusutan per bulan masuk ke jurnal otomatis saat tutup buku. Aset sebelum 2026 belum diinventarisasi.</p>`];
}

/* ---------- tutup buku ---------- */
function opsHistory() {
  const rows = [];
  for (let m = 1; m <= Math.min(12, R.BLN + 1); m++) {
    const o = R.opsCheck[m];
    const v = x => x == null ? '<span class="note">–</span>' : f0(x);
    const d = (x, flag) => x == null ? '<span class="note">–</span>' : `<span class="${flag ? 'neg' : ''}">${acct(x)}${flag ? ' !' : ''}</span>`;
    rows.push(`<tr><td>${BLN3[m - 1]}${m > R.BLN ? ' <span class="pill wait">berjalan</span>' : ''}</td><td class="r">${v(o.stock)}</td><td class="r">${v(o.purch)}</td><td class="r">${f0(o.kPurch)}</td><td class="r">${d(o.dP, o.flagP)}</td><td class="r">${v(o.sales)}</td><td class="r">${f0(o.omzet)}</td><td class="r">${d(o.dS, o.flagS)}</td></tr>`);
  }
  return `<section class="panel"><h2>Riwayat cek dengan Parang-ops</h2><p class="hint">Angka Parang-ops diinput manual saat tutup buku. Jan–Sep kosong karena belum ada data. Tanda ! = melewati toleransi (pembelian ${pct(R.tolP, 0)}, omzet ${pct(R.tolS, 0)}).</p>
    <div class="tw"><table class="t rep"><thead><tr><th>Bulan</th><th class="r">Nilai stok (Ops)</th><th class="r">Pembelian (Ops)</th><th class="r">Pembelian (Keuangan)</th><th class="r">Selisih</th><th class="r">Penjualan (Ops)</th><th class="r">Omzet tercatat</th><th class="r">Selisih</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></section>`;
}
function vTutup() {
  const next = R.BLN + 1;
  if (next > 12) return ['Tutup buku', 'Tahun buku sudah ditutup seluruhnya', '<p class="note">Semua bulan sudah ditutup.</p>' + opsHistory()];
  const days = R.days.filter(r => r.m === next && r.x.tot && r.x.st !== 'OK');
  const prev = compute({ ...st, bln: next });
  const autos = prev.auto.filter(j => j.m === next);
  const o = st.ops[next] || {}, oc = prev.opsCheck[next];
  const opsOk = o.stock != null && o.purch != null;
  const ackDays = !days.length || ui.ack.days, ready = ui.ack.rutin && ackDays && opsOk;
  const need = [!ui.ack.rutin && 'centang tagihan rutin', !ackDays && 'konfirmasi hari yang belum OK', !opsOk && 'isi nilai stok dan pembelian dari Parang-ops'].filter(Boolean);
  const cmp = opsOk ? `<div class="calc" style="margin-top:10px">
      <span>Pembelian Parang-ops</span><span>${f0(oc.purch)}</span><span>Pembelian di jurnal Keuangan</span><span>${f0(oc.kPurch)}</span>
      <span class="big">Selisih pembelian</span><span class="big ${oc.flagP ? 'neg' : 'pos'}">${acct(oc.dP)}</span>
      ${oc.sales != null ? `<span>Penjualan Parang-ops</span><span>${f0(oc.sales)}</span><span>Omzet tercatat Keuangan</span><span>${f0(oc.omzet)}</span><span class="big">Selisih omzet</span><span class="big ${oc.flagS ? 'neg' : 'pos'}">${acct(oc.dS)}</span>` : ''}
    </div><p class="note" style="margin-top:6px">${oc.flagP || oc.flagS ? 'Selisih melewati toleransi. Cek nota yang hanya dicatat di satu aplikasi atau beda tanggal. Tutup buku tetap bisa dilanjutkan.' : 'Selisih masih dalam toleransi.'}</p>` : '';
  const reopen = R.BLN > 1 ? `<section class="panel"><h2>Buka kembali ${BULAN[R.BLN - 1]}</h2><p class="hint">Dipakai jika ada koreksi di bulan yang sudah ditutup. Tercatat di riwayat perubahan.</p>
    ${ui.confirmReopen ? `<div class="btns"><span class="note">Yakin membuka kembali ${BULAN[R.BLN - 1]} ${R.Y}?</span><button class="btn danger" data-act="reopen">Ya, buka kembali</button><button class="btn ghost" data-act="reopenno">Batal</button></div>` : `<button class="btn ghost" data-act="reopenask">Buka kembali ${BULAN[R.BLN - 1]} ${R.Y}</button>`}</section>` : '';
  return ['Tutup buku', `Bulan berikutnya: ${BULAN[next - 1]} ${R.Y}`, `<div class="two"><section class="panel"><div class="steps">
    <div class="step"><div><h3>Periksa omzet harian</h3>
      ${days.length ? `<p class="note">${days.length} hari di ${BULAN[next - 1]} belum berstatus OK:</p><div class="daylist">${days.map(r => `<span class="pill ${stClass(r.x.st)}">${tgl(r.d)} · ${r.x.st}</span>`).join('')}</div>
      <label class="check" style="margin-top:8px"><input type="checkbox" id="ack-days" data-ack="days" ${ui.ack.days ? 'checked' : ''}> Saya mengerti dan tetap ingin melanjutkan</label>` : '<p class="note">Semua hari buka berstatus OK.</p>'}</div></div>
    <div class="step"><div><h3>Pastikan tagihan rutin sudah dijurnal</h3><label class="check"><input type="checkbox" id="ack-rutin" data-ack="rutin" ${ui.ack.rutin ? 'checked' : ''}> Gaji, sewa, listrik, air, dan internet bulan ${BULAN[next - 1]} sudah dicatat</label></div></div>
    <div class="step"><div><h3>Isi data setoran PBJT (SSPD)</h3><form class="f" data-form="sspd" data-m="${next}"><fieldset>
      <label class="fld">Omzet dilaporkan<input id="sp-rep" name="rep" class="money" inputmode="numeric" value="${st.reported[next] == null ? '' : f0(st.reported[next])}"></label>
      <label class="fld">PBJT dibayar<input id="sp-paid" name="paid" class="money" inputmode="numeric" value="${st.paid[next] == null ? '' : f0(st.paid[next])}"></label></fieldset>
      <div class="btns"><button class="btn ghost" type="submit">Simpan data SSPD</button></div></form></div></div>
    <div class="step"><div><h3>Salin 3 angka dari Parang-ops</h3><p class="note">Ambil setelah stok opname dan adjustment di Parang-ops selesai. Aplikasi ini tidak terhubung ke Parang-ops, jadi angkanya diketik.</p>
      <form class="f" data-form="ops" data-m="${next}" style="margin-top:8px"><fieldset>
      <label class="fld">Nilai stok akhir (wajib)<input id="op-stock" name="stock" class="money" inputmode="numeric" value="${o.stock == null ? '' : f0(o.stock)}"></label>
      <label class="fld">Total pembelian (wajib)<input id="op-purch" name="purch" class="money" inputmode="numeric" value="${o.purch == null ? '' : f0(o.purch)}"></label>
      <label class="fld">Total penjualan Majoo (opsional)<input id="op-sales" name="sales" class="money" inputmode="numeric" value="${o.sales == null ? '' : f0(o.sales)}"></label></fieldset>
      <div class="btns"><button class="btn ghost" type="submit">Simpan angka Parang-ops</button></div></form>${cmp}</div></div>
    <div class="step"><div><h3>Tutup buku</h3><p class="note">Sistem membuat jurnal otomatis (termasuk penyesuaian persediaan), menjalankan 4 cek kesehatan, lalu mengunci ${BULAN[next - 1]}.</p>
      <div class="btns"><button class="btn" data-act="close" ${ready ? '' : 'disabled'}>Tutup buku ${BULAN[next - 1]} ${R.Y}</button>${ready ? '' : `<span class="note">Belum bisa: ${need.join(', ')}.</span>`}</div></div></div>
  </div></section>
  <div class="grid"><section class="panel"><h2>Jurnal otomatis yang akan dibuat</h2><p class="hint">Bertanggal ${tgl(lastDayStr(next))}. Dihitung dari Omzet Harian, Aset Tetap, data SSPD, dan nilai stok Parang-ops.</p>
    <div class="tw"><table class="t"><thead><tr><th>Debet</th><th>Kredit</th><th class="r">Nominal</th></tr></thead><tbody>
    ${autos.map(j => `<tr><td>${esc(j.deb)}${j.inv ? ' <span class="pill adj">persediaan</span>' : ''}</td><td>${esc(j.kre)}</td><td class="r">${f0(j.nom)}</td></tr>`).join('')}</tbody></table></div>
    ${o.stock == null ? '<p class="note" style="margin-top:8px">Penyesuaian persediaan muncul setelah nilai stok Parang-ops diisi.</p>' : ''}
    <ul class="checks" style="margin-top:14px">${prev.checks.map(c => `<li><span class="dot ${c.ok ? 'ok' : 'bad'}">${c.ok ? '✓' : '!'}</span>${c.label}</li>`).join('')}</ul></section>${reopen}</div></div>
  <div style="margin-top:16px">${opsHistory()}</div>`];
}

/* ---------- events ---------- */
let toastT;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3200); }
function refresh() { R = compute(st); render(); }

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
  const a = b.dataset.act, v = b.dataset.v;
  if (a === 'nav') { ui.view = v; ui.sel = null; render(); window.scrollTo(0, 0); }
  else if (a === 'role') { ui.role = v; if (v !== 'kasir') ui.pinOk = false; ui.pinErr = ''; render(); }
  else if (a === 'om') { ui.om = +v; ui.sel = null; render(); }
  else if (a === 'day') { ui.sel = v; render(); const p = document.getElementById('daypanel'); if (p && window.innerWidth < 900) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  else if (a === 'closeday') { ui.sel = null; render(); }
  else if (a === 'rep') { ui.rep = v; render(); }
  else if (a === 'jnew') { ui.jForm = true; ui.jErr = ''; render(); document.getElementById('j-deb')?.focus(); }
  else if (a === 'jcancel') { ui.jForm = false; ui.jErr = ''; render(); }
  else if (a === 'jmore') { ui.jLimit += 100; render(); }
  else if (a === 'close') { const m = R.BLN + 1; st.bln = m; ui.ack = {}; refresh(); toast(`${BULAN[m - 1]} ${R.Y} ditutup. ${R.checks.every(c => c.ok) ? 'Semua cek kesehatan lolos.' : 'Ada cek yang gagal.'}`); }
  else if (a === 'reopenask') { ui.confirmReopen = true; render(); }
  else if (a === 'reopenno') { ui.confirmReopen = false; render(); }
  else if (a === 'reopen') { const m = R.BLN; st.bln = m - 1; ui.confirmReopen = false; refresh(); toast(`${BULAN[m - 1]} ${R.Y} dibuka kembali.`); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.jf) { ui.jf[t.dataset.jf] = t.value; ui.jLimit = 60; render(); }
  else if (t.dataset.act === 'bb') { ui.bb = t.value; render(); }
  else if (t.dataset.ack) { ui.ack[t.dataset.ack] = t.checked; render(); }
});
let qT;
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.jf === 'q') { clearTimeout(qT); qT = setTimeout(() => { ui.jf.q = t.value; ui.jLimit = 60; render(); const q = document.getElementById('jf-q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); return; }
  const f = t.closest('form[data-form="day"]');
  if (f) { const base = st.daily.find(r => r.d === f.dataset.d); document.getElementById('calc').innerHTML = calcHtml(calcDay({ ...base, ...readForm(f) })); }
});
document.addEventListener('focusout', e => { const t = e.target; if (t.classList && t.classList.contains('money') && !t.disabled) { const v = parseMoney(t.value); t.value = v == null ? '' : f0(v); } });
document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, kind = f.dataset.form;
  if (kind === 'day' || kind === 'kasir' || kind === 'setor') {
    const r = st.daily.find(x => x.d === f.dataset.d);
    Object.assign(r, readForm(f));
    refresh(); toast(`Omzet ${tgl(r.d)} tersimpan. Status: ${calcDay(r).st || 'kosong'}.`);
  } else if (kind === 'jurnal') {
    const fd = Object.fromEntries(new FormData(f)), nom = parseMoney(fd.nom), m = +String(fd.date).slice(5, 7);
    let err = '';
    if (!fd.date || String(fd.date).slice(0, 4) !== String(R.Y)) err = `Tanggal harus di tahun buku ${R.Y}.`;
    else if (m <= R.BLN) err = `Bulan ${BULAN[m - 1]} sudah ditutup. Minta owner membuka kembali bulan itu, atau pakai tanggal di bulan berjalan.`;
    else if (!fd.deb || !fd.kre) err = 'Pilih akun debet dan akun kredit.';
    else if (fd.deb === fd.kre) err = 'Akun debet dan akun kredit tidak boleh sama.';
    else if (!nom || nom <= 0) err = 'Nominal harus lebih dari 0.';
    else if (!String(fd.ket).trim()) err = 'Isi keterangan agar transaksi mudah dicari nanti.';
    if (err) { ui.jErr = err; const keep = fd; render(); restoreJ(keep); return; }
    const maxNo = Math.max(...st.journal.map(j => +String(j[0]).replace(/\D/g, '') || 0));
    const no = 'JU-' + String(maxNo + 1).padStart(4, '0');
    st.journal.push([no, fd.date, fd.deb, fd.kre, nom, String(fd.ket).trim(), fd.tag || '', String(fd.sub || '').trim(), String(fd.nota || '').trim()]);
    ui.jForm = false; ui.jErr = ''; refresh(); toast(`Tersimpan sebagai ${no}.`);
  } else if (kind === 'ops') {
    const m = +f.dataset.m, o = readForm(f);
    st.ops[m] = { stock: o.stock, purch: o.purch, sales: o.sales };
    refresh(); toast(`Angka Parang-ops ${BULAN[m - 1]} tersimpan.`);
  } else if (kind === 'pin') {
    const v = new FormData(f).get('pin');
    if (v === DEMO_PIN) { ui.pinOk = true; ui.pinErr = ''; render(); toast('Masuk sebagai kasir.'); }
    else { ui.pinErr = 'PIN salah. Coba lagi.'; render(); document.getElementById('pin')?.focus(); }
  } else if (kind === 'sspd') {
    const m = +f.dataset.m, o = readForm(f);
    st.reported[m] = o.rep; if (o.paid == null) delete st.paid[m]; else st.paid[m] = o.paid;
    refresh(); toast(`Data SSPD ${BULAN[m - 1]} tersimpan.`);
  }
});
function restoreJ(fd) {
  const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
  set('j-nota', fd.nota); set('j-date', fd.date); set('j-deb', fd.deb); set('j-kre', fd.kre); set('j-nom', fd.nom); set('j-ket', fd.ket); set('j-tag', fd.tag); set('j-sub', fd.sub);
}

render();
})();
