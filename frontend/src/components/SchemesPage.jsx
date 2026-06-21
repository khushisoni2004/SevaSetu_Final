import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Grid3X3,
  Landmark,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import data from "../data/sevasetuImportedSchemes.json";
import { go } from "../App.jsx";
import { api } from "../api";
import EligibilityMeter from "./EligibilityMeter.jsx";
import "./SchemesForce.css";
import WhyThisMatch from "./WhyThisMatch.jsx";

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const UNION_TERRITORIES = [
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeStateName(value) {
  const v = cleanText(value);

  if (!v) return "All India";

  const lower = v.toLowerCase();

  if (
    lower === "all" ||
    lower === "india" ||
    lower === "central" ||
    lower === "central government" ||
    lower === "all states" ||
    lower === "pan india" ||
    lower === "nationwide"
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
  const raw = Array.isArray(scheme.state)
    ? scheme.state
    : scheme.state
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
    applicationMode: s.applicationMode || "Online / Official Portal",
  };
}

function primaryStateForScheme(scheme, selectedState) {
  const states = getSchemeStates(scheme);

  if (selectedState !== "All" && states.includes(selectedState)) {
    return selectedState;
  }

  const nonNational = states.find((x) => x !== "All India");
  return nonNational || "All India";
}

export default function SchemesPage({ text = {} }) {
  const schemes = useMemo(() => data.map(norm), []);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [savingId, setSavingId] = useState("");

  const perPage = 20;

  React.useEffect(() => {
    const hideSchemesTopDuplicateBar = () => {
      const page = document.querySelector(".schemesPremiumPage");
      if (!page || !page.parentElement) return;

      Array.from(page.parentElement.children).forEach((el) => {
        if (el === page) return;
        const txt = (el.innerText || "").replace(/\s+/g, " ").trim();

        if (
          txt === "SevaSetu Citizen Portal Schemes" ||
          txt.includes("SevaSetu Citizen Portal Schemes")
        ) {
          el.style.display = "none";
          el.style.height = "0px";
          el.style.minHeight = "0px";
          el.style.padding = "0px";
          el.style.margin = "0px";
          el.style.border = "0px";
          el.style.overflow = "hidden";
        }
      });
    };

    hideSchemesTopDuplicateBar();
    setTimeout(hideSchemesTopDuplicateBar, 100);
    setTimeout(hideSchemesTopDuplicateBar, 500);
  }, []);


  const categories = useMemo(() => {
    const list = Array.from(
      new Set(schemes.map((s) => s.category).filter(Boolean))
    ).sort();

    return ["All", ...list];
  }, [schemes]);

  const extraStatesFromData = useMemo(() => {
    const official = new Set(["All India", ...INDIAN_STATES, ...UNION_TERRITORIES]);

    return Array.from(
      new Set(schemes.flatMap((s) => getSchemeStates(s)))
    )
      .filter((x) => !official.has(x))
      .sort();
  }, [schemes]);

  const stateGroups = useMemo(() => {
    return {
      national: ["All India"],
      states: INDIAN_STATES,
      unionTerritories: UNION_TERRITORIES,
      other: extraStatesFromData,
    };
  }, [extraStatesFromData]);

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();

    return schemes.filter((s) => {
      const states = getSchemeStates(s);

      const matchCategory = category === "All" || s.category === category;

      const matchState =
        stateFilter === "All" ||
        states.includes(stateFilter) ||
        states.includes("All India");

      const matchSearch = [
        s.title,
        s.category,
        s.benefits,
        s.applicationMode,
        ...states,
        ...(s.requiredDocuments || []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

      return matchCategory && matchState && matchSearch;
    });
  }, [schemes, q, category, stateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);

  const groupedVisible = useMemo(() => {
    const map = new Map();

    visible.forEach((scheme) => {
      const groupName = primaryStateForScheme(scheme, stateFilter);

      if (!map.has(groupName)) {
        map.set(groupName, []);
      }

      map.get(groupName).push(scheme);
    });

    const orderedNames =
      stateFilter !== "All"
        ? [stateFilter, "All India"]
        : ["All India", ...INDIAN_STATES, ...UNION_TERRITORIES, ...extraStatesFromData];

    const ordered = [];

    orderedNames.forEach((name) => {
      if (map.has(name)) {
        ordered.push({ state: name, items: map.get(name) });
        map.delete(name);
      }
    });

    map.forEach((items, state) => ordered.push({ state, items }));

    return ordered;
  }, [visible, stateFilter, extraStatesFromData]);

  function resetFilters(nextQ, nextCategory, nextState) {
    setQ(nextQ);
    setCategory(nextCategory);
    setStateFilter(nextState);
    setPage(1);
  }

  async function saveScheme(s) {
    try {
      setSavingId(s.id);

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

      alert("Saved locally. Start backend for MongoDB sync.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <main className="schemesPremiumPage">
      <section className="schemesPremiumHero">
        <div className="schemesHeroText">
          <h1 className="onlyGovtSchemeTitle">
            Schemes
          </h1>

          
        </div>
      </section>

      <section className="schemesFilterBar">
        <div className="schemesSearchBox">
          <Search size={20} />
          <input
            value={q}
            onChange={(e) => resetFilters(e.target.value, category, stateFilter)}
            placeholder="Search scheme name, documents, benefits..."
          />
        </div>

        <div className="schemesSelectBox">
          <Filter size={19} />
          <select
            value={category}
            onChange={(e) => resetFilters(q, e.target.value, stateFilter)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All Categories" : c}
              </option>
            ))}
          </select>
        </div>

        <div className="schemesSelectBox stateSelectBox">
          <MapPin size={19} />
          <select
            value={stateFilter}
            onChange={(e) => resetFilters(q, category, e.target.value)}
          >
            <option value="All">All States</option>

            <optgroup label="National">
              {stateGroups.national.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </optgroup>

            <optgroup label="States">
              {stateGroups.states.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </optgroup>

            <optgroup label="Union Territories">
              {stateGroups.unionTerritories.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </optgroup>

            {stateGroups.other.length > 0 && (
              <optgroup label="Other">
                {stateGroups.other.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <button
          type="button"
          className="schemesResetBtn"
          onClick={() => resetFilters("", "All", "All")}
        >
          Reset
        </button>
      </section>

      <section className="schemesPremiumMiniStats">
        <article>
          <Grid3X3 size={22} />
          <div>
            <b>{categories.length - 1}</b>
            <span>Categories</span>
          </div>
        </article>

        <article>
          <BadgeCheck size={22} />
          <div>
            <b>{stateFilter === "All" ? "India" : stateFilter}</b>
            <span>Selected coverage</span>
          </div>
        </article>

        <article>
          <ShieldCheck size={22} />
          <div>
            <b>Secure</b>
            <span>Saved to account</span>
          </div>
        </article>
      </section>

      <section className="stateWiseResultInfo">
        <MapPin size={18} />
        <span>
          Showing {visible.length} schemes on this page, grouped by{" "}
          {stateFilter === "All" ? "state / national coverage" : stateFilter}
        </span>
      </section>

      {groupedVisible.map((group) => (
        <section className="stateSchemeGroup" key={group.state}>
          <div className="stateSchemeGroupHeader">
            <div>
              <MapPin size={18} />
              <b>{group.state}</b>
            </div>
            <span>{group.items.length} schemes on this page</span>
          </div>

          <div className="schemesPremiumGrid">
            {group.items.map((s) => (
              <article className="schemePremiumCard" key={s.id}>
                <div className="schemePremiumTop">
                  <span>
                    <Landmark size={22} />
                  </span>
                  <em>{s.category}</em>
                </div>

                <h2>{s.title}</h2>

                <p>{s.benefits}</p>

                <div className="schemeStatePills">
                  {getSchemeStates(s).slice(0, 3).map((st) => (
                    <small key={st}>
                      <MapPin size={13} />
                      {st}
                    </small>
                  ))}
                </div>

                <div className="schemePremiumMeter">
                  <EligibilityMeter scheme={s} /><WhyThisMatch scheme={s} />
                </div>

                <div className="schemePremiumDocs">
                  <FileText size={15} />
                  <small>{(s.requiredDocuments || []).slice(0, 3).join(", ")}</small>
                </div>

                <div className="schemePremiumActions">
                  <button type="button" onClick={() => saveScheme(s)}>
                    <Bookmark size={17} />
                    {savingId === s.id ? "Saving..." : text.save || "Save"}
                  </button>

                  <button
                    type="button"
                    className="schemeViewBtn"
                    onClick={() => go(`/app/schemes/${encodeURIComponent(s.id)}`)}
                  >
                    View
                    <ArrowRight size={17} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="schemesPagination">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft size={18} />
          Previous
        </button>

        <div>
          <b>Page {safePage} of {totalPages}</b>
          <span>
            Showing {visible.length} of {filtered.length.toLocaleString("en-IN")} schemes
          </span>
        </div>

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
          <ChevronRight size={18} />
        </button>
      </section>
    </main>
  );
}