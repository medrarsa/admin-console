"use client";
import UserMenu from "./UserMenu";
import MainNavigation from "./MainNavigation";
import { NAVBAR_H } from "./MainNavbar";
import { useSidebarState } from "./SidebarProvider";

export const SIDEBAR_W = 280;

export default function MainSidebar() {
  const { isOpen, close } = useSidebarState();

  return (
    <>
      <div
        onClick={close}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />
      <aside
        aria-label="Main sidebar"
        className={`
          fixed right-0 z-50 bg-[#0a3b42] text-white border-l border-[#0a3b42] shadow-xl
          h-[calc(100vh-${NAVBAR_H}px)]
          transition-transform will-change-transform
          ${isOpen ? "translate-x-0" : "translate-x-full"}
          lg:translate-x-0
        `}
        style={{ width: SIDEBAR_W, top: NAVBAR_H }}
      >
        <div className="flex flex-col h-full">
          <UserMenu />
          <div className="flex-1 overflow-y-auto thin-scrollbar">
            <MainNavigation />
          </div>
        </div>
      </aside>
    </>
  );
}
