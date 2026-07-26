"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { EyeSlashIcon } from "@phosphor-icons/react";

type PrivacyContextValue = { hidden: boolean; toggle: () => void };

const PrivacyContext = createContext<PrivacyContextValue | null>(null);
const STORAGE_KEY = "ng-privacy-hidden";

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setHidden((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error("usePrivacy must be used within PrivacyProvider");
  return ctx;
}

export function PrivacyToggle() {
  const { hidden, toggle } = usePrivacy();
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-3 rounded-[10px] p-3.5 text-left"
      style={{ border: "1px solid var(--line)" }}
    >
      <EyeSlashIcon size={18} color="var(--muted)" />
      <span className="flex-1">
        <span className="block text-sm">Ocultar montos</span>
        <span className="mt-0.5 block text-xs text-faint">
          Difumina las cifras hasta que las toques
        </span>
      </span>
      <span
        className="flex h-[23px] w-10 flex-none items-center rounded-full p-0.5"
        style={{
          background: hidden ? "var(--accent)" : "var(--surface-2)",
          justifyContent: hidden ? "flex-end" : "flex-start",
        }}
      >
        <span className="size-[19px] rounded-full" style={{ background: "var(--surface)" }} />
      </span>
    </button>
  );
}

export function Amount({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { hidden } = usePrivacy();
  return (
    <span className={className} style={hidden ? { filter: "blur(7px)" } : undefined}>
      {children}
    </span>
  );
}
