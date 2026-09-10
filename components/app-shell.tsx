"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Trophy, Gamepad2, Home, ArrowUpRight } from "lucide-react";

const navigation = [{ href: "/", label: "Home", icon: Home }, { href: "/play", label: "Play", icon: Gamepad2 }, { href: "/tournaments", label: "Tournaments", icon: Trophy }, { href: "/rules", label: "How to play", icon: BookOpen }];
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/game" || path === "/mockup") return <>{children}</>;
  const active = (href: string) => href === "/" ? path === href : path.startsWith(href) || (href === "/play" && (path === "/lobby" || path.startsWith("/table/")));
  return <div className="app-frame">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Whot Arena home"><span className="brand-symbol" aria-hidden="true">w.</span><span>whot<span className="brand-light">arena</span></span></Link>
      <nav className="desktop-nav" aria-label="Primary navigation">{navigation.map(({ href, label }) => <Link href={href} key={href} aria-current={active(href) ? "page" : undefined}>{label}</Link>)}</nav>
      <Link className="account-link" href="/auth">Sign in <ArrowUpRight size={15} /></Link>
    </header>
    <div className="main-column" id="main-content">{children}</div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.map(({ href, label, icon: Icon }) => <Link href={href} key={href} aria-current={active(href) ? "page" : undefined}><Icon size={20} strokeWidth={1.7} /><span>{label}</span></Link>)}</nav>
  </div>;
}
