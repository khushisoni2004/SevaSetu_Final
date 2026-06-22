import React, { useEffect, useMemo, useState } from "react";
import "./SchemesPage.css";
import {
  ArrowRight,
  Bookmark,
  FileText,
  Landmark,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { go } from "../App.jsx";
import { api } from "../api";

function getLoggedUserKey() {
  const keys = [
    "sevasetu_user",
    "sevasetu_auth_user",
    "auth_user",
    "user",
    "current_user",
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const user = JSON.parse(raw);
      const id =
        user?.email ||
        user?.user?.email ||
        user?.id ||
        user?._id ||
        user?.user_id ||
        user?.name;

      if (id) return String(id).toLowerCase().trim();
    } catch {
      const raw = localStorage.getItem(key);
      if (raw && raw.includes("@")) return raw.toLowerCase().trim();
    }
  }

  return "guest";
}

function savedKey() {
  return `sevasetu_saved_schemes_${getLoggedUserKey()}`;
}

function normalizeSaved(x) {
  const base = x?.scheme ? x.scheme : x;
  return {
    ...base,
    id: base?.id || x?.id || x?.scheme_id || x?.mongo_id || base?._id,
    mongo_id: x?.mongo_id || base?.mongo_id || base?._id,
    saved_at: x?.saved_at || base?.saved_at || new Date().toISOString(),
  };
}

function uniqueSchemes(list) {
  const map = new Map();

  for (const item of list || []) {
    const s = normalizeSaved(item);
    const key = String(s.id || s.mongo_id || s.title || Math.random());
    map.set(key, s);
  }

  return [...map.values()];
}

export default function SavedSchemes({ text = {} }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");

  const cacheKey = useMemo(() => savedKey(), []);

  function saveLocal(next) {
    const clean = uniqueSchemes(next);
    localStorage.setItem(cacheKey, JSON.stringify(clean));
    localStorage.setItem("sevasetu_saved_schemes", JSON.stringify(clean));
    return clean;
  }

  function loadLocal() {
    try {
      const userSaved = JSON.parse(localStorage.getItem(cacheKey) || "[]");
      if (userSaved.length) return uniqueSchemes(userSaved);

      const oldSaved = JSON.parse(localStorage.getItem("sevasetu_saved_schemes") || "[]");
      return uniqueSchemes(oldSaved);
    } catch {
      return [];
    }
  }

  async function loadSaved() {
    try {
      setLoading(true);

      const localSaved = loadLocal();
      if (localSaved.length) {
        setItems(localSaved);
      }

      const res = await api("/api/saved-db");
      const schemes = uniqueSchemes(res.items || []);

      if (schemes.length) {
        const merged = saveLocal([...localSaved, ...schemes]);
        setItems(merged);
      } else {
        const fallback = loadLocal();
        setItems(fallback);
      }
    } catch {
      const fallback = loadLocal();
      setItems(fallback);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSaved();
  }, []);

  const filtered = items.filter((s) =>
    [s.title, s.category, s.benefits, ...(s.requiredDocuments || [])]
      .join(" ")
      .toLowerCase()
      .includes(q.toLowerCase())
  );

  async function deleteSaved(s) {
    const ok = confirm(`Delete "${s.title}" from saved schemes?`);
    if (!ok) return;

    const deleteKey = String(s.id || s.mongo_id || s.title);
    setDeletingId(deleteKey);

    try {
      if (s.id) {
        await api(`/api/saved-db/${encodeURIComponent(s.id)}`, {
          method: "DELETE",
        });
      } else if (s.mongo_id) {
        await api(`/api/saved-db/mongo/${encodeURIComponent(s.mongo_id)}`, {
          method: "DELETE",
        });
      }
    } catch {
      console.warn("Backend delete failed, deleting local copy only.");
    } finally {
      const next = items.filter((x) => {
        const xKey = String(x.id || x.mongo_id || x.title);
        return xKey !== deleteKey;
      });

      setItems(saveLocal(next));
      setDeletingId("");
      alert("Scheme deleted successfully");
    }
  }

  return (
    <main className="schemePagePro">
      <section className="schemeHeroPro savedHero">
        <div>
          <span className="schemeBadge">
            <Bookmark size={16} />
            Saved Schemes
          </span>
          <h1>Your Saved Schemes</h1>
          <p>
            View, continue or remove schemes saved in your SevaSetu account.
          </p>
        </div>

        <aside>
          <div className="schemeLogoMini" />
          <b>{items.length}</b>
          <span>Total saved items</span>
        </aside>
      </section>

      <section className="schemeSearchPanel">
        <Search size={21} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search saved schemes..."
        />
        <button type="button" onClick={loadSaved}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </section>

      {loading ? (
        <div className="emptySavedBox">Loading saved schemes...</div>
      ) : filtered.length === 0 ? (
        <div className="emptySavedBox">
          <Bookmark size={42} />
          <h2>No saved schemes found</h2>
          <p>Browse schemes and save useful ones here.</p>
          <button onClick={() => go("/app/schemes")}>Browse Schemes</button>
        </div>
      ) : (
        <section className="schemesGridPro">
          {filtered.map((s) => (
            <article className="schemeCardPro savedCardPro" key={s.id || s.mongo_id || s.title}>
              <div className="schemeCardTop">
                <span>
                  <Landmark size={23} />
                </span>
                <em>{s.category || "Government Scheme"}</em>
              </div>

              <h2>{s.title}</h2>
              <p>{s.benefits || "Scheme information is under review."}</p>

              <div className="schemeMeta">
                <small>
                  <FileText size={15} />
                  {(s.requiredDocuments || ["Aadhaar Card"]).slice(0, 3).join(", ")}
                </small>
              </div>

              <div className="schemeActions">
                <button
                  type="button"
                  className="deleteSavedBtn"
                  onClick={() => deleteSaved(s)}
                >
                  <Trash2 size={17} />
                  {deletingId === String(s.id || s.mongo_id || s.title) ? "Deleting..." : "Delete"}
                </button>

                <button
                  type="button"
                  className="viewBtn"
                  onClick={() => go(`/app/schemes/${encodeURIComponent(s.id || s.mongo_id || s.title)}`)}
                >
                  View
                  <ArrowRight size={17} />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
