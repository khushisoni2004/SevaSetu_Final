import React, { useMemo, useState } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  UserRound,
  MapPin,
  BadgeCheck,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import "./VoiceFormHelp.css";

const PROFILE_KEY = "sevasetu_profile";

const QUESTIONS = [
  {
    key: "name",
    label: "नाम",
    question: "नमस्ते। अपना पूरा नाम बताइए।",
    example: "मेरा नाम स्नेहा सोनी है।",
  },
  {
    key: "state",
    label: "राज्य",
    question: "आप किस राज्य से हैं?",
    example: "मैं मध्य प्रदेश से हूँ।",
  },
  {
    key: "category",
    label: "श्रेणी",
    question: "आपकी श्रेणी क्या है? जैसे जनरल, ओबीसी, एससी या एसटी।",
    example: "मैं ओबीसी श्रेणी से हूँ।",
  },
  {
    key: "beneficiaryType",
    label: "लाभार्थी प्रकार",
    question: "आप छात्र, किसान, महिला, वरिष्ठ नागरिक या सामान्य नागरिक में से क्या हैं?",
    example: "मैं छात्रा हूँ।",
  },
  {
    key: "aadhaar",
    label: "आधार कार्ड",
    question: "क्या आपके पास आधार कार्ड है? हाँ या नहीं बोलिए।",
    example: "हाँ, मेरे पास आधार कार्ड है।",
  },
  {
    key: "income",
    label: "आय प्रमाण पत्र",
    question: "क्या आपके पास आय प्रमाण पत्र है?",
    example: "नहीं, आय प्रमाण पत्र नहीं है।",
  },
  {
    key: "caste",
    label: "जाति प्रमाण पत्र",
    question: "क्या आपके पास जाति प्रमाण पत्र है?",
    example: "हाँ, जाति प्रमाण पत्र है।",
  },
  {
    key: "bank",
    label: "बैंक पासबुक",
    question: "क्या आपके पास बैंक पासबुक या बैंक खाता विवरण है?",
    example: "हाँ, बैंक पासबुक है।",
  },
  {
    key: "education",
    label: "शैक्षणिक प्रमाण पत्र",
    question: "क्या आपके पास शैक्षणिक प्रमाण पत्र या मार्कशीट है?",
    example: "हाँ, मार्कशीट है।",
  },
];

const DOC_MAP = {
  aadhaar: "Aadhaar Card",
  income: "Income Certificate",
  caste: "Caste Certificate",
  bank: "Bank Passbook",
  education: "Education Certificate",
};

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function normalize(text) {
  return String(text || "").toLowerCase().trim();
}

function cleanName(answer) {
  let text = String(answer || "").trim();
  text = text.replace(/मेरा नाम|मेरी नाम|naam|name|hai|है|मैं|mai|main|हूँ|hu|hun/gi, " ");
  return text.replace(/\s+/g, " ").trim();
}

function extractState(answer) {
  const a = normalize(answer);
  const states = [
    ["madhya pradesh", "Madhya Pradesh"],
    ["मध्य प्रदेश", "Madhya Pradesh"],
    ["mp", "Madhya Pradesh"],
    ["uttar pradesh", "Uttar Pradesh"],
    ["उत्तर प्रदेश", "Uttar Pradesh"],
    ["rajasthan", "Rajasthan"],
    ["राजस्थान", "Rajasthan"],
    ["bihar", "Bihar"],
    ["बिहार", "Bihar"],
    ["jharkhand", "Jharkhand"],
    ["झारखंड", "Jharkhand"],
    ["maharashtra", "Maharashtra"],
    ["महाराष्ट्र", "Maharashtra"],
    ["gujarat", "Gujarat"],
    ["गुजरात", "Gujarat"],
    ["delhi", "Delhi"],
    ["दिल्ली", "Delhi"],
  ];

  for (const [k, v] of states) {
    if (a.includes(k)) return v;
  }

  return answer.trim();
}

function extractCategory(answer) {
  const a = normalize(answer);
  if (a.includes("obc") || a.includes("ओबीसी")) return "OBC";
  if (a.includes("sc") || a.includes("एससी")) return "SC";
  if (a.includes("st") || a.includes("एसटी")) return "ST";
  if (a.includes("general") || a.includes("जनरल") || a.includes("सामान्य")) return "General";
  if (a.includes("minority") || a.includes("अल्पसंख्यक")) return "Minority";
  return answer.trim();
}

