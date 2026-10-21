import { useEffect, useState } from "react";
import { dailyApi } from "../api";
import { NAV, PageId } from "../types/navigation";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "./ui";

/** Sidebar gelap dengan merek motif batik soga (rancangan original). Di HP menjadi bar atas dengan nav geser. */
export default function Sidebar({ active, onNavigate }: { active: PageId; onNavigate: (p: PageId) => void }) {
  const { user } = useAuth();
  const [notOk, setNotOk] = useState(0);
  const running = user && user.closedMonth < 12 ? user.closedMonth + 1 : null;
  const canSeeDaily = user != null && user.role !== "KASIR";

  // Lencana merah di menu Omzet Harian: jumlah hari bulan berjalan yang statusnya belum OK.
  useEffect(() => {
    if (!canSeeDaily || !running) return setNotOk(0);
    let alive = true;
    dailyApi.month(running).then((d) => alive && setNotOk(d.summary.notOkDays)).catch(() => undefined);
    return () => { alive = false; };
  }, [canSeeDaily, running, active]);

  if (!user) return null;
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <aside className="side">
      <div className="brand">
        <div className="mark" aria-hidden="true" />
        <div>
          <b>Kopi Parang</b>
          <span>Keuangan {user.fiscalYear}</span>
        </div>
      </div>
      <nav className="nav" aria-label="Menu utama">
        {items.map((n) => (
          <button key={n.id} onClick={() => onNavigate(n.id)} aria-current={n.id === active ? "page" : undefined}>
            {n.label}
            {n.id === "omzet" && notOk > 0 && <span className="count">{notOk}</span>}
          </button>
        ))}
      </nav>
      <div className="side-foot">
        <div className="side-user">
          <b>{user.name}</b>
          <span>{ROLE_LABEL[user.role]}</span>
        </div>
        Aplikasi terpisah dari Parang-ops dan Majoo. Tidak ada koneksi otomatis; angka Parang-ops diketik manual saat tutup buku.
      </div>
    </aside>
  );
}
