"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClockCounterClockwise as History, Trophy, GameController as Gamepad2, UserCircle as UserRound } from "@phosphor-icons/react/dist/ssr";
import { AccountLink } from "@/components/account-link";

const navigation = [{ href: "/", label: "Play", icon: Gamepad2 }, { href: "/history", label: "History", icon: History }, { href: "/tournaments", label: "Tournaments", icon: Trophy }, { href: "/account", label: "Profile", icon: UserRound }];
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/game" || path === "/mockup") return <>{children}</>;
  const active = (href: string) => href === "/" ? ["/", "/play", "/lobby"].includes(path) || path.startsWith("/table/") : path.startsWith(href) || (href === "/play" && (path === "/lobby" || path.startsWith("/table/")));
  return <div className="app-frame">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Whot Arena home"><span className="brand-symbol" aria-hidden="true">w.</span><span>whot<span className="brand-light">arena</span></span></Link>
      <nav className="desktop-nav" aria-label="Primary navigation">{navigation.map(({ href, label }) => <Link href={href} key={href} aria-current={active(href) ? "page" : undefined}>{label}</Link>)}</nav>
      <AccountLink />
    </header>
    <div className="main-column" id="main-content">{children}</div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.map(({ href, label, icon: Icon }) => <Link href={href} key={href} aria-current={active(href) ? "page" : undefined}><Icon size={20} weight="bold" /><span>{label}</span></Link>)}</nav>
  </div>;
}
