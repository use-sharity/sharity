"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AppContentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const cleanPath = pathname.replace(/^\/[a-z]{2}(\/|$)/, "/");
  const hasMobileTabBar = !cleanPath.startsWith("/chat");

  return (
    <div
      className={cn(
        "min-h-dvh w-full overflow-x-hidden",
        hasMobileTabBar && "pb-20 md:pb-0",
      )}
    >
      {children}
    </div>
  );
}
