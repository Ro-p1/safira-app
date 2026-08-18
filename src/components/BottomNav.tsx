import { NavLink } from "react-router-dom";
import { ScanLine, History, QrCode, User } from "lucide-react";

const navItems = [
  { to: "/scan", label: "Scan", icon: ScanLine },
  { to: "/riwayat", label: "Riwayat", icon: History },
  { to: "/produsen", label: "Produsen", icon: QrCode },
  { to: "/profil", label: "Profil", icon: User },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40">
      <div className="app-frame !min-h-0 !shadow-none border-t border-gray-100 bg-white flex justify-around py-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 rounded-2xl transition-colors ${
                isActive ? "text-safira-dark" : "text-gray-400"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-2 rounded-full ${isActive ? "bg-safira-dark text-white" : ""}`}
                >
                  <Icon size={20} />
                </div>
                <span className="text-xs font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
