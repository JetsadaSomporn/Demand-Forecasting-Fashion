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
    <nav className="flex items-center gap-5">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "relative px-3 py-2 text-xs font-medium uppercase tracking-[0.3em] transition",
              "text-foreground/60 hover:text-foreground",
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
