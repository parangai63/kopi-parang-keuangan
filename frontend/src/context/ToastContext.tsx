import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type Kind = "ok" | "error";
const ToastContext = createContext<(msg: string, kind?: Kind) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: Kind } | null>(null);
  const timer = useRef<number>();

  const show = useCallback((msg: string, kind: Kind = "ok") => {
    setToast({ msg, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg max-w-[calc(100vw-32px)] ${
            toast.kind === "ok" ? "bg-parang-text text-white" : "bg-accent-danger text-white"
          }`}
        >
          {toast.kind === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