function extractBeneficiary(answer) {
  const a = normalize(answer);
  if (a.includes("student") || a.includes("छात्र") || a.includes("छात्रा")) return "Student";
  if (a.includes("farmer") || a.includes("किसान")) return "Farmer";
  if (a.includes("woman") || a.includes("महिला")) return "Woman";
  if (a.includes("senior") || a.includes("वृद्ध") || a.includes("वरिष्ठ")) return "Senior Citizen";
  if (a.includes("worker") || a.includes("मजदूर")) return "Worker";
  return answer.trim();
}

function isYes(answer) {
  const a = normalize(answer);
  return (
    a.includes("हाँ") ||
    a.includes("ha") ||
    a.includes("haan") ||
    a.includes("yes") ||
    a.includes("hai") ||
    a.includes("है") ||
    a.includes("available")
  ) && !a.includes("नहीं") && !a.includes("nahi") && !a.includes("no");
}

function getVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  return (
    voices.find((v) => v.lang === "hi-IN" && /female|lekha|kalpana|swara|google/i.test(v.name)) ||
    voices.find((v) => v.lang === "hi-IN") ||
    voices.find((v) => v.lang?.startsWith("hi")) ||
    voices[0]
  );
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "hi-IN";
  utterance.rate = 0.88;
  utterance.pitch = 1.05;
  utterance.volume = 1;
  const voice = getVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export default function VoiceFormHelp() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [listening, setListening] = useState(false);
  const [lastAnswer, setLastAnswer] = useState("");
  const [saved, setSaved] = useState(false);

  const current = QUESTIONS[step];

  const profilePreview = useMemo(() => {
    const availableDocs = [];
    const missingDocs = [];

    Object.entries(DOC_MAP).forEach(([key, doc]) => {
      if (answers[key] === true) availableDocs.push(doc);
      if (answers[key] === false) missingDocs.push(doc);
    });

    return {
      name: answers.name || "",
      state: answers.state || "",
      category: answers.category || "",
      beneficiaryType: answers.beneficiaryType || "",
      documents: availableDocs,
      missingDocuments: missingDocs,
    };
  }, [answers]);

  const completion = Math.round(
    (Object.keys(answers).filter((k) => answers[k] !== "" && answers[k] !== undefined).length / QUESTIONS.length) * 100
  );

  function processAnswer(raw) {
    const answer = String(raw || "").trim();
    if (!answer) return;

    let value = answer;

    if (current.key === "name") value = cleanName(answer);
    else if (current.key === "state") value = extractState(answer);
    else if (current.key === "category") value = extractCategory(answer);
    else if (current.key === "beneficiaryType") value = extractBeneficiary(answer);
    else value = isYes(answer);

    setAnswers((prev) => ({ ...prev, [current.key]: value }));
    setLastAnswer(answer);

    const nextStep = Math.min(step + 1, QUESTIONS.length - 1);
    if (step < QUESTIONS.length - 1) {
      setStep(nextStep);
      setTimeout(() => speak(QUESTIONS[nextStep].question), 500);
    } else {
      setTimeout(() => speak("आपका वॉइस फॉर्म पूरा हो गया है। अब सेव प्रोफाइल पर क्लिक करें।"), 500);
    }
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("आपके browser में voice recognition support नहीं है। Chrome browser में try करें।");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    setListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setListening(false);
      processAnswer(transcript);
    };

    recognition.onerror = () => {
      setListening(false);
      speak("आवाज साफ नहीं आई। कृपया फिर से बोलिए।");
    };

    recognition.onend = () => {
      setListening(false);
    };
  }

  function saveFinalProfile() {
    const oldProfile = loadProfile();

    const finalProfile = {
      ...oldProfile,
      name: profilePreview.name || oldProfile.name || "",
      state: profilePreview.state || oldProfile.state || "",
      category: profilePreview.category || oldProfile.category || "",
      beneficiaryType: profilePreview.beneficiaryType || oldProfile.beneficiaryType || "",
      documents: Array.from(new Set([...(oldProfile.documents || []), ...profilePreview.documents])),
      missingDocuments: profilePreview.missingDocuments,
      voiceFormUpdatedAt: new Date().toISOString(),
    };

    saveProfile(finalProfile);
    setSaved(true);
    speak("प्रोफाइल सेव हो गई है। अब आप योजना खोज और आवेदन ट्रैकर में आगे बढ़ सकते हैं।");
    setTimeout(() => setSaved(false), 1800);
  }

  function resetFlow() {
    setStep(0);
    setAnswers({});
    setLastAnswer("");
    setSaved(false);
    speak(QUESTIONS[0].question);
  }

  return (
    <div className="voiceFormHelpPage">
      <section className="voiceFormHero">
        <div>
          <span><Sparkles size={16} /> वॉइस फॉर्म हेल्प</span>
          <h1>Voice Form Help</h1>
          <p>
            कम पढ़े-लिखे, ग्रामीण और वरिष्ठ नागरिकों के लिए हिंदी वॉइस सहायता। SevaSetu आवाज़ से प्रोफाइल और दस्तावेज़ स्थिति verify करता है।
          </p>
        </div>

        <aside>
          <img src="/images/sevasetu_official_logo.png" alt="SevaSetu" />
          <b>Hindi</b>
          <small>Human-like voice guidance</small>
        </aside>
      </section>

      <section className="voiceFormPanel">
        <main className="voiceQuestionCard">
          <div className="voiceFormAvatar">
            <Volume2 />
          </div>

          <span className="stepBadge">Step {step + 1} / {QUESTIONS.length}</span>
          <h2>{current.question}</h2>
          <p>{current.example}</p>

          <div className="voiceProgressBar">
            <i style={{ width: `${completion}%` }} />
          </div>

          <div className="voiceAnswerBox">
            <b>Last answer</b>
            <p>{lastAnswer || "अभी कोई जवाब रिकॉर्ड नहीं हुआ"}</p>
          </div>

          <div className="voiceFormActions">
            <button className="speakQuestionBtn" onClick={() => speak(current.question)}>
              <Volume2 /> सवाल सुनें
            </button>

            <button className="startMicBtn" onClick={startListening} disabled={listening}>
              {listening ? <MicOff /> : <Mic />}
              {listening ? "सुन रहा है..." : "जवाब बोलें"}
            </button>

            <button className="resetVoiceBtn" onClick={resetFlow}>
              <RotateCcw /> फिर से शुरू करें
            </button>
          </div>
        </main>

        <aside className="voiceProfilePreview">
          <h2>Live Profile Preview</h2>

          <div className="previewLine">
            <UserRound />
            <span>नाम</span>
            <b>{profilePreview.name || "—"}</b>
          </div>

          <div className="previewLine">
            <MapPin />
            <span>राज्य</span>
            <b>{profilePreview.state || "—"}</b>
          </div>

          <div className="previewLine">
            <BadgeCheck />
            <span>श्रेणी</span>
            <b>{profilePreview.category || "—"}</b>
          </div>

          <div className="previewLine">
            <ShieldCheck />
            <span>लाभार्थी</span>
            <b>{profilePreview.beneficiaryType || "—"}</b>
          </div>

          <div className="docPreviewBox">
            <h3><FileText /> उपलब्ध दस्तावेज़</h3>
            {profilePreview.documents.length ? (
              profilePreview.documents.map((d) => <p className="ok" key={d}><CheckCircle2 /> {d}</p>)
            ) : (
              <small>अभी कोई दस्तावेज़ उपलब्ध mark नहीं हुआ</small>
            )}
          </div>

          <div className="docPreviewBox missingDocs">
            <h3><AlertTriangle /> बाकी दस्तावेज़</h3>
            {profilePreview.missingDocuments.length ? (
              profilePreview.missingDocuments.map((d) => <p className="missing" key={d}><AlertTriangle /> {d}</p>)
            ) : (
              <small>कोई missing document mark नहीं हुआ</small>
            )}
          </div>

          <button className="saveVoiceProfileBtn" onClick={saveFinalProfile}>
            <Save />
            {saved ? "सेव हो गया" : "Save Profile"}
          </button>
        </aside>
      </section>
    </div>
  );
}
