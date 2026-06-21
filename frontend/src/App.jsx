import React, { useEffect, useState } from "react";
import "./styles.css";

import HomePage from "./components/HomePage.jsx";
import LoginSignupPage from "./components/LoginSignupPage.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Dashboard from "./components/Dashboard.jsx";
import SchemesPage from "./components/SchemesPage.jsx";
import SchemeDetails from "./components/SchemeDetails.jsx";
import SavedSchemes from "./components/SavedSchemes.jsx";
import ProfilePage from "./components/ProfilePage.jsx";
import DocumentsPage from "./components/DocumentsPage.jsx";
import VoiceSevaBot from "./components/VoiceSevaBot.jsx";
import ApplicationTracker from "./components/ApplicationTracker.jsx";
import VoiceFormHelp from "./components/VoiceFormHelp.jsx";

export function go(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

class SafePage extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Page error",
    };
  }

  componentDidCatch(error) {
    console.error("Page error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="safeErrorPage">
          <h1>Page Error</h1>
          <p>{this.state.message}</p>
          <button onClick={() => go("/app/dashboard")}>Go to Dashboard</button>
        </main>
      );
    }

    return this.props.children;
  }
}

function AppLayout({ children }) {
  return (
    <div className="sevaAppLayout">
      <Sidebar />
      <section className="sevaAppContent">
        <SafePage>{children}</SafePage>
      </section>
    </div>
  );
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);
    window.addEventListener("popstate", updatePath);
    return () => window.removeEventListener("popstate", updatePath);
  }, []);

  const text = {
    schemes: "Schemes",
    search: "Search",
    save: "Save",
    view: "View",
  };

  if (path === "/" || path === "/home") {
    return <HomePage />;
  }

  if (path === "/login") {
    return <LoginSignupPage initialMode="login" />;
  }

  if (path === "/signup") {
    return <LoginSignupPage initialMode="signup" />;
  }
if (path === "/app" || path === "/app/dashboard") {
    return (
      <AppLayout>
        <Dashboard />
      </AppLayout>
    );
  }

  if (path === "/app/schemes") {
    return (
      <AppLayout>
        <SchemesPage text={text} />
      </AppLayout>
    );
  }

  if (path.startsWith("/app/schemes/")) {
    return (
      <AppLayout>
        <SchemeDetails text={text} />
      </AppLayout>
    );
  }

  if (path === "/app/voice-bot") {
    return (
      <AppLayout>
        <VoiceSevaBot />
      </AppLayout>
    );
  }

  if (path === "/app/documents") {
    return (
      <AppLayout>
        <DocumentsPage />
      </AppLayout>
    );
  }

  if (path === "/app/saved" || path === "/app/saved-schemes") {
    return (
      <AppLayout>
        <SavedSchemes text={text} />
      </AppLayout>
    );
  }
  if (path === "/app/profile") {
    return (
      <AppLayout>
        <ProfilePage />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  );
}