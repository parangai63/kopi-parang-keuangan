import { BookOpen, Building2, Calculator, CalendarDays, FileBarChart, LayoutDashboard, LogOut, Lock, Settings, ShieldCheck, Smartphone, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NAV, PageId } from "../types/navigation";
import { useAuth } from "../context/AuthContext";

const ICON: Record<PageId, LucideIcon> = {
  dashboard: LayoutDashboard,
  kasir: Smartphone,
  omzet: CalendarDays,
  jurnal: BookOpen,
  laporan: FileBarChart,
  aset: Building2,
  pihak: Users,
  "tutup-buku": Lock,
  pengaturan: Settings,
  pengguna: ShieldCheck,
};

const ROLE_LABEL = { OWNER: "Owner", ADMIN: "Admin keuangan", KASIR: "Kasir" } as const;

export default function Sidebar({ active, onNavigate }: { active: PageId; onNavigate: (p: PageId) => void }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <aside className="md:w-60 md:min-h-screen bg-parang-sidebar border-b md:border-b-0 md:border-r border-parang-divider md:flex md:flex-col">
      <div className="flex items-center gap-2 px-4 py-3 md:py-5">
        <div className="w-8 h-8 rounded-lg bg-parang-text text-white grid place-items-center">
          <Calculator className="w-4 h-4" />
        </div>
        <div className="leading-tight flex-1">
          <div className="text-sm font-bold text-parang-text">Kopi Parang</div>
          <div className="text-[11px] text-parang-subtle">Keuangan</div>
        </div>
        <button className="md:hidden text-parang-subtle" onClick={logout} aria-label="Keluar">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
      <nav aria-label="Menu utama" className="flex md:flex-col gap-1 overflow-x-auto px-2 pb-2 md:pb-0 md:flex-1">
        {items.map((n) => {
          const Icon = ICON[n.id];
          const on = n.id === active;
          return (
            <button
              key={n.id}
              onClick={() => onNavigate(n.id)}
              aria-current={on ? "page" : undefined}
              className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm ${
                on ? "bg-info-container text-accent-primaryDeep font-semibold" : "text-parang-neutral hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" /> {n.label}
            </button>
          );
        })}
      </nav>
      <div className="hidden md:block border-t border-parang-divider p-4 text-xs">
        <div className="font-semibold text-parang-text">{user.name}</div>
        <div className="text-parang-subtle">{ROLE_LABEL[user.role]}</div>
        <button className="mt-3 flex items-center gap-1.5 text-parang-subtle hover:text-parang-text" onClick={logout}>
          <LogOut className="w-3.5 h-3.5" /> Keluar
        </button>
        <p className="mt-4 text-[11px] leading-snug text-parang-subtle">
          Aplikasi terpisah dari Parang-ops dan Majoo. Tidak ada koneksi otomatis.
        </p>
      </div>
    </aside>
  );
}
