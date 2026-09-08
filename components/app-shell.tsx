"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Crown, Gamepad2, Home, LogIn } from "lucide-react";

const navItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Home", icon: Home },
  { href: "/play", label: "Play", icon: Gamepad2 },
  { href: "/tournaments", label: "Events", icon: Crown },
  { href: "/rules", label: "Rules", icon: BookOpen },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersive = pathname === "/game" || pathname.startsWith("/table/");

  if (immersive) return <>{children}</>;

  return (
    <div className="app-frame">
      <aside className="side-rail" aria-label="Primary navigation">
        <Link className="brand-mark" href="/" aria-label="Whot Arena home">
          <span>W!</span>
        </Link>
        <nav className="rail-nav">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              className={`rail-link${isActive(pathname, href) ? " active" : ""}`}
              href={href}
              key={href}
              aria-label={label}
            >
              <Icon size={20} strokeWidth={2.8} />
              <span className="rail-link-label">{label}</span>
            </Link>
          ))}
        </nav>
        <Link className="rail-profile" href="/auth" aria-label="Sign in">
          <LogIn size={17} strokeWidth={2.8} />
        </Link>
      </aside>

      <div className="main-column">
        <header className="mobile-topbar">
          <Link className="mobile-brand" href="/">
            <span className="brand-mark"><span>W!</span></span>
            WHOT ARENA
          </Link>
          <Link className="button button-quiet" href="/auth">
            <LogIn size={15} />
            Sign in
          </Link>
        </header>
        {children}
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link className={isActive(pathname, href) ? "active" : ""} href={href} key={href}>
            <Icon size={19} strokeWidth={2.8} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
