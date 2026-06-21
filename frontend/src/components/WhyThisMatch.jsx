import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileWarning,
  Lightbulb,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { calculateExplainableMatch, getCitizenProfile } from "../utils/matchEngine";
import "./WhyThisMatch.css";

export default function WhyThisMatch({ scheme }) {
  const [open, setOpen] = useState(false);

  const profile = useMemo(() => getCitizenProfile(), []);
  const result = useMemo(
    () => calculateExplainableMatch(scheme, profile),
    [scheme, profile]
  );

  return (
    <div className="whyMatchBox">
      <button className="whyMatchButton" onClick={() => setOpen(!open)}>
        <span>
          <Sparkles size={15} />
          Why this match?
        </span>

        <b>{result.score}%</b>

        {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>

      {open && (
        <div className="whyMatchDetails">
          <div className="whyMatchTop">
            <div>
              <ShieldCheck size={22} />
              <span>
                <b>{result.level}</b>
                <small>Explainable AI score based on profile, state, caste and documents</small>
              </span>
            </div>

            <strong>{result.score}%</strong>
          </div>

          <div className="whyMatchGrid">
            <div className="whyMiniCard">
              <MapPin size={16} />
              <span>
                <b>Selected State</b>
                <small>{result.selectedState || "Not selected"}</small>
              </span>
            </div>

            <div className="whyMiniCard">
              <Lightbulb size={16} />
              <span>
                <b>Purpose</b>
                <small>{result.purpose}</small>
              </span>
            </div>
          </div>

          {result.positive.length > 0 && (
            <div className="whySection positive">
              <b>
                <CheckCircle2 size={16} />
                Matched points
              </b>

              {result.positive.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="whySection warning">
              <b>
                <AlertTriangle size={16} />
                Important checks
              </b>

              {result.warnings.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          )}

          {result.missingDocuments.length > 0 && (
            <div className="missingDocStrip">
              <FileWarning size={16} />
              Missing: {result.missingDocuments.slice(0, 4).join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
