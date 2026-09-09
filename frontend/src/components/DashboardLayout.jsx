import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  SquaresFour,
  Ticket,
  Buildings,
  UsersThree,
  GearSix,
  SignOut,
  Snowflake,
  ArrowSquareOut,
} from "@phosphor-icons/react";

const nav = [
  { to: "/admin", label: "Overview", icon: SquaresFour, end: true },
  { to: "/admin/tickets", label: "Tickets", icon: Ticket },
  { to: "/admin/brands", label: "Brands & Routing", icon: Buildings },
  { to: "/admin/agents", label: "Agents", icon: UsersThree },
  { to: "/admin/settings", label: "Settings", icon: GearSix },
];

export const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-background text-[#09090B]">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-border bg-white md:flex">
        <div className="flex items-center gap-2 border-b border-border px-6 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white">
            <Snowflake size={18} weight="fill" />
          </div>
          <div className="font-heading text-lg font-extrabold tracking-tight">CoolDesk</div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={`nav-${n.label.toLowerCase().split(" ")[0]}`}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-primary text-white"
                    : "text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B]"
                }`
              }
            >
              <n.icon size={18} weight="duotone" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            data-testid="open-public-form-link"
            className="mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-primary transition-colors duration-200 hover:bg-[#F4F4F5]"
          >
            <ArrowSquareOut size={16} /> Open dealer form
          </a>
          <div className="flex items-center justify-between rounded-md px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user?.name}</div>
              <div className="truncate text-xs text-[#A1A1AA] capitalize">{user?.role}</div>
            </div>
            <button
              onClick={doLogout}
              data-testid="logout-button"
              className="text-[#52525B] transition-colors duration-200 hover:text-[#E63946]"
              title="Sign out"
            >
              <SignOut size={20} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-64">
        <Outlet />
      </main>
    </div>
  );
};
