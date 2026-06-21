import React, { useEffect, useState } from "react";
import "./LoginSignupPage.css";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  Languages,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import { go } from "../App.jsx";

const TEXT = {
  en: {
    login: "Login",
    signup: "Sign Up",
    brandSub: "Government support made simple",
    emailMobile: "Email or Mobile Number",
    password: "Password",
    fullName: "Full Name",
    mobile: "Mobile Number",
    enterEmail: "Enter your email or mobile number",
    enterPassword: "Enter your password",
    enterName: "Enter your full name",
    enterMobile: "Enter your mobile number",
    remember: "Remember me",
    forgot: "Forgot Password?",
    newHere: "New here?",
    already: "Already have an account?",
    createAccount: "Create an account",
    loginBtn: "Login",
    signupBtn: "Create Account",
    secure: "Secure",
    verified: "Verified Schemes",
    easy: "Easy Access",
  },
  hi: {
    login: "लॉगिन",
    signup: "साइन अप",
    brandSub: "सरकारी सहायता अब सरल",
    emailMobile: "ईमेल या मोबाइल नंबर",
    password: "पासवर्ड",
    fullName: "पूरा नाम",
    mobile: "मोबाइल नंबर",
    enterEmail: "ईमेल या मोबाइल नंबर दर्ज करें",
    enterPassword: "पासवर्ड दर्ज करें",
    enterName: "पूरा नाम दर्ज करें",
    enterMobile: "मोबाइल नंबर दर्ज करें",
    remember: "मुझे याद रखें",
    forgot: "पासवर्ड भूल गए?",
    newHere: "नए हैं?",
    already: "पहले से अकाउंट है?",
    createAccount: "अकाउंट बनाएँ",
    loginBtn: "लॉगिन",
    signupBtn: "अकाउंट बनाएँ",
    secure: "सुरक्षित",
    verified: "सत्यापित योजनाएँ",
    easy: "आसान पहुँच",
  },
};

export default function LoginSignupPage({ language = "en", setLanguage, initialMode }) {
  const pathMode = window.location.pathname.includes("signup") ? "signup" : "login";
  const [mode, setMode] = useState(initialMode || pathMode);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    localStorage.getItem("sevasetu_remember_login") === "true"
  );

  const [form, setForm] = useState({
    name: "",
    email: localStorage.getItem("sevasetu_remember_email") || "",
    mobile: "",
    password: "",
  });

  const text = TEXT[language] || TEXT.en;

  useEffect(() => {
    const remembered = localStorage.getItem("sevasetu_remember_login") === "true";
    const savedEmail = localStorage.getItem("sevasetu_remember_email") || "";

    if (remembered && savedEmail) {
      setRememberMe(true);
      setForm((prev) => ({ ...prev, email: savedEmail }));
    }
  }, []);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    window.history.replaceState({}, "", nextMode === "signup" ? "/signup" : "/login");
  }

  async function submit(e) {
    e.preventDefault();

    try {
      setLoading(true);

      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

      const payload =
        mode === "signup"
          ? {
              name: form.name.trim(),
              email: form.email.trim(),
              mobile: form.mobile.trim(),
              password: form.password,
            }
          : {
              email: form.email.trim(),
              password: form.password,
            };

      if (mode === "signup") {
        if (!payload.name || !payload.email || !payload.password) {
          alert("Please fill name, email and password.");
          return;
        }
      }

      if (mode === "login") {
        if (!payload.email || !payload.password) {
          alert("Please fill email/mobile and password.");
          return;
        }
      }

      const endpoint =
        mode === "signup"
          ? `${API_URL}/api/auth/register`
          : `${API_URL}/api/auth/login`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "Authentication failed. Please try again.");
        return;
      }

      localStorage.setItem("sevasetu_user", JSON.stringify(data.user));
      localStorage.setItem("sevasetu_token", data.token);
      localStorage.setItem("sevasetu_auth_token", data.token);

      if (mode === "login" && rememberMe) {
        localStorage.setItem("sevasetu_remember_login", "true");
        localStorage.setItem("sevasetu_remember_email", form.email.trim());
      } else if (mode === "login") {
        localStorage.removeItem("sevasetu_remember_login");
        localStorage.removeItem("sevasetu_remember_email");
      }

      alert(data.message || "Success");
      go("/app/dashboard");
    } catch (error) {
      console.error(error);
      alert("Backend is not running. Please start backend first.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authPageSeparate">
      <section className="authFormSideNew">
        <form className="authFormCardNew" onSubmit={submit}>
          <div className="authTopLang">
            <label>
              <Languages size={16} />
              <select
                value={language}
                onChange={(e) => {
                  setLanguage?.(e.target.value);
                  localStorage.setItem("sevasetu_language", e.target.value);
                }}
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </label>
          </div>

          <div className="formBrand">
            <h2>
              <span className="seva">Seva</span>{" "}
              <span className="setu">Setu</span>
            </h2>
            <p>{text.brandSub}</p>
            <div className="brandUnderline">
              <span />
              <b />
            </div>
          </div>

          <div className="formTabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              {text.login}
            </button>

            <button
              type="button"
              className={mode === "signup" ? "active" : ""}
              onClick={() => switchMode("signup")}
            >
              {text.signup}
            </button>
          </div>

          {mode === "signup" && (
            <>
              <label className="fieldLabel">{text.fullName}</label>
              <div className="inputWrap">
                <User size={18} />
                <input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder={text.enterName}
                  autoComplete="name"
                />
              </div>

              <label className="fieldLabel">{text.mobile}</label>
              <div className="inputWrap">
                <Phone size={18} />
                <input
                  value={form.mobile}
                  onChange={(e) => update("mobile", e.target.value)}
                  placeholder={text.enterMobile}
                  autoComplete="tel"
                />
              </div>
            </>
          )}

          <label className="fieldLabel">{text.emailMobile}</label>
          <div className="inputWrap">
            <Mail size={18} />
            <input
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder={text.enterEmail}
              autoComplete="email"
            />
          </div>

          <label className="fieldLabel">{text.password}</label>
          <div className="inputWrap">
            <Lock size={18} />
            <input
              type={showPass ? "text" : "password"}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder={text.enterPassword}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />

            <button
              type="button"
              className="eyeBtn"
              onClick={() => setShowPass((prev) => !prev)}
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {mode === "login" && (
            <div className="formOptions">
              <label>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                {text.remember}
              </label>
              <button type="button">{text.forgot}</button>
            </div>
          )}

          <button className="mainSubmit" type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "login"
                ? text.loginBtn
                : text.signupBtn}
          </button>

          <div className="orLine">
            <span />
            <b>or</b>
            <span />
          </div>

          <div className="switchText">
            {mode === "login" ? text.newHere : text.already}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? text.createAccount : text.login}
            </button>
          </div>

          <div className="trustBoxes">
            <article>
              <ShieldCheck size={22} />
              <b>{text.secure}</b>
            </article>
            <article>
              <BookOpen size={22} />
              <b>{text.verified}</b>
            </article>
            <article>
              <ArrowRight size={22} />
              <b>{text.easy}</b>
            </article>
          </div>
        </form>
      </section>
    </main>
  );
}
