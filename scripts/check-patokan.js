#!/usr/bin/env node
// Uji angka patokan Kopi Parang Keuangan terhadap Excel v2 (tutup buku September 2026),
// plus skenario tutup buku dengan angka Parang-ops (penyesuaian persediaan & cek pembelian).
// Jalankan dari root repo: node scripts/check-patokan.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { compute } = require('../prototype/engine.js');

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../prototype/data.js'), 'utf8'), ctx);
const D = ctx.window.KP_DATA;

// Bentuk state sama dengan prototype/app.js
const makeState = () => ({
  settings: { ...D.settings, tolP: 0.05, tolS: 0.02 }, bln: D.settings.bln, accounts: D.accounts, assets: D.assets,
  paid: { ...D.paid }, reported: {}, ops: {},
  daily: D.daily.map(r => ({ d: r[0], c: r[1], e: r[2], s1: r[3], s2: r[4], es: r[5], bon: r[6], comp: r[7], own: r[8], items: r[9], trx: r[10] })),
  journal: D.journal.slice(),
});

const fmt = n => new Intl.NumberFormat('id-ID').format(n);
let fail = 0;
const check = (label, got, want) => {
  const ok = Math.round(got) === want;
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'BEDA'}  ${label.padEnd(46)} ${fmt(Math.round(got)).padStart(14)}${ok ? '' : `  (harusnya ${fmt(want)})`}`);
};

console.log('== Angka patokan Excel v2 (tutup buku September 2026) ==');
const R = compute(makeState());
const N = R.neraca.close;
check('Pendapatan bersih Jan–Sep', R.plTot.net, 795505902);
check('Laba kotor Jan–Sep', R.plTot.gross, 456926368);
check('Laba (rugi) bersih Jan–Sep', R.plTot.np, -54996702);
check('Total aset 30 Sep', N.ta, 101739014);
check('Total liabilitas 30 Sep', N.tl, 74619781);
check('Total ekuitas 30 Sep', N.te, 27119233);
check('Kas tunai 30 Sep', N.kasT, 51913400);
check('Kas bank 30 Sep', N.kasB, -2739792);
check('Kas warung 30 Sep', N.kasW, 4108000);
check('Akumulasi penyusutan 30 Sep', -N.akum, 2564119);
check('Omzet bersih per hari buka', R.perDay, 3179317);
for (const c of R.checks) { if (!c.ok) fail++; console.log(`${c.ok ? 'OK  ' : 'BEDA'}  Cek: ${c.label}`); }

console.log('\n== Skenario: tutup buku Oktober & November dengan angka Parang-ops ==');
// Angka contoh, bukan data asli Parang-ops.
const s = makeState();
s.bln = 11;
s.ops = { 10: { stock: 12500000, purch: 17200000, sales: 33100000 }, 11: { stock: 11000000, purch: 1000 } };
const R2 = compute(s);
const inv = R2.auto.filter(j => j.inv);
check('Saldo Inventori 30 Nov = nilai stok Nov', R2.end('Inventori'), 11000000);
check('Penyesuaian Okt (Dr Inventori)', inv.find(j => j.m === 10 && j.deb === 'Inventori').nom, 12500000);
check('Penyesuaian Nov (Cr Inventori)', inv.find(j => j.m === 11 && j.kre === 'Inventori').nom, 1500000);
check('Laba bersih Jan–Sep tidak berubah', R2.pl.slice(1, 10).reduce((a, p) => a + p.np, 0), -54996702);
check('Pembelian bahan Okt menurut jurnal Keuangan', R2.opsCheck[10].kPurch, 16798420);
const okFlag = R2.opsCheck[10].flagP === false && R2.opsCheck[11].flagP === true;
if (!okFlag) fail++;
console.log(`${okFlag ? 'OK  ' : 'BEDA'}  Tanda selisih pembelian: Okt dalam toleransi, Nov melewati`);
for (const c of R2.checks) { if (!c.ok) fail++; console.log(`${c.ok ? 'OK  ' : 'BEDA'}  Cek: ${c.label}`); }

console.log(fail ? `\n${fail} angka tidak cocok.` : '\nSemua angka cocok dengan Excel v2, dan skenario Parang-ops lolos.');
process.exit(fail ? 1 : 0);
