import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";

type Kind = "ok" | "error";
const ToastContext = createContext<(msg: string, kind?: Kind) => void>(() => undefined);

/** Toast di bawah tengah layar (gaya #toast rancangan original); error berlatar merah. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: Kind } | null>(null);
  const timer = useRef<number>();

  const show = useCallback((msg: string, kind: Kind = "ok") => {
    setToast({ msg, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div id="toast" role="status" aria-live="polite" hidden={!toast} className={toast?.kind === "error" ? "error" : ""}>
        {toast?.msg}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
