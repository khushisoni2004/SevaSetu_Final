import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileWarning,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
} from "lucide-react";
import { api } from "../api";
import { go } from "../App.jsx";
import "./VoiceSevaBot.css";

function getProfile() {
  try {
    return {
      ...(JSON.parse(localStorage.getItem("sevasetu_user") || "{}")),
      ...(JSON.parse(localStorage.getItem("sevasetu_profile") || "{}")),
    };
  } catch {
    return {};
  }
}

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getAvailableVoices() {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices() || [];
}

function chooseBestHindiHumanVoice(voices, savedVoiceURI = "") {
  if (!voices.length) return null;

  if (savedVoiceURI) {
    const saved = voices.find((v) => v.voiceURI === savedVoiceURI);
    if (saved) return saved;
  }

  const priorityNames = [
    "swara",
    "google हिन्दी",
    "google hindi",
    "microsoft swara",
    "lekha",
    "veena",
    "heera",
    "kanya",
    "hindi",
    "hi-in",
    "india",
    "indian",
  ];

  const scored = voices
    .map((voice) => {
      const name = String(voice.name || "").toLowerCase();
      const lang = String(voice.lang || "").toLowerCase();

      let score = 0;

      if (lang === "hi-in") score += 100;
      if (lang.includes("hi")) score += 80;
      if (lang.includes("en-in")) score += 35;
      if (name.includes("hindi") || name.includes("हिन्दी")) score += 90;
      if (name.includes("swara")) score += 120;
      if (name.includes("google")) score += 45;
      if (name.includes("microsoft")) score += 45;
      if (name.includes("natural") || name.includes("online")) score += 55;
      if (name.includes("lekha") || name.includes("veena") || name.includes("heera")) score += 60;
      if (name.includes("female") || name.includes("woman")) score += 20;

      priorityNames.forEach((hint, index) => {
        if (name.includes(hint)) score += 30 - index;
      });

      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.voice || voices[0] || null;
}

function makeHindiSpeechText(text) {
  let output = String(text || "");

  output = output.replaceAll("Aapke current voice query ke basis par", "आपकी आवाज़ में पूछी गई जानकारी के आधार पर");
  output = output.replaceAll("Aapke query aur profile ke basis par", "आपकी प्रोफाइल और सवाल के आधार पर");
  output = output.replaceAll("best match lag rahi hai", "सबसे बेहतर मिलान लग रही है");
  output = output.replaceAll("sabse better match lag rahi hai", "सबसे बेहतर मिलान लग रही है");
  output = output.replaceAll("Match score", "मैच स्कोर");
  output = output.replaceAll("Iska match score", "इसका मैच स्कोर");
  output = output.replaceAll("percent hai", "प्रतिशत है");
  output = output.replaceAll("Missing documents", "गुम दस्तावेज़");
  output = output.replaceAll("Final eligibility official government portal par confirm hoti hai", "अंतिम पात्रता आधिकारिक सरकारी पोर्टल पर ही confirm होती है");
  output = output.replaceAll("Aapke documents ka readiness achha lag raha hai", "आपके दस्तावेज़ों की तैयारी अच्छी लग रही है");

  return output;
}

function speak(text, selectedVoiceURI = "", replyLanguage = "hindi") {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const voices = getAvailableVoices();
  const bestVoice = chooseBestHindiHumanVoice(voices, selectedVoiceURI);

  const cleanText =
    replyLanguage === "english"
      ? String(text || "")
          .replaceAll("Aapke", "Your")
          .replaceAll("hai", "is")
          .replaceAll("lag rahi hai", "seems")
          .replaceAll("scheme", "scheme")
      : makeHindiSpeechText(text);

  const utterance = new SpeechSynthesisUtterance(cleanText);

  if (bestVoice) {
    utterance.voice = bestVoice;
    utterance.lang =
      replyLanguage === "english" ? bestVoice.lang || "en-IN" : bestVoice.lang || "hi-IN";
  } else {
    utterance.lang = replyLanguage === "english" ? "en-IN" : "hi-IN";
  }

  utterance.rate = 0.86;
  utterance.pitch = 1.08;
  utterance.volume = 1;

  utterance.lang = replyLanguage === "hindi" ? "hi-IN" : "en-US";
    utterance.voice = pickVoiceForLanguage(window.speechSynthesis.getVoices(), replyLanguage) || utterance.voice;
    speechSynthesis.speak(utterance);
}


const SAMPLE_QUERIES = [
  "Main MP ki student hu low income hai mere liye scheme batao",
  "Mere paas Aadhaar hai lekin caste certificate nahi hai kaunsi scheme milegi",
  "Main farmer hu agriculture subsidy ke liye scheme batao",
  "Women ke liye health aur support schemes batao",
];


function pickVoiceForLanguage(voices, language) {
  const list = Array.isArray(voices) ? voices : [];

  if (language === "hindi") {
    return (
      list.find((v) => String(v.lang || "").toLowerCase().startsWith("hi")) ||
      list.find((v) => String(v.name || "").toLowerCase().includes("hindi")) ||
      list.find((v) => String(v.name || "").toLowerCase().includes("heera")) ||
      list.find((v) => String(v.name || "").toLowerCase().includes("kalpana")) ||
      null
    );
  }

  return (
    list.find((v) => String(v.lang || "").toLowerCase() === "en-in") ||
    list.find((v) => String(v.lang || "").toLowerCase().startsWith("en")) ||
    null
  );
}

export default function VoiceSevaBot() {
  const recognitionRef = useRef(null);
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(
    localStorage.getItem("sevasetu_voice_uri") || ""
  );
  const [replyLanguage, setReplyLanguage] = useState(
    localStorage.getItem("sevasetu_reply_language") || "english"
  );
  const profile = useMemo(() => getProfile(), []);
  const [voiceCategory, setVoiceCategory] = useState(
    localStorage.getItem("sevasetu_voice_category") || getProfile().category || ""
  );
  const [voiceState, setVoiceState] = useState(
    localStorage.getItem("sevasetu_voice_state") || getProfile().state || ""
  );
  const [matches, setMatches] = useState([]);
  const [extracted, setExtracted] = useState(null);

  useEffect(() => {
    function loadVoices() {
      const voices = getAvailableVoices();
      setAvailableVoices(voices);

      if (!localStorage.getItem("sevasetu_voice_uri")) {
        const best = chooseBestHindiHumanVoice(voices);
        if (best?.voiceURI) {
          setSelectedVoiceURI(best.voiceURI);
          localStorage.setItem("sevasetu_voice_uri", best.voiceURI);
        }
      }
    }

    loadVoices();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    setTimeout(loadVoices, 300);
    setTimeout(loadVoices, 1000);
  }, []);

  function saveSelectedVoice(uri) {
    setSelectedVoiceURI(uri);
    localStorage.setItem("sevasetu_voice_uri", uri);
  }



  function startListening() {
    const Recognition = getSpeechRecognition();

    if (!Recognition) {
      alert("Speech recognition is not supported in this browser. Use Chrome for best result.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = replyLanguage === "english" ? "en-IN" : "hi-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      setQuery((finalText || interimText).trim());
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setListening(false);
  }

  async function askBot(customQuery) {
    const finalQuery = String(customQuery || query).trim();

    if (!finalQuery) {
      alert("Please speak or type your question first.");
      return;
    }

    try {
      setLoading(true);
      setReply("");
      setMatches([]);
      setExtracted(null);

      const result = await api("/api/ai/voice-query-v6", {
        method: "POST",
        body: JSON.stringify({
          query: finalQuery,
          profile: {
            ...profile,
            state: voiceState || "",
            selectedState: voiceState || "",
            category: voiceCategory || "",
            selectedCategory: voiceCategory || "",
          },
          language: replyLanguage,
        }),
      });

      setReply(result.reply || "");
      setMatches(result.matchedSchemes || []);
      setExtracted(result.extractedProfile || null);

      if (result.reply) {
        speak(result.reply, selectedVoiceURI, replyLanguage);
      }
    } catch (error) {
      alert(error.message || "Voice SevaBot failed. Please check backend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="voiceBotPage">
      <section className="voiceBotHero">
        <div>
          <span>
            <Sparkles size={15} />
            AI Voice Assistant
          </span>

          <h1>Voice SevaBot</h1>

          <p>
            Speak your need in simple Hindi or English. SevaBot understands your
            query, checks profile and documents, then suggests matching schemes.
          </p>
        </div>

        <aside>
          <img src="/images/sevasetu_official_logo.png" alt="SevaSetu" />
          <b>AI</b>
          <small>Scheme Assistant</small>
        </aside>
      </section>

      <section className="voiceBotPanel">
        <div className="voiceInputCard">
          <div className="voiceBotAvatar">
            <Bot size={38} />
          </div>

          <h2>Ask by Voice</h2>

          <p>
            Example: “Main MP ki student hu, low income hai, mere liye scheme batao.”
          </p>

          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Speak or type your scheme need here..."
          />

          <div className="voiceStyleBox languageVoiceBox">
            <label>
              Reply Language
              <select
                value={replyLanguage}
                onChange={(e) => {
                  setReplyLanguage(e.target.value);
                  localStorage.setItem("sevasetu_reply_language", e.target.value);
                }}
              >
                <option value="english">English Reply</option>
                <option value="hindi">Hindi Reply</option>
              </select>
            </label>

            <label>
              Real Voice
              <select
                value={selectedVoiceURI}
                onChange={(e) => saveSelectedVoice(e.target.value)}
              >
                {availableVoices.length === 0 ? (
                  <option value="">Loading voices...</option>
                ) : (
                  availableVoices
                    .filter((voice) => {
                      const name = String(voice.name || "").toLowerCase();
                      const lang = String(voice.lang || "").toLowerCase();
                      return (
                        lang.includes("hi") ||
                        lang.includes("en-in") ||
                        name.includes("hindi") ||
                        name.includes("india") ||
                        name.includes("indian") ||
                        name.includes("swara") ||
                        name.includes("lekha") ||
                        name.includes("veena") ||
                        name.includes("google") ||
                        name.includes("microsoft")
                      );
                    })
                    .map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} — {voice.lang}
                      </option>
                    ))
                )}
              </select>
            </label>

            <button
              type="button"
              className="testVoiceBtn"
              onClick={() =>
                speak(
                  "नमस्ते, मैं सेवा सेतु की आवाज़ सहायक हूँ। मैं आपकी योजना खोजने में मदद कर सकती हूँ।",
                  selectedVoiceURI
                )
              }
            >
              Test Hindi Voice
            </button>
          </div>

          <div className="voiceCategoryBox voiceProfileOptions">
            <label>
              State
              <select
                value={voiceState}
                onChange={(e) => {
                  setVoiceState(e.target.value);
                  localStorage.setItem("sevasetu_voice_state", e.target.value);
                }}
              >
                <option value="">Select state</option>
                <option value="All India">All India</option>
                <option value="Madhya Pradesh">Madhya Pradesh</option>
                <option value="Uttar Pradesh">Uttar Pradesh</option>
                <option value="Rajasthan">Rajasthan</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Gujarat">Gujarat</option>
                <option value="Bihar">Bihar</option>
                <option value="Punjab">Punjab</option>
                <option value="Delhi">Delhi</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Kerala">Kerala</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="West Bengal">West Bengal</option>
                <option value="Odisha">Odisha</option>
                <option value="Assam">Assam</option>
              </select>
            </label>

            <label>
              Category / Caste
              <select
                value={voiceCategory}
                onChange={(e) => {
                  setVoiceCategory(e.target.value);
                  localStorage.setItem("sevasetu_voice_category", e.target.value);
                }}
              >
                <option value="">Select category / caste</option>
                <option value="General">General</option>
                <option value="OBC">OBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="EWS">EWS</option>
                <option value="Minority">Minority</option>
              </select>
            </label>

            {(!voiceState || !voiceCategory) && (
              <p>Please select state and category/caste first for accurate scheme matching.</p>
            )}
          </div>

          <div className="voiceActions">
            {!listening ? (
              <button className="micBtn" onClick={startListening}>
                <Mic size={18} />
                Start Voice
              </button>
            ) : (
              <button className="stopBtn" onClick={stopListening}>
                <MicOff size={18} />
                Stop
              </button>
            )}

            <button className="askBtn" onClick={() => askBot()} disabled={loading}>
              <Send size={18} />
              {loading ? "Finding..." : "Find Schemes"}
            </button>

            <button className="speakBtn" onClick={() => speak(reply, selectedVoiceURI, replyLanguage)} disabled={!reply}>
              <Volume2 size={18} />
              Speak Reply
            </button>
          </div>

          <div className="sampleQueryBox">
            <b>Try sample queries</b>

            <div>
              {SAMPLE_QUERIES.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setQuery(item);
                    askBot(item);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="voiceReplyCard">
          <h2>SevaBot Reply</h2>

          {reply ? (
            <p>{reply}</p>
          ) : (
            <p className="emptyReply">
              Your AI response will appear here after speaking or typing a query.
            </p>
          )}

          {extracted && (
            <div className="extractedBox">
              <b>Detected from voice</b>

              <div>
                {Object.entries(extracted)
                  .filter(([, value]) => {
                    if (Array.isArray(value)) return value.length > 0;
                    return Boolean(value);
                  })
                  .map(([key, value]) => (
                    <span key={key}>
                      {key}: {Array.isArray(value) ? value.join(", ") : String(value)}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </aside>
      </section>

      <section className="voiceMatchesSection">
        <div className="voiceSectionHead">
          <h2>Top Matching Schemes</h2>
          <p>Ranked using profile, voice query, documents and scheme text.</p>
        </div>

        {matches.length === 0 ? (
          <div className="noVoiceMatches">
            <Bot size={34} />
            <b>No schemes searched yet</b>
            <span>Ask SevaBot to find matching schemes.</span>
          </div>
        ) : (
          <div className="voiceMatchGrid">
            {matches.map((scheme) => (
              <article key={scheme.id} className="voiceSchemeCard">
                <div className="voiceSchemeTop">
                  <span>{scheme.category || "Scheme"}</span>
                  <b>{scheme.score}%</b>
                </div>

                <h3>{scheme.title}</h3>

                <p>{scheme.benefits}</p>

                <div className="voiceReasonBox">
                  {(scheme.reasons || []).slice(0, 4).map((reason) => (
                    <small key={reason}>
                      <CheckCircle2 size={14} />
                      {reason}
                    </small>
                  ))}
                </div>

                {scheme.missingDocuments?.length > 0 && (
                  <div className="voiceMissingDocs">
                    <FileWarning size={15} />
                    Missing: {scheme.missingDocuments.slice(0, 3).join(", ")}
                  </div>
                )}

                <button onClick={() => go(`/app/schemes/${scheme.id}`)}>
                  View Scheme
                  <ArrowRight size={17} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
