import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import { Loading } from "./components/ui";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { NAV, PageId } from "./types/navigation";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import DailySalesPage from "./pages/DailySales";
import KasirPage from "./pages/Kasir";
import JournalPage from "./pages/Journal";
import ReportsPage from "./pages/Reports";
import AssetsPage from "./pages/Assets";
import PartiesPage from "./pages/Parties";
import ClosingPage from "./pages/Closing";
import SettingsPage from "./pages/Settings";
import UsersPage from "./pages/Users";

function AppContent() {
  const { user, checking } = useAuth();
  const [page, setPage] = useState<PageId>("dashboard");

  // Pastikan halaman aktif diizinkan untuk peran yang sedang login.
  useEffect(() => {
    if (!user) return;
    const allowed = NAV.filter((n) => n.roles.includes(user.role));
    if (!allowed.some((n) => n.id === page)) setPage(allowed[0].id);
  }, [user, page]);

  if (checking) return <Loading label="Memeriksa sesi…" />;
  if (!user) return <LoginPage />;

  return (
    <div className="md:flex min-h-screen bg-parang-bg">
      <Sidebar active={page} onNavigate={setPage} />
      <main className="flex-1 min-w-0 px-4 py-5 md:px-8 md:py-7">
        {(() => {
          switch (page) {
            case "kasir":
              return <KasirPage />;
            case "omzet":
              return <DailySalesPage />;
            case "jurnal":
              return <JournalPage />;
            case "laporan":
              return <ReportsPage />;
            case "aset":
              return <AssetsPage />;
            case "pihak":
              return <PartiesPage />;
            case "tutup-buku":
              return <ClosingPage />;
            case "pengaturan":
              return <SettingsPage />;
            case "pengguna":
              return <UsersPage />;
            case "dashboard":
            default:
              return <DashboardPage onNavigate={setPage} />;
          }
        })()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
