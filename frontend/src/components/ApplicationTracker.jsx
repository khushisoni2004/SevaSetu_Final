import React, { useMemo, useState } from "react";
import {
  ClipboardCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Save,
  Languages,
  ExternalLink,
  FileText,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import schemesData from "../data/sevasetuImportedSchemes.json";
import "./ApplicationTracker.css";

const STORE_KEY = "sevasetu_final_application_tracker";

const LANG = {
  en: {
    badge: "APPLICATION JOURNEY",
    title: "Application Journey Tracker",
    subtitle: "Track your government scheme application from scheme selection to document readiness and final application status.",
    search: "Type scheme name to auto-detect documents...",
    smart: "Smart Scheme Suggestions",
    add: "Start Application",
    total: "Total Applications",
    ready: "Ready to Apply",
    pending: "Documents Pending",
    applied: "Applied",
    emptyTitle: "No application started yet",
    emptyText: "Search a scheme, auto-fill required documents and start tracking.",
    readiness: "Application Readiness",
    checklist: "Document Checklist",
    status: "Application Status",
    note: "Application Note",
    save: "Save Note",
    saved: "Saved",
    apply: "Apply / Verify",
    missing: "Missing",
    autoFill: "Auto-fill documents",
    flow: "Profile → Scheme Match → Documents → Application Tracking",
    noDocs: "Select a scheme suggestion to auto-fill required documents",
  },
  hi: {
    badge: "आवेदन यात्रा",
    title: "आवेदन यात्रा ट्रैकर",
    subtitle: "सरकारी योजना आवेदन को योजना चयन से लेकर दस्तावेज़ तैयारी और अंतिम आवेदन स्थिति तक ट्रैक करें।",
    search: "योजना का नाम लिखें, दस्तावेज़ अपने आप आ जाएंगे...",
    smart: "स्मार्ट योजना सुझाव",
    add: "आवेदन शुरू करें",
    total: "कुल आवेदन",
    ready: "आवेदन के लिए तैयार",
    pending: "दस्तावेज़ बाकी",
    applied: "आवेदन किया गया",
    emptyTitle: "अभी कोई आवेदन शुरू नहीं हुआ",
    emptyText: "योजना खोजें, दस्तावेज़ अपने आप भरें और ट्रैकिंग शुरू करें।",
    readiness: "आवेदन तैयारी",
    checklist: "दस्तावेज़ सूची",
    status: "आवेदन स्थिति",
    note: "आवेदन नोट",
    save: "नोट सेव करें",
    saved: "सेव हो गया",
    apply: "आवेदन / सत्यापन",
    missing: "बाकी",
    autoFill: "दस्तावेज़ भरें",
    flow: "प्रोफाइल → योजना मिलान → दस्तावेज़ → आवेदन ट्रैकिंग",
    noDocs: "दस्तावेज़ अपने आप भरने के लिए योजना सुझाव चुनें",
  },
};

const STATUS = ["Not Started", "Documents Pending", "Ready to Apply", "Applied", "Approved", "Rejected"];

function arr(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function safeLoad() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function safeSave(items) {
  localStorage.setItem(STORE_KEY, JSON.stringify(items));
}

function getProfileDocs() {
  try {
    const p1 = JSON.parse(localStorage.getItem("sevasetu_profile") || "{}");
    const p2 = JSON.parse(localStorage.getItem("sevasetu_user") || "{}");
    const profile = { ...p2, ...p1 };
    const docs = new Set();

    arr(profile.documents).forEach((d) => docs.add(String(d)));

    arr(profile.uploadedDocuments).forEach((d) => {
      if (typeof d === "string") docs.add(d);
      if (d && typeof d === "object") {
        if (d.documentName) docs.add(String(d.documentName));
        if (d.guessedType) docs.add(String(d.guessedType));
        if (d.name) docs.add(String(d.name));
      }
    });

    return Array.from(docs).filter(Boolean);
  } catch {
    return [];
  }
}

function splitDocs(text) {
  return String(text || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

function readiness(required, available) {
  if (!required.length) return 100;
  const done = required.filter((d) =>
    available.some((a) => a.toLowerCase() === d.toLowerCase())
  );
  return Math.round((done.length / required.length) * 100);
}

function cleanText(text, limit = 120) {
  const t = String(text || "")
    .replaceAll("(adsbygoogle=window.adsbygoogle||[]).push({});", " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > limit ? t.slice(0, limit) + "..." : t;
}

function scoreScheme(s, q) {
  const query = q.toLowerCase().trim();
  if (!query) return 0;

  const title = String(s.title || "").toLowerCase();
  const blob = [
    s.title,
    s.category,
    arr(s.state).join(" "),
    arr(s.eligibleCategories).join(" "),
    arr(s.beneficiaryTypes).join(" "),
    arr(s.requiredDocuments).join(" "),
    s.benefits,
  ].join(" ").toLowerCase();

  let score = 0;
  if (title.includes(query)) score += 80;
  if (blob.includes(query)) score += 35;

  query.split(/\s+/).filter(Boolean).forEach((w) => {
    if (title.includes(w)) score += 20;
    if (blob.includes(w)) score += 8;
  });

  return score;
}

export default function ApplicationTracker() {
  const [lang, setLang] = useState(localStorage.getItem("sevasetu_app_lang") || "en");
  const t = LANG[lang] || LANG.en;

  const [items, setItems] = useState(safeLoad());
  const [notes, setNotes] = useState({});
  const [savedNoteId, setSavedNoteId] = useState(null);

  const [form, setForm] = useState({
    schemeName: "",
    state: "Madhya Pradesh",
    category: "OBC",
    documents: "",
    officialLink: "",
  });

  const schemes = useMemo(() => {
    return Array.isArray(schemesData) ? schemesData.filter((s) => s && s.title) : [];
  }, []);

  const userDocs = useMemo(() => getProfileDocs(), []);

  const suggestions = useMemo(() => {
    const q = form.schemeName.trim();
    if (!q) return [];

    const scored = schemes
      .map((s) => ({ s, score: scoreScheme(s, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.s);

    if (scored.length > 0) return scored;

    return schemes.slice(0, 6);
  }, [form.schemeName, schemes]);

  function persist(next) {
    setItems(next);
    safeSave(next);
  }

  function setLanguage(next) {
    setLang(next);
    localStorage.setItem("sevasetu_app_lang", next);
  }

  function applyScheme(scheme) {
    const docs = arr(scheme.requiredDocuments).filter(Boolean);
    setForm({
      schemeName: scheme.title || "",
      state: arr(scheme.state).join(", ") || "All India",
      category: arr(scheme.eligibleCategories).join(", ") || scheme.category || "General",
      documents: docs.join(", "),
      officialLink: scheme.officialLink || "",
    });
  }

  function addApplication() {
    const docs = splitDocs(form.documents);
    if (!form.schemeName.trim() || docs.length === 0) return;

    const score = readiness(docs, userDocs);
    const item = {
      id: Date.now(),
      schemeName: form.schemeName.trim(),
      state: form.state.trim(),
      category: form.category.trim(),
      documents: docs,
      officialLink: form.officialLink.trim(),
      status: score === 100 ? "Ready to Apply" : "Documents Pending",
      note: "",
      createdAt: new Date().toISOString(),
    };

    persist([item, ...items]);

    setForm({
      schemeName: "",
      state: "Madhya Pradesh",
      category: "OBC",
      documents: "",
      officialLink: "",
    });
  }

  function updateStatus(id, status) {
    persist(items.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  function saveNote(id) {
    const note = notes[id] ?? items.find((i) => i.id === id)?.note ?? "";
    persist(items.map((i) => (i.id === id ? { ...i, note } : i)));
    setSavedNoteId(id);
    setTimeout(() => setSavedNoteId(null), 1200);
  }

  function removeItem(id) {
    persist(items.filter((i) => i.id !== id));
  }

  const stats = {
    total: items.length,
    ready: items.filter((i) => readiness(i.documents, userDocs) === 100).length,
    pending: items.filter((i) => readiness(i.documents, userDocs) < 100).length,
    applied: items.filter((i) => i.status === "Applied" || i.status === "Approved").length,
  };

  return (
    <div className="applicationTrackerPage">
      <section className="appHeroFinal">
        <div>
          <span>{t.badge}</span>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>

        <div className="appHeroRightClean">
          <div className="appHeroCard">
            <div className="appOfficialLogoMini" aria-label="SevaSetu logo"></div>
          </div>

          <div className="appLangFinal">
            <Languages />
            <button className={lang === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button>
            <button className={lang === "hi" ? "active" : ""} onClick={() => setLanguage("hi")}>हिंदी</button>
          </div>
        </div>
      </section>

      <section className="appStatsFinal">
        <article><ClipboardCheck /><b>{stats.total}</b><small>{t.total}</small></article>
        <article><CheckCircle2 /><b>{stats.ready}</b><small>{t.ready}</small></article>
        <article><AlertTriangle /><b>{stats.pending}</b><small>{t.pending}</small></article>
        <article><ShieldCheck /><b>{stats.applied}</b><small>{t.applied}</small></article>
      </section>

      <section className="appFormFinal">
        <div className="appFormTitle">
          <div>
            <span>{t.badge}</span>
            <h2>{t.add}</h2>
          </div>
          <Wand2 />
        </div>

        <div className="appFormGrid">
          <label className="schemeSearchInput">
            <Search />
            <input
              value={form.schemeName}
              onChange={(e) => setForm({ ...form, schemeName: e.target.value, documents: "" })}
              placeholder={t.search}
            />
          </label>

          <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" />
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" />

          <input
            className="autoDocsInput"
            value={form.documents}
            readOnly
            placeholder={t.noDocs}
          />

          <input value={form.officialLink} onChange={(e) => setForm({ ...form, officialLink: e.target.value })} placeholder="Official link optional" />

          <button disabled={!form.schemeName.trim() || !form.documents.trim()} onClick={addApplication}>
            <Plus />
            {t.add}
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="schemeSuggestionBox">
            <b>{t.smart}</b>
            <div>
              {suggestions.map((s) => (
                <button key={s.id || s.title} onClick={() => applyScheme(s)}>
                  <span>{s.title}</span>
                  <small>{arr(s.state).join(", ") || "All India"} • {arr(s.requiredDocuments).length || 0} docs</small>
                  <p>{cleanText(s.benefits, 90)}</p>
                  <em>{t.autoFill}</em>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {items.length === 0 ? (
        <section className="appEmptyFinal">
          <ClipboardCheck />
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyText}</p>
        </section>
      ) : (
        <section className="appCardsFinal">
          {items.map((item) => {
            const score = readiness(item.documents, userDocs);
            const missing = item.documents.filter(
              (d) => !userDocs.some((a) => a.toLowerCase() === d.toLowerCase())
            );

            return (
              <article className="appCardFinal" key={item.id}>
                <div className="appCardTopFinal">
                  <span>{item.category} • {item.state}</span>
                  <b>{score}%</b>
                </div>

                <h2>{item.schemeName}</h2>

                <div className="appProgressFinal">
                  <div>
                    <strong>{t.readiness}</strong>
                    <em>{score}%</em>
                  </div>
                  <i style={{ width: `${score}%` }} />
                </div>

                <div className="appStatusPillFinal">{item.status}</div>

                <div className="appCardBodyFinal">
                  <div className="appDocsFinal">
                    <h3><FileText /> {t.checklist}</h3>
                    {item.documents.map((doc) => {
                      const ok = !missing.includes(doc);
                      return (
                        <p className={ok ? "ok" : "missing"} key={doc}>
                          {ok ? <CheckCircle2 /> : <AlertTriangle />}
                          {doc}
                        </p>
                      );
                    })}
                    {missing.length > 0 && <small>{t.missing}: {missing.join(", ")}</small>}
                  </div>

                  <div className="appCardSideFinal">
                    <div className="appSelectFinal">
                      <label>{t.status}</label>
                      <select value={item.status} onChange={(e) => updateStatus(item.id, e.target.value)}>
                        {STATUS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>

                    <div className="appNoteFinal">
                      <label>{t.note}</label>
                      <textarea
                        value={notes[item.id] ?? item.note ?? ""}
                        onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                        placeholder="Example: Apply for income certificate before submission..."
                      />
                      <button type="button" onClick={() => saveNote(item.id)}>
                        <Save />
                        {savedNoteId === item.id ? t.saved : t.save}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="appActionsFinal">
                  {item.officialLink ? (
                    <a href={item.officialLink} target="_blank" rel="noreferrer">
                      {t.apply}
                      <ExternalLink />
                    </a>
                  ) : (
                    <button disabled>{t.apply}</button>
                  )}
                  <button className="delete" onClick={() => removeItem(item.id)}>
                    <Trash2 />
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="appFlowFinal">
        <b>{t.flow}</b>
      </section>
    </div>
  );
}
