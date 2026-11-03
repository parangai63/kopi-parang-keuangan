import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { dailyApi } from "../api";
import { NAV, PageId } from "../types/navigation";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "./ui";

/** Sidebar gelap dengan merek motif batik soga (rancangan original). Di layar kecil menjadi bar atas dengan tombol hamburger yang membuka menu. */
export default function Sidebar({ active, onNavigate }: { active: PageId; onNavigate: (p: PageId) => void }) {
  const { user } = useAuth();
  const [notOk, setNotOk] = useState(0);
  const [open, setOpen] = useState(false);
  const running = user && user.closedMonth < 12 ? user.closedMonth + 1 : null;
  const canSeeDaily = user != null && user.role !== "KASIR";

  // Lencana merah di menu Omzet Harian: jumlah hari bulan berjalan yang statusnya belum OK.
  useEffect(() => {
    if (!canSeeDaily || !running) return setNotOk(0);
    let alive = true;
    dailyApi.month(running).then((d) => alive && setNotOk(d.summary.notOkDays)).catch(() => undefined);
    return () => { alive = false; };
  }, [canSeeDaily, running, active]);

  // Menu hamburger: tutup dengan Escape, dan otomatis tertutup bila layar dilebarkan.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const mq = window.matchMedia("(min-width: 821px)");
    const onWide = () => mq.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => {
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
    };
  }, [open]);

  if (!user) return null;
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <>
      <aside className={`side${open ? " open" : ""}`}>
        <div className="side-bar">
          <div className="brand">
            <div className="mark" aria-hidden="true" />
            <div>
              <b>Kopi Parang</b>
              <span>Keuangan {user.fiscalYear}</span>
            </div>
          </div>
          <button className="burger" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="menu-utama" aria-label={open ? "Tutup menu" : "Buka menu"}>
            {open ? <X /> : <Menu />}
            {!open && notOk > 0 && <span className="dot" aria-hidden="true" />}
          </button>
        </div>
        <nav className="nav" id="menu-utama" aria-label="Menu utama">
          {items.map((n) => (
            <button key={n.id} onClick={() => { setOpen(false); onNavigate(n.id); }} aria-current={n.id === active ? "page" : undefined}>
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
      {open && <div className="side-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
    </>
  );
}
