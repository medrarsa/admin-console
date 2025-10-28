import * as React from "react";

type TabsContextType = { value: string; setValue: (v: string) => void };
const Ctx = React.createContext<TabsContextType | null>(null);

export function Tabs({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Ctx.Provider value={{ value, setValue: onValueChange }}>
      {children}
    </Ctx.Provider>
  );
}

export function TabsList({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`flex flex-wrap gap-2 ${className}`}>{children}</div>;
}

export function TabsTrigger({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(Ctx)!;
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={`rounded-full border px-3 py-1.5 text-sm transition
      ${
        active
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      }
    `}
      type="button"
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(Ctx)!;
  if (ctx.value !== value) return null;
  return <div className="mt-3">{children}</div>;
}
