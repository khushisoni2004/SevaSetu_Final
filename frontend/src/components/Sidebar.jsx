import React from "react";
import {
  Home,
  Grid3X3,
  Mic2,
  Headphones,
  FileText,
  Bookmark,
  ClipboardCheck,
  User,
  LogOut,
} from "lucide-react";
import "./Sidebar.css";
import Logo from "./Logo.jsx";

const navItems = [
  { label: "Dashboard", path: "/app/dashboard", icon: Home },
  { label: "Schemes", path: "/app/schemes", icon: Grid3X3 },
  { label: "Voice Bot", path: "/app/voice-bot", icon: Mic2 },
  { label: "Voice Form Help", path: "/app/voice-form-help", icon: Headphones },
  { label: "Documents", path: "/app/documents", icon: FileText },
  { label: "Saved Schemes", path: "/app/saved", icon: Bookmark },
  { label: "Applications", path: "/app/applications", icon: ClipboardCheck },
  { label: "Profile", path: "/app/profile", icon: User },
];

function getUser() {
  try {
    return (
      JSON.parse(localStorage.getItem("sevasetu_user") || "{}") ||
      JSON.parse(localStorage.getItem("sevasetu_profile") || "{}") ||
      {}
    );
  } catch {
    return {};
  }
}

export default function Sidebar({ active }) {
  const user = getUser();
  const pathname = window.location.pathname;

  function go(path) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function logout() {
    localStorage.removeItem("sevasetu_token");
    window.location.href = "/login";
  }

  return (
    <aside className="sidebar">
      <div className="brand sidebarLogoOnly">
        <Logo />
      </div>

      <nav className="sidebarNav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.path ||
            pathname.startsWith(item.path) ||
            active === item.label ||
            active === item.label.toLowerCase().replaceAll(" ", "");

          return (
            <button
              key={item.path}
              type="button"
              className={isActive ? "active" : ""}
              onClick={() => go(item.path)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebarBottom">
        <div className="digitalCard">
          <b>Digital India Inspired</b>
          <p>Simple, trusted and accessible public services for every citizen.</p>
        </div>

        <div className="userMini">
          <div>{(user.name || "S").slice(0, 1).toUpperCase()}</div>
          <section>
            <b>{user.name || "Sneha Soni"}</b>
            <small>{user.email || "sneha@gmail.com"}</small>
          </section>
        </div>

        <button className="logoutBtn" type="button" onClick={logout}>
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </aside>
  );
}