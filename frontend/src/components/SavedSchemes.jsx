import React, { useEffect, useState } from "react";
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

export default function SavedSchemes({ text = {} }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");

  async function loadSaved() {
    try {
      setLoading(true);
      const res = await api("/api/saved-db");
      const schemes = (res.items || []).map((x) => ({
        ...(x.scheme || {}),
        mongo_id: x.mongo_id,
        saved_at: x.saved_at,
      }));
      setItems(schemes);
      localStorage.setItem("sevasetu_saved_schemes", JSON.stringify(schemes));
    } catch {
      const old = JSON.parse(localStorage.getItem("sevasetu_saved_schemes") || "[]");
      setItems(old);
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

    try {
      setDeletingId(s.id);

      if (s.id) {
        await api(`/api/saved-db/${encodeURIComponent(s.id)}`, {
          method: "DELETE",
        });
      } else if (s.mongo_id) {
        await api(`/api/saved-db/mongo/${encodeURIComponent(s.mongo_id)}`, {
          method: "DELETE",
        });
      }

      const next = items.filter((x) => x.id !== s.id);
      setItems(next);
      localStorage.setItem("sevasetu_saved_schemes", JSON.stringify(next));
      alert("Scheme deleted successfully");
    } catch {
      const next = items.filter((x) => x.id !== s.id);
      setItems(next);
      localStorage.setItem("sevasetu_saved_schemes", JSON.stringify(next));
      alert("Deleted locally. Backend sync may need restart.");
    } finally {
      setDeletingId("");
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
            <article className="schemeCardPro savedCardPro" key={s.id || s.mongo_id}>
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
                  {deletingId === s.id ? "Deleting..." : "Delete"}
                </button>

                <button
                  type="button"
                  className="viewBtn"
                  onClick={() => go(`/app/schemes/${encodeURIComponent(s.id)}`)}
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
