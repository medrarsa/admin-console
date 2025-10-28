import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className = "", ...props }, ref) {
    const base =
      "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-300";
    return <input ref={ref} className={`${base} ${className}`} {...props} />;
  }
);
