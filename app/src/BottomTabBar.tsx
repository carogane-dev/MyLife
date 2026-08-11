import { NavLink } from "react-router-dom";
import { Home, Refrigerator, UtensilsCrossed, CalendarDays, User } from "lucide-react";

const TABS: { to: string; label: string; Icon: typeof Home; end?: boolean }[] = [
  { to: "/", label: "Accueil", Icon: Home, end: true },
  { to: "/frigo", label: "Frigo", Icon: Refrigerator },
  { to: "/meal-builder", label: "Repas", Icon: UtensilsCrossed },
  { to: "/week-plan", label: "Planning", Icon: CalendarDays },
  { to: "/settings", label: "Profil", Icon: User },
];

export default function BottomTabBar() {
  return (
    <nav className="bottom-tab-bar">
      {TABS.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `bottom-tab-item ${isActive ? "active" : ""}`}>
          <Icon size={22} strokeWidth={1.75} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
