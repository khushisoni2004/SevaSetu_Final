import React, { useEffect, useMemo, useState } from "react";
import "./Dashboard.css";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Grid3X3,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  WalletCards,
} from "lucide-react";
import { go } from "../App.jsx";
import ApplicationTracker from "./ApplicationTracker.jsx";
import VoiceFormHelp from "./VoiceFormHelp.jsx";

const API_URL = import.meta.env.VITE_API_URL || "https://sevasetu-backend-r3yb.onrender.com";

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("sevasetu_user") || "{}");
  } catch {
    return {};
  }
}

function getStoredArray(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

export default function Dashboard() {
  if (window.location.pathname === "/app/voice-form-help" || window.location.pathname === "/voice-form-help") {
    return <VoiceFormHelp />;
  }


  if (window.location.pathname === "/app/applications" || window.location.pathname === "/applications") {
    return <ApplicationTracker />;
  }


  const [user, setUser] = useState(getStoredUser);
  const [timeNow, setTimeNow] = useState(new Date());

  const savedSchemes = useMemo(() => getStoredArray("sevasetu_saved_schemes"), []);
  const documents = useMemo(() => getStoredArray("sevasetu_documents"), []);

  useEffect(() => {
    const timer = setInterval(() => setTimeNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const hideOnlyDuplicateTitle = () => {
      const allNodes = Array.from(document.querySelectorAll("body *"));

      allNodes.forEach((node) => {
        if (node.closest(".sevaDash")) return;

        const txt = (node.innerText || "").replace(/\s+/g, " ").trim();
        const rect = node.getBoundingClientRect();

        const isDuplicate =
          txt === "SevaSetu Citizen Portal Dashboard" ||
          txt === "SevaSetu Citizen PortalDashboard";

        const isSafeSmallHeader =
          isDuplicate &&
          rect.height > 20 &&
          rect.height < 120 &&
          rect.width > 200 &&
          node.children.length <= 4;

        if (isSafeSmallHeader) {
          node.style.display = "none";
          node.style.height = "0px";
          node.style.minHeight = "0px";
          node.style.padding = "0px";
          node.style.margin = "0px";
          node.style.border = "0px";
          node.style.overflow = "hidden";
        }
      });
    };

    hideOnlyDuplicateTitle();
    setTimeout(hideOnlyDuplicateTitle, 100);
    setTimeout(hideOnlyDuplicateTitle, 500);
  }, []);


  useEffect(() => {
    async function fetchUser() {
      try {
        const token =
          localStorage.getItem("sevasetu_token") ||
          localStorage.getItem("sevasetu_auth_token");

        if (token) {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            if (data?.user) {
              setUser(data.user);
              localStorage.setItem("sevasetu_user", JSON.stringify(data.user));
            }
          }
        }
      } catch (error) {
        console.log("Dashboard running in local mode");
      }
    }

    fetchUser();
  }, []);

  function logout() {
    localStorage.removeItem("sevasetu_token");
    localStorage.removeItem("sevasetu_auth_token");
    localStorage.removeItem("sevasetu_user");
    localStorage.removeItem("sevasetu_profile");
    localStorage.removeItem("sevasetu_profile_last_saved");
    localStorage.removeItem("sevasetu_profile_last_saved_auto");
    go("/");
  }

  const displayName = user?.name || "Citizen";
  const email = user?.email || "Not added";
  const mobile = user?.mobile || "Not added";
  const initial = displayName?.charAt(0)?.toUpperCase() || "C";

  const today = timeNow.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const clock = timeNow.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const stats = [
    ["Total Schemes", "3,406+", "Central + state schemes", Grid3X3, "blue"],
    ["Saved Schemes", savedSchemes.length || 0, "Your bookmarked items", Bookmark, "orange"],
    ["Documents Ready", documents.length || 0, "Uploaded or tracked", FileText, "green"],
    ["Account Status", "Verified", "Citizen login active", ShieldCheck, "navy"],
  ];

  const actions = [
    ["Browse Schemes", "Find schemes by category, benefit, state and eligibility.", Grid3X3, "/app/schemes", "Recommended"],
    ["Documents Hub", "Prepare, track and manage required documents.", FileText, "/app/documents", "Checklist"],
    ["Saved Schemes", "Review schemes you saved for later application.", Bookmark, "/app/saved", "Personal"],
    ["Application Tracker", "Manage citizen details and account information.", User, "/app/profile", "Secure"],
  ];

  return (
    <main className="sevaDash">
      <section className="dashHeader">
        <div className="dashProject">
          <div className="dashProjectLogo" />
          <div>
            <span>SevaSetu Citizen Portal</span>
            <h1>Dashboard</h1>
          </div>
        </div>

        <div className="dashHeaderActions">
          <button className="ghostBtn" type="button">
            <Bell size={18} />
            Alerts
          </button>
          <button className="logoutBtn" type="button" onClick={logout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </section>

      <section className="dashHeroPro">
        <div className="dashWelcomeCard">
          <span className="liveBadge">
            <Sparkles size={16} />
            Live Citizen Dashboard
          </span>

          <h2>
            Welcome, <strong>{displayName}</strong>
          </h2>

          <p>Track schemes, documents and saved items in one secure workspace.</p>

          <div className="dashSearch">
            <Search size={20} />
            <input placeholder="Search schemes, documents, services..." />
            <button type="button" onClick={() => go("/app/schemes")}>Search</button>
          </div>

          <div className="miniHighlights">
            <span><CheckCircle2 size={16} /> Verified account</span>
            <span><TrendingUp size={16} /> Real-time progress</span>
            <span><ShieldCheck size={16} /> Secure access</span>
          </div>
        </div>

        <aside className="citizenCardPro">
          <div className="profileTop">
            <div className="avatarCircle">{initial}</div>
            <div>
              <h3>{displayName}</h3>
              <p>{email}</p>
              <small>{mobile}</small>
            </div>
          </div>

          <div className="statusRows">
            <article>
              <CalendarDays size={18} />
              <div>
                <b>{today}</b>
                <span>{clock}</span>
              </div>
            </article>
          </div>

          <button className="profileBtn" type="button" onClick={() => go("/app/profile")}>
            View Profile
            <ArrowRight size={18} />
          </button>
        </aside>
      </section>

      <section className="statsProGrid">
        {stats.map(([label, value, helper, Icon, tone]) => (
          <article className={`statPro ${tone}`} key={label}>
            <div className="statIcon"><Icon size={24} /></div>
            <span>{label}</span>
            <b>{value}</b>
            <small>{helper}</small>
          </article>
        ))}
      </section>

      <section className="dashContentGrid">
        <div className="quickPanel">
          <div className="sectionHead">
            <span>Quick Actions</span>
            <h2>What would you like to do today?</h2>
          </div>

          <div className="actionGridPro">
            {actions.map(([title, desc, Icon, path, badge]) => (
              <button key={title} type="button" onClick={() => go(path)}>
                <div className="actionIconPro"><Icon size={28} /></div>
                <div className="actionText">
                  <small>{badge}</small>
                  <b>{title}</b>
                  <p>{desc}</p>
                </div>
                <ArrowRight className="actionArrow" size={20} />
              </button>
            ))}
          </div>
        </div>

        <aside className="progressPanel">
          <div className="sectionHead">
            <span>Citizen Progress</span>
            <h2>Your activity</h2>
          </div>

          <div className="progressCards">
            <article>
              <div className="progressIcon orange"><WalletCards size={21} /></div>
              <div><b>Profile Setup</b><p>Basic citizen profile connected</p></div>
              <strong>100%</strong>
            </article>

            <article>
              <div className="progressIcon green"><FileText size={21} /></div>
              <div><b>Documents</b><p>{documents.length || 0} documents tracked</p></div>
              <strong>{documents.length ? "Active" : "Start"}</strong>
            </article>

            <article>
              <div className="progressIcon blue"><Bookmark size={21} /></div>
              <div><b>Saved Schemes</b><p>{savedSchemes.length || 0} schemes saved</p></div>
              <strong>{savedSchemes.length || 0}</strong>
            </article>

            <article>
              <div className="progressIcon navy"><ClipboardList size={21} /></div>
              <div><b>Application Readiness</b><p>Prepare documents before applying</p></div>
              <strong>Good</strong>
            </article>
          </div>

          <button className="completeBtn" type="button" onClick={() => go("/app/documents")}>
            Prepare Documents
            <ArrowRight size={18} />
          </button>
        </aside>
      </section>
    </main>
  );
}