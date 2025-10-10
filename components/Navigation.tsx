"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

type NavItem = {
  href: string;
  label: string;
};

export default function Navigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-6 whitespace-nowrap text-[11px] uppercase tracking-[0.28em]">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "relative px-2 py-1 transition",
              "text-foreground/50 hover:text-foreground",
              "before:absolute before:left-0 before:right-0 before:-bottom-[6px] before:h-[2px] before:origin-center before:scale-x-0 before:bg-foreground before:transition-transform before:duration-300",
              "hover:before:scale-x-100",
              isActive && "text-foreground before:scale-x-100"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
