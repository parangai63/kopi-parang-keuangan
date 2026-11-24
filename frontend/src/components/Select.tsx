import { KeyboardEvent, ReactNode, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, Search, Trash2 } from "lucide-react";

export interface SelectOption<V extends string | number> {
  value: V;
  label: string;
  /** judul kelompok (mis. ASET, LIABILITAS); opsi berurutan dengan grup sama ditampilkan di bawah satu judul */
  group?: string;
  /** teks kecil di kanan, mis. kode akun */
  hint?: string;
}

/** Menambah (dan opsional menghapus) opsi langsung dari dropdown: ketik nama di kotak cari, lalu klik "Tambah";
 * ikon tong sampah di tiap opsi untuk menghapus, dengan konfirmasi di baris itu juga. */
export interface SelectCreate<V> {
  /** nama jenis data untuk teks bantuan, mis. "event", "pihak", "karyawan" */
  noun: string;
  /** bila ada, tombol tambah dipecah per jenis (mis. jenis pihak) */
  types?: { value: string; label: string }[];
  /** simpan ke server, kembalikan value opsi baru; daftar opsi dimuat ulang oleh pemanggil */
  onCreate: (name: string, type?: string) => Promise<V>;
  /** hapus opsi di server; kembalikan pesan hasil (mis. "dinonaktifkan karena sudah dipakai"); daftar dimuat ulang oleh pemanggil */
  onRemove?: (value: V, label: string) => Promise<string | void>;
  /** opsi mana yang boleh dihapus (bawaan: semua) */
  canRemove?: (value: V) => boolean;
}

interface Props<V extends string | number> {
  value: V | "";
  options: SelectOption<V>[];
  onChange: (value: V | "") => void;
  /** teks saat kosong; bila `allowEmpty`, juga menjadi opsi pertama untuk mengosongkan pilihan */
  placeholder?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  /** md = di form (.fld), mini = di dalam tabel, chip = di chip header */
  size?: "md" | "mini" | "chip";
  /** kotak cari; bawaan: aktif bila opsi > 7 atau bisa menambah opsi */
  searchable?: boolean;
  create?: SelectCreate<V>;
  ariaLabel?: string;
  id?: string;
  className?: string;
}

const norm = (s: string) => s.toLocaleLowerCase("id-ID").normalize("NFKD").replace(/\s+/g, " ").trim();
const POP_MAX = 300;
/** Lebar maksimum daftar opsi (px); lebih dari ini nama opsi turun baris. */
const POP_MAX_WIDTH = 560;

/**
 * Dropdown aplikasi (pengganti <select>): tampilan seragam, kotak cari, kelompok opsi, navigasi keyboard,
 * dan opsional menambah opsi baru. Daftar dirender di portal (position: fixed) supaya tidak terpotong
 * oleh wadah tabel yang bisa digulir.
 */
