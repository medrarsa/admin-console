import * as React from "react";

export default function CouponsLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      {modal}
    </div>
  );
}
