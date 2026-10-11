import { NavLink, Outlet, Link } from "react-router-dom";
import {
  Layers,
  LayoutDashboard,
  Library,
  Repeat2,
  ChartNoAxesCombined,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../features/auth/AuthProvider";
import { Button, ErrorMessage } from "../components/ui";
export function Layout() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const links = [
    { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/app/collections", label: "Collections", icon: Library },
    { to: "/app/revision", label: "Revision queue", icon: Repeat2 },
    { to: "/app/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  ];
  const email = auth.session?.user.email ?? "Learner";
  return (
    <div className="workspace">
      <header className="mobile-header">
        <Link className="brand" to="/app">
          <Layers />
          AlgoDeck
        </Link>
        <button
          className="icon-button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <Link to="/app" className="brand">
          <Layers size={27} />
          AlgoDeck<span className="brand-dot">.</span>
        </Link>
        <div className="sidebar-note">Your daily practice space</div>
        <nav aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-tip">
          <Repeat2 size={20} />
          <p>A little, often.</p>
          <span>
            Difficult questions get another visit. Mastered ones get more space.
          </span>
        </div>
        <div className="sidebar-user">
          <div className="avatar">{email[0].toUpperCase()}</div>
          <div>
            <strong>{email.split("@")[0]}</strong>
            <small>Your workspace</small>
          </div>
          <Button
            variant="ghost"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              const result = await supabase?.auth.signOut();
              if (result?.error) setError(result.error);
            }}
          >
            <LogOut size={17} />
          </Button>
        </div>
        <ErrorMessage error={error} />
      </aside>
      <main className="main-content">
        <div className="topbar">
          <span>Build understanding, one day at a time.</span>
          <span>
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