export default function Select<V extends string | number>({
  value, options, onChange, placeholder = "Pilih…", allowEmpty, disabled, size = "md", searchable, create, ariaLabel, id, className = "",
}: Props<V>) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{
    left: number; width: number | null; minWidth: number; maxWidth: number; top?: number; bottom?: number; maxHeight: number;
  } | null>(null);
  // Lebar daftar hasil ukur saat dibuka (null = belum diukur → render "max-content" dulu, lalu dikunci).
  const widthRef = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [createErr, setCreateErr] = useState("");
  // Opsi yang baru ditambah: labelnya dipakai sampai daftar dari server dimuat ulang.
  const [created, setCreated] = useState<SelectOption<V> | null>(null);
  // Opsi yang baru dihapus: disembunyikan sampai daftar dari server dimuat ulang.
  const [removed, setRemoved] = useState<(V | "")[]>([]);
  // Opsi yang sedang dikonfirmasi untuk dihapus (konfirmasi tampil di baris opsi itu).
  const [confirmDel, setConfirmDel] = useState<V | "" | null>(null);
  const [notice, setNotice] = useState("");

  const showSearch = searchable ?? (options.length > 7 || !!create);
  const all = useMemo(() => {
    const withNew = created && !options.some((o) => o.value === created.value) ? [...options, created] : options;
    const base = removed.length ? withNew.filter((o) => !removed.includes(o.value)) : withNew;
    return allowEmpty ? [{ value: "" as V | "", label: placeholder } as SelectOption<V | "">, ...base] : (base as SelectOption<V | "">[]);
  }, [options, created, removed, allowEmpty, placeholder]);
  const removable = (v: V | "") => v !== "" && !!create?.onRemove && (create.canRemove?.(v as V) ?? true);
  const q = norm(query);
  const shown = q ? all.filter((o) => o.value !== "" && norm(`${o.hint ?? ""} ${o.label}`).includes(q)) : all;
  const exact = q && all.some((o) => norm(o.label) === q);
  const selected = all.find((o) => o.value === value && o.value !== "");

  function place() {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Lebar mengikuti opsi terpanjang: minimal selebar pemicu (dan cukup untuk tombol tambah),
    // maksimal POP_MAX_WIDTH atau lebar layar.
    const maxWidth = Math.min(POP_MAX_WIDTH, vw - 16);
    const minWidth = Math.min(Math.max(r.width, create ? 240 : 160), maxWidth);
    const width = widthRef.current;
    const left = Math.min(Math.max(8, r.left), vw - (width ?? minWidth) - 8);
    const below = vh - r.bottom - 8;
    const above = r.top - 8;
    const base = { left, width, minWidth, maxWidth };
    if (below < 220 && above > below) setPos({ ...base, bottom: vh - r.top + 4, maxHeight: Math.min(POP_MAX + 90, above - 4) });
    else setPos({ ...base, top: r.bottom + 4, maxHeight: Math.min(POP_MAX + 90, below - 4) });
  }

  function openPop() {
    if (disabled) return;
    setQuery("");
    setCreateErr("");
    setNotice("");
    setConfirmDel(null);
    const i = all.findIndex((o) => o.value === value);
    setActive(i < 0 ? 0 : i);
    widthRef.current = null;
    place();
    setOpen(true);
  }

  function close(focusTrigger = true) {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  function pick(o: SelectOption<V | "">) {
    onChange(o.value);
    close();
  }

  async function add(type?: string) {
    if (!create || !query.trim() || busy) return;
    setBusy(true);
    setCreateErr("");
    try {
      const name = query.trim();
      const v = await create.onCreate(name, type);
      setCreated({ value: v, label: name });
      onChange(v);
      close();
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Gagal menambah.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(o: SelectOption<V | "">) {
    if (!create?.onRemove || o.value === "" || busy) return;
    setBusy(true);
    setCreateErr("");
    setNotice("");
    try {
      const msg = await create.onRemove(o.value as V, o.label);
      setRemoved((r) => [...r, o.value]);
      if (created?.value === o.value) setCreated(null);
      if (value === o.value) onChange("");
      setConfirmDel(null);
      setNotice(msg || `“${o.label}” dihapus.`);
      setActive((a) => Math.max(0, Math.min(a, shown.length - 2)));
      (showSearch ? searchRef.current : listRef.current)?.focus();
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Gagal menghapus.");
    } finally {
      setBusy(false);
    }
  }

  // Ukur lebar alami daftar (max-content) sekali saat dibuka, lalu kunci supaya tidak berubah-ubah saat mengetik
  // di kotak cari; posisi kiri dihitung ulang agar tidak keluar layar.
  useLayoutEffect(() => {
    if (!open || !pos || widthRef.current !== null || !popRef.current) return;
    widthRef.current = Math.ceil(popRef.current.getBoundingClientRect().width);
    place();
  }, [open, pos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fokus ke kotak cari (atau daftar) saat terbuka.
  useLayoutEffect(() => {
    if (!open) return;
    (showSearch ? searchRef.current : listRef.current)?.focus();
  }, [open, showSearch]);

  // Tutup bila klik di luar; ikuti posisi pemicu saat halaman digulir atau ukuran layar berubah.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    const onMove = () => place();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Jaga opsi aktif tetap terlihat.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // Saat mengetik: sorot hasil pertama. Kotak cari dikosongkan: kembali ke opsi terpilih.
  useEffect(() => {
    setActive(query ? 0 : Math.max(0, all.findIndex((o) => o.value === value)));
    setConfirmDel(null);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  function onKey(e: KeyboardEvent) {
    if (confirmDel !== null && (e.key === "Escape" || e.key === "Enter")) {
      // Saat konfirmasi hapus: Enter = hapus, Esc = batal (dropdown tetap terbuka).
      e.preventDefault();
      const o = all.find((x) => x.value === confirmDel);
      if (e.key === "Enter" && o) remove(o);
      else setConfirmDel(null);
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close(false);
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[active]) pick(shown[active]);
      else if (create && !create.types && query.trim() && !exact) add();
    }
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); openPop(); }
  }

  // Kelompokkan opsi yang tampil, dengan indeks global untuk navigasi keyboard.
  const rows: ReactNode[] = [];
  let lastGroup: string | undefined;
  shown.forEach((o, i) => {
    if (o.group && o.group !== lastGroup) rows.push(<li key={`g-${o.group}-${i}`} className="sel-group" role="presentation">{o.group}</li>);
    lastGroup = o.group;
    const isSel = o.value === value || (o.value === "" && value === "");
    if (confirmDel !== null && o.value === confirmDel) {
      rows.push(
        <li key={`o-${String(o.value)}`} id={`${listId}-${i}`} data-i={i} role="option" aria-selected={isSel} className="sel-opt sel-confirm active"
          onMouseDown={(e) => e.preventDefault()}>
          <span className="sel-label">Hapus “{o.label}”?</span>
          <button type="button" className="sel-confirm-yes" disabled={busy} onClick={() => remove(o)}>{busy ? "Menghapus…" : "Hapus"}</button>
          <button type="button" className="sel-confirm-no" disabled={busy} onClick={() => setConfirmDel(null)}>Batal</button>
        </li>,
      );
      return;
    }
    rows.push(
      <li
        key={`o-${String(o.value)}`}
        id={`${listId}-${i}`}
        data-i={i}
        role="option"
        aria-selected={isSel}
        className={`sel-opt${i === active ? " active" : ""}${o.value === "" ? " empty" : ""}`}
        onMouseEnter={() => setActive(i)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => pick(o)}
      >
        {o.hint && <span className="sel-hint">{o.hint}</span>}
        <span className="sel-label">{o.label}</span>
        {isSel && o.value !== "" && <Check className="sel-check" aria-hidden="true" />}
        {removable(o.value) && (
          <button
            type="button"
            className="sel-del"
            tabIndex={-1}
            title={`Hapus ${o.label}`}
            aria-label={`Hapus ${o.label}`}
            onClick={(e) => { e.stopPropagation(); setCreateErr(""); setNotice(""); setActive(i); setConfirmDel(o.value); }}
          >
            <Trash2 aria-hidden="true" />
          </button>
        )}
      </li>,
    );
  });

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`sel sel-${size}${open ? " open" : ""} ${className}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openPop())}
        onKeyDown={onTriggerKey}
      >
        <span className={`sel-value${selected ? "" : " placeholder"}`}>
          {selected ? <>{selected.hint && <span className="sel-hint">{selected.hint}</span>}{selected.label}</> : placeholder}
        </span>
        <ChevronDown className="sel-chevron" aria-hidden="true" />
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          className="sel-pop"
          style={{
            left: pos.left, width: pos.width ?? "max-content", minWidth: pos.minWidth, maxWidth: pos.maxWidth,
            top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight,
          }}
          onKeyDown={onKey}
        >
          {showSearch && (
            <div className="sel-search">
              <Search aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={create ? `Cari atau tambah ${create.noun}…` : "Cari…"}
                aria-label="Cari opsi"
                aria-controls={listId}
                aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                autoComplete="off"
              />
            </div>
          )}
          <ul ref={listRef} id={listId} role="listbox" tabIndex={-1} className="sel-list" aria-label={ariaLabel}>
            {rows}
            {!shown.length && <li className="sel-none" role="presentation">Tidak ada yang cocok.</li>}
          </ul>
          {create && (
            <div className="sel-create">
              {!query.trim() ? (
                <span className="sel-create-hint"><Plus aria-hidden="true" /> Ketik nama untuk menambah {create.noun} baru</span>
              ) : exact ? (
                <span className="sel-create-hint">“{query.trim()}” sudah ada di daftar.</span>
              ) : create.types ? (
                <>
                  <span className="sel-create-hint">Tambah “{query.trim()}” sebagai:</span>
                  <div className="sel-create-types">
                    {create.types.map((t) => (
                      <button key={t.value} type="button" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => add(t.value)}>{t.label}</button>
                    ))}
                  </div>
                </>
              ) : (
                <button type="button" className="sel-create-btn" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => add()}>
                  <Plus aria-hidden="true" /> {busy ? "Menyimpan…" : `Tambah ${create.noun} “${query.trim()}”`}
                </button>
              )}
              {notice && <span className="sel-create-note" role="status">{notice}</span>}
              {createErr && <span className="sel-create-err" role="alert">{createErr}</span>}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
