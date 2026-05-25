"use client";

import { ChevronDown, Link2, MoreHorizontal, Printer, RefreshCw } from "lucide-react";
import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminMoreActionsButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const refreshView = () => {
    setOpen(false);
    startTransition(() => router.refresh());
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="vh-admin-menu-control" ref={menuRef}>
      <button className="vh-admin-action-button" type="button" onClick={() => setOpen((isOpen) => !isOpen)} aria-expanded={open}>
        <MoreHorizontal size={16} strokeWidth={1.9} aria-hidden="true" />
        <span>More actions</span>
        <ChevronDown size={14} strokeWidth={1.9} aria-hidden="true" />
      </button>
      {open ? (
        <div className="vh-admin-range-menu vh-admin-actions-menu" role="menu">
          <button type="button" onClick={refreshView}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh view
          </button>
          <button type="button" onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" />
            Print page
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href);
              setOpen(false);
            }}
          >
            <Link2 size={14} aria-hidden="true" />
            Copy page link
          </button>
        </div>
      ) : null}
    </div>
  );
}
