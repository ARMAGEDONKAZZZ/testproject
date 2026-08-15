import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { User, Users, Grid, CreditCard, Mail, Bell } from "@/components/icons";

// "My class"/"Subscriptions"/"Mailing"/"Notifications" have no designed
// screens in this iteration (spec.md Assumptions — same scope boundary as
// Layout.tsx's top nav) and render disabled, matching that pattern.
const ITEMS = [
  { to: "/profile", label: "Profile", icon: User, enabled: true },
  { to: "#", label: "My class", icon: Users, enabled: false },
  { to: "/profile/board-design", label: "Board design", icon: Grid, enabled: true },
  { to: "#", label: "Subscriptions", icon: CreditCard, enabled: false },
  { to: "#", label: "Mailing", icon: Mail, enabled: false },
  { to: "#", label: "Notifications", icon: Bell, enabled: false },
];

/** Left sub-nav shared by every "Profile" section screen per docs/design-audit/profile.md. */
export function ProfileSidebar({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-4xl gap-8 px-6 py-10">
      <aside className="w-48 shrink-0 space-y-0.5">
        {ITEMS.map((item) =>
          item.enabled ? (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === "/profile"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                  isActive
                    ? "bg-bg-elevated font-medium text-text-primary"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ) : (
            <span
              key={item.label}
              aria-disabled="true"
              title="Скоро"
              className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-muted"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </span>
          ),
        )}
      </aside>

      <div className="flex-1">{children}</div>
    </div>
  );
}
