import React, { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Landmark,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";

import {
  PREMIUM_LANGUAGES,
  isRtlLanguage,
  premiumText,
} from "./sevasetuPremiumText";

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("route-change"));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function UnifiedAuth({ language = "en", setLanguage = () => {} }) {
  const initialMode = window.location.pathname.includes("signup") ? "signup" : "login";
  const [mode, setMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    state: "",
    email: "er.soni.khushi@gmail.com",
    password: "sevasetu123",
  });

  const text = premiumText(language);
  const dir = isRtlLanguage(language) ? "rtl" : "ltr";

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();

    const user = {
      name: form.name || "Khushi Soni",
      email: form.email || "citizen@sevasetu.in",
      mobile: form.mobile,
      state: form.state,
    };

    try {
      const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      await fetch(`https://sevasetu-backend-3ed6.onrender.com${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          password: form.password,
          mobile: user.mobile,
          state: user.state,
        }),
      }).catch(() => null);
    } catch {
      // local fallback below
    }

    localStorage.setItem("sevasetu_user", JSON.stringify(user));
    localStorage.setItem("sevasetu_token", "local-dev-token");
    localStorage.setItem("sevasetu_auth_token", "local-dev-token");
    navigate("/app/dashboard");
  }

  return (
    <main className="premiumAuth" dir={dir}>
      <section className="authSketchSide">
        <button className="premiumBrand authBrand" type="button" onClick={() => navigate("/")}>
          <span className="premiumLogo">
            <span className="logoSaffron" />
            <span className="logoWheel">☸</span>
            <span className="logoGreen" />
          </span>
          <div>
            <b>Seva<span>Setu</span></b>
            <small>{text.brandLine}</small>
          </div>
        </button>

        <div className="authMonumentSketch">
          <div className="indiaGateSketch">
            <span />
            <b />
            <em />
          </div>
          <div className="redFortSketch">
            <span />
            <span />
            <span />
            <b />
          </div>
        </div>

        <div className="authQuote">
          <span><ShieldCheck /></span>
          <small>SEVASETU CITIZEN PROMISE</small>
          <h1>“{text.quote}”</h1>
          <p>Secure authentication • Citizen-first platform • Digital India inspired</p>
        </div>
      </section>

      <section className="authFormSide">
        <form className="premiumAuthCard" onSubmit={submit}>
          <div className="authTopRow">
            <button type="button" onClick={() => navigate("/")}>Home</button>
            <label>
              <select
                value={language}
                onChange={(event) => {
                  setLanguage(event.target.value);
                  localStorage.setItem("sevasetu_language", event.target.value);
                }}
              >
                {PREMIUM_LANGUAGES.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="authIcon">
            <Landmark />
          </div>

          <h2>{mode === "signup" ? text.authSignupTitle : text.authLoginTitle}</h2>
          <p>{text.authSubtitle}</p>

          {mode === "signup" && (
            <>
              <label className="premiumField">
                <User />
                <input
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder={text.name}
                />
              </label>

              <label className="premiumField">
                <Phone />
                <input
                  value={form.mobile}
                  onChange={(event) => update("mobile", event.target.value)}
                  placeholder={text.mobile}
                />
              </label>

              <label className="premiumField">
                <Landmark />
                <input
                  value={form.state}
                  onChange={(event) => update("state", event.target.value)}
                  placeholder={text.state}
                />
              </label>
            </>
          )}

          <label className="premiumField">
            <Mail />
            <input
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              placeholder={text.email}
            />
          </label>

          <label className="premiumField">
            <LockKeyhole />
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
              placeholder={text.password}
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </label>

          <button className="authSubmitBtn" type="submit">
            {mode === "signup" ? text.signupBtn : text.loginBtn}
            <ArrowRight />
          </button>

          <div className="authAltGrid">
            <button type="button" onClick={() => alert("Google login demo button connected in UI.")}>
              G
              {text.google}
            </button>
            <button type="button" onClick={() => setOtpSent(true)}>
              OTP
              {otpSent ? "OTP sent" : text.otp}
            </button>
          </div>

          <div className="authSwitchPremium">
            <span>{mode === "signup" ? text.switchToLogin : text.switchToSignup}</span>
            <button
              type="button"
              onClick={() => {
                const next = mode === "signup" ? "login" : "signup";
                setMode(next);
                window.history.replaceState({}, "", next === "signup" ? "/signup" : "/login");
              }}
            >
              {mode === "signup" ? text.navLogin : text.navSignup}
            </button>
          </div>

          <div className="authOfficial">
            <b>{text.official}</b>
            <a href="https://www.myscheme.gov.in/" target="_blank" rel="noreferrer">myScheme</a>
            <a href="https://www.digilocker.gov.in/" target="_blank" rel="noreferrer">DigiLocker</a>
            <a href="https://web.umang.gov.in/" target="_blank" rel="noreferrer">UMANG</a>
          </div>
        </form>
      </section>
    </main>
  );
}
