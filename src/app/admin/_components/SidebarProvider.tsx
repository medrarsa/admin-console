"use client";
import React, { createContext, useContext, useMemo, useState } from "react";

export type SidebarCtxType = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const SidebarCtx = createContext<SidebarCtxType | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo<SidebarCtxType>(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((s) => !s),
    }),
    [isOpen]
  );

  return <SidebarCtx.Provider value={value}>{children}</SidebarCtx.Provider>;
}

export function useSidebarState() {
  const ctx = useContext(SidebarCtx);
  if (!ctx)
    throw new Error("useSidebarState must be used within <SidebarProvider>");
  return ctx;
}
