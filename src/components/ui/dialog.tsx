import * as React from "react";
import { Button } from "./button";

type DialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  children?: React.ReactNode;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  footer,
  maxWidth = 980,
  children,
}: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="absolute left-1/2 top-6 -translate-x-1/2 w-[95%]"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
      >
        <div className="overflow-hidden rounded-2xl border bg-white shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold">{title}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              إغلاق
            </Button>
          </div>
          <div className="p-4">{children}</div>
          {footer && (
            <div className="px-4 py-3 border-t bg-gray-50">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}
