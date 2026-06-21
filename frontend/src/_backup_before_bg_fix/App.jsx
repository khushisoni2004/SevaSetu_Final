import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ExternalLink,
  FileCheck2,
  Landmark,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import data from "../data/sevasetuImportedSchemes.json";
import { go } from "../App.jsx";
import { api } from "../api";
import EligibilityMeter from "./EligibilityMeter.jsx";
import "./SchemesForce.css";

function normalizeStateName(value) {
  const v = String(value || "").trim();
  if (!v) return "All India";

  const lower = v.toLowerCase();

  if (
    lower === "all" ||
    lower === "india" ||
    lower === "central" ||
    lower === "central government" ||
    lower === "pan india" ||
    lower === "nationwide" ||
    lower === "all states"
  ) {
    return "All India";
  }

  if (lower === "mp") return "Madhya Pradesh";
  if (lower === "up") return "Uttar Pradesh";
  if (lower === "tn") return "Tamil Nadu";
  if (lower === "mh") return "Maharashtra";
  if (lower === "gj") return "Gujarat";
  if (lower === "wb") return "West Bengal";
  if (lower === "jk") return "Jammu and Kashmir";

  return v;
}

function getSchemeStates(scheme) {
  const raw = Array.isArray(scheme?.state)
    ? scheme.state
    : scheme?.state
    ? [scheme.state]
    : ["All India"];

  const cleaned = raw.map(normalizeStateName).filter(Boolean);
  const unique = Array.from(new Set(cleaned));

  return unique.length ? unique : ["All India"];
}

function norm(s, i) {
  return {
    ...s,
    id: String(s.id || i),
    title: s.title || `Scheme ${i + 1}`,
    category: s.category || "Government Scheme",
    state: getSchemeStates(s),
    requiredDocuments: s.requiredDocuments || ["Aadhaar Card"],
    benefits: s.benefits || "Scheme information is under review.",
    officialLink: s.officialLink || "https://www.myscheme.gov.in/",
    applicationMode: s.applicationMode || "Online / Official Portal",
  };
}

export default function SchemeDetails({ text = {} }) {
  const rawId = decodeURIComponent(
    window.location.pathname.replace("/app/schemes/", "")
  );

  const schemes = useMemo(() => data.map(norm), []);
  const s = schemes.find((x) => String(x.id) === String(rawId)) || schemes[0];

  const schemeStates = getSchemeStates(s);
  const [saving, setSaving] = useState(false);

  async function save() {
    try {
      setSaving(true);

      const res = await api("/api/saved-db", {
        method: "POST",
        body: JSON.stringify({ scheme: s }),
      });

      const old = JSON.parse(localStorage.getItem("sevasetu_saved_schemes") || "[]");

      if (!old.some((x) => String(x.id) === String(s.id))) {
        localStorage.setItem("sevasetu_saved_schemes", JSON.stringify([s, ...old]));
      }

      alert(res.message || "Scheme saved successfully");
    } catch {
      const old = JSON.parse(localStorage.getItem("sevasetu_saved_schemes") || "[]");

      if (!old.some((x) => String(x.id) === String(s.id))) {
        localStorage.setItem("sevasetu_saved_schemes", JSON.stringify([s, ...old]));
      }

      alert("Saved locally.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="schemeDetailsPro">
      <button className="detailsBackBtn" onClick={() => go("/app/schemes")}>
        <ArrowLeft size={18} />
        Back to Schemes
      </button>

      <section className="detailsHeroPro">
        <span>
          <Sparkles size={16} />
          Scheme Information
        </span>

        <h1>{s.title}</h1>

        <p>
          Review complete scheme information, profile match, documents and official
          application route before applying.
        </p>

        <div className="detailsTags">
          <em>
            <Landmark size={15} />
            {s.category}
          </em>

          <em>
            <MapPin size={15} />
            {schemeStates.join(", ")}
          </em>

          <em>{s.applicationMode}</em>
        </div>
      </section>

      <section className="detailsGridPro">
        <main>
          <article>
            <h2>
              <ShieldCheck size={22} />
              Profile Match
            </h2>
            <EligibilityMeter scheme={s} />
          </article>

          <article>
            <h2>Complete Scheme Information</h2>

            <div className="schemeFullInfoBox">
              <section>
                <b>Scheme Name</b>
                <p>{s.title}</p>
              </section>

              <section>
                <b>Category</b>
                <p>{s.category}</p>
              </section>

              <section>
                <b>State / Coverage</b>
                <p>{schemeStates.join(", ")}</p>
              </section>

              <section>
                <b>Application Mode</b>
                <p>{s.applicationMode}</p>
              </section>

              <section className="wide">
                <b>Benefit / Summary</b>
                <p>{s.benefits}</p>
              </section>
            </div>
          </article>

          <article>
            <h2>
              <FileCheck2 size={22} />
              Required Documents
            </h2>

            <div className="docTagsPro">
              {(s.requiredDocuments || []).map((d) => (
                <span key={d}>
                  <FileCheck2 size={16} />
                  {d}
                </span>
              ))}
            </div>
          </article>
        </main>

        <aside>
          <div className="officialCardPro">
            <ExternalLink size={34} />
            <h2>Official Site Link</h2>

            <p>
              SevaSetu gives guidance only. Final application continues on the
              official portal.
            </p>

            <a
              className="officialApplyBtn"
              href={s.officialLink || "https://www.myscheme.gov.in/"}
              target="_blank"
              rel="noreferrer"
            >
              Apply / Open Official Site
              <ArrowRight size={18} />
            </a>

            <button type="button" className="saveOfficial" onClick={save}>
              <Bookmark size={18} />
              {saving ? "Saving..." : "Save Scheme"}
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}
