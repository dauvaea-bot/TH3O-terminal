import { useState, useEffect, useCallback } from "react";

// ─── FEEDS ────────────────────────────────────────────────────────────────────
const PROXY = "https://api.allorigins.win/get?url=";
const FF_NEWS = PROXY + encodeURIComponent("https://www.forexfactory.com/rss.php");
const FF_CALENDAR = PROXY + encodeURIComponent("https://www.forexfactory.com/ffcal_week_this.xml");

// ─── DESIGN ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#04080f",
  panel: "#080f1c",
  border: "#0e1f35",
  dim: "#060d18",
  accent: "#00c2ff",
  green: "#00b37a",
  red: "#e0304a",
  gold: "#e8a020",
  muted: "#3a5570",
  text: "#8fb0cc",
  bright: "#cce4f5",
  white: "#eaf4ff",
};

const STATUS_META = {
  FAVORABLE: { color: "#00b37a", label: "FAVORABLE", desc: "Macro, timing, and volatility context are aligned. Structure and execution remain with the trader." },
  MIXED: { color: "#e8a020", label: "MIXED", desc: "Some context conditions are aligned, others are not. Review each factor individually." },
  UNFAVORABLE: { color: "#e0304a", label: "UNFAVORABLE", desc: "Context conditions are not aligned. Elevated noise, event risk, or macro conflict is present." },
};

const EFFECT_META = {
  MARKET: { color: "#00c2ff", label: "MARKET EFFECT" },
  INDUSTRY: { color: "#e8a020", label: "INDUSTRY EFFECT" },
  COMPANY: { color: "#3a5570", label: "COMPANY EFFECT" },
};

const WINDOWS = [
  { id:"pre", label:"PRE-POSITION", time:"8:55–9:25" },
  { id:"open", label:"OPEN AUCTION", time:"9:30–9:33" },
  { id:"trap", label:"TRAP CONFIRM", time:"9:33–9:39" },
  { id:"expand", label:"EXPANSION", time:"9:39–10:00" },
  { id:"cont", label:"CONTINUATION", time:"10:00+" },
];

function getWindowId() {
  const t = new Date().getHours() * 60 + new Date().getMinutes();
  if (t < 8*60+55) return "pre";
  if (t < 9*60+30) return "pre";
  if (t < 9*60+33) return "open";
  if (t < 9*60+39) return "trap";
  if (t < 10*60) return "expand";
  return "cont";
}

function getSession() {
  const h = new Date().getUTCHours();
  if (h >= 13 && h < 22) return "NEW YORK";
  if (h >= 7 && h < 13) return "LONDON";
  return "ASIA";
}

function isInKeyWindow() {
  const t = new Date().getHours() * 60 + new Date().getMinutes();
  return (t >= 8*60+55 && t < 9*60+33) || (t >= 9*60+39 && t < 10*60);
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
const mono = { fontFamily:"'IBM Plex Mono', monospace" };

function FieldLabel({ children }) {
  return (
    <div style={{ ...mono, fontSize:8, letterSpacing:"0.18em", color:C.muted,
      textTransform:"uppercase", marginBottom:5 }}>
      {children}
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ padding:"9px 0", borderBottom:`1px solid ${C.border}25` }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ color: color || C.bright, fontSize:12, fontWeight:700, ...mono }}>
        {value || <span style={{ color:C.muted }}>—</span>}
      </div>
    </div>
  );
}

function Tag({ text, color }) {
  return (
    <span style={{ ...mono, fontSize:8, fontWeight:700, letterSpacing:"0.1em",
      padding:"2px 7px", borderRadius:2,
      background:`${color}18`, color, border:`1px solid ${color}40` }}>
      {text}
    </span>
  );
}

function PanelHeader({ label, sub }) {
  return (
    <div style={{ padding:"12px 18px", borderBottom:`1px solid ${C.border}`,
      display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <span style={{ ...mono, fontSize:9, letterSpacing:"0.2em", color:C.accent, fontWeight:700 }}>{label}</span>
      {sub && <span style={{ ...mono, fontSize:8, color:C.muted }}>{sub}</span>}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"16px 0" }}>
      <div style={{ width:10, height:10, border:`1.5px solid ${C.border}`,
        borderTop:`1.5px solid ${C.accent}`, borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
      <span style={{ ...mono, fontSize:9, color:C.muted }}>Synthesizing…</span>
    </div>
  );
}

// ─── PANEL 1: MACRO WAR ROOM ──────────────────────────────────────────────────
function MacroPanel({ macro, news, loading, onRefresh, lastUpdated }) {
  const pressureColor = (v) => {
    if (!v) return C.muted;
    if (v === "UPSIDE") return C.green;
    if (v === "DOWNSIDE") return C.red;
    return C.gold;
  };
  const toneColor = (v) => {
    if (!v) return C.muted;
    const up = /dovish|cooling|soft|resilient|risk.on|upside/i.test(v);
    const down = /hawkish|hot|weak|slowing|risk.off|downside/i.test(v);
    return up ? C.green : down ? C.red : C.gold;
  };

  return (
    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:6,
      display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"12px 18px", borderBottom:`1px solid ${C.border}`,
        display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ ...mono, fontSize:9, letterSpacing:"0.2em", color:C.accent, fontWeight:700 }}>
          MACRO WAR ROOM
        </span>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {lastUpdated && (
            <span style={{ ...mono, fontSize:8, color:C.muted }}>
              {lastUpdated.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true})}
            </span>
          )}
          <button onClick={onRefresh} disabled={loading}
            style={{ ...mono, fontSize:8, color:loading?C.muted:C.accent, background:"none",
              border:`1px solid ${loading?C.border:C.accent}40`, borderRadius:3,
              padding:"3px 8px", cursor:loading?"not-allowed":"pointer" }}>
            {loading ? "…" : "↻"}
          </button>
        </div>
      </div>

      <div style={{ padding:"4px 18px 6px" }}>
        {loading && !macro ? <Spinner/> : <>
          <Row label="Fed Tone" value={macro?.fed_tone} color={toneColor(macro?.fed_tone)}/>
          <Row label="Inflation" value={macro?.inflation} color={toneColor(macro?.inflation)}/>
          <Row label="Jobs" value={macro?.jobs} color={toneColor(macro?.jobs)}/>
          <Row label="Growth" value={macro?.growth} color={toneColor(macro?.growth)}/>
          <Row label="Risk Tone" value={macro?.risk_tone} color={toneColor(macro?.risk_tone)}/>
          <Row label="YM Macro Pressure" value={macro?.ym_pressure} color={pressureColor(macro?.ym_pressure)}/>
          <Row label="NQ Macro Pressure" value={macro?.nq_pressure} color={pressureColor(macro?.nq_pressure)}/>
        </>}
      </div>

      <div style={{ height:1, background:C.border, margin:"8px 18px" }}/>

      <div style={{ padding:"0 18px 14px" }}>
        <FieldLabel>NEWS CLASSIFICATION</FieldLabel>
        {loading && !news.length ? <Spinner/> : (
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:8 }}>
            {news.map((item, i) => {
              const meta = EFFECT_META[item.effect] || EFFECT_META.COMPANY;
              const impactCol = item.impact==="HIGH" ? C.red : item.impact==="MED" ? C.gold : C.muted;
              return (
                <div key={i} style={{ borderLeft:`2px solid ${meta.color}`, paddingLeft:10 }}>
                  <div style={{ display:"flex", gap:5, marginBottom:4 }}>
                    <Tag text={meta.label} color={meta.color}/>
                    <Tag text={item.impact} color={impactCol}/>
                  </div>
                  <div style={{ color:C.bright, fontSize:10, lineHeight:1.5, marginBottom:3 }}>
                    {item.headline}
                  </div>
                  <div style={{ color:C.text, fontSize:9, lineHeight:1.5 }}>
                    <span style={{ color:meta.color }}>▸ </span>{item.implication}
                  </div>
                </div>
              );
            })}
            {!loading && !news.length && (
              <div style={{ color:C.muted, fontSize:10, ...mono }}>No headlines loaded.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PANEL 2: SESSION CONTEXT ─────────────────────────────────────────────────
function ContextPanel({ events, calLoading }) {
  const activeId = getWindowId();
  const session = getSession();
  const sessionColor = session === "NEW YORK" ? C.accent : session === "LONDON" ? C.gold : C.muted;

  return (
    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:6,
      display:"flex", flexDirection:"column" }}>
      <PanelHeader label="SESSION CONTEXT" sub="time + environment"/>

      <div style={{ padding:"12px 18px", flex:1 }}>

        {/* Session */}
        <div style={{ marginBottom:16 }}>
          <FieldLabel>Active Session</FieldLabel>
          <div style={{ color:sessionColor, fontSize:13, fontWeight:700, ...mono }}>{session}</div>
        </div>

        {/* Time windows */}
        <div style={{ marginBottom:16 }}>
          <FieldLabel>NY Time Windows</FieldLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:4, marginTop:6 }}>
            {WINDOWS.map(w => {
              const active = w.id === activeId;
              return (
                <div key={w.id} style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"7px 10px", borderRadius:4,
                  background: active ? `${C.accent}12` : "transparent",
                  border: active ? `1px solid ${C.accent}35` : `1px solid transparent`,
                }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <div style={{ width:5, height:5, borderRadius:"50%", flexShrink:0,
                      background: active ? C.accent : C.border,
                      animation: active ? "pulse 2s infinite" : "none" }}/>
                    <span style={{ ...mono, fontSize:9,
                      color: active ? C.accent : C.muted,
                      fontWeight: active ? 700 : 400 }}>
                      {w.label}
                    </span>
                  </div>
                  <span style={{ ...mono, fontSize:8, color:C.muted }}>{w.time}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ height:1, background:C.border, margin:"4px 0 14px" }}/>

        {/* Market environment — static behavioral labels, no structure */}
        <div style={{ marginBottom:16 }}>
          <FieldLabel>Market Environment</FieldLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
            {[
              ["Volatility", "NORMAL", C.green],
              ["Market Behavior","EXPANDING", C.green],
            ].map(([lbl, val, col]) => (
              <div key={lbl} style={{ background:C.dim, borderRadius:4, padding:"9px 10px" }}>
                <FieldLabel>{lbl}</FieldLabel>
                <div style={{ color:col, fontSize:11, fontWeight:700, ...mono }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height:1, background:C.border, margin:"4px 0 14px" }}/>

        {/* Upcoming events — live from FF */}
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <FieldLabel>Upcoming Events</FieldLabel>
            <div style={{ display:"flex", gap:5, alignItems:"center" }}>
              <div style={{ width:5, height:5, borderRadius:"50%",
                background: calLoading ? C.gold : C.green,
                animation:"pulse 2s infinite" }}/>
              <span style={{ ...mono, fontSize:8, color: calLoading ? C.gold : C.green }}>
                {calLoading ? "LOADING" : "LIVE"}
              </span>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {calLoading && !events.length && <Spinner/>}
            {events.map((ev, i) => {
              const impactCol = ev.impact==="HIGH" ? C.red : ev.impact==="MED" ? C.gold : C.muted;
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"7px 10px", borderRadius:4,
                  background: ev.impact==="HIGH" ? `${C.red}08` : "transparent",
                  border: ev.impact==="HIGH" ? `1px solid ${C.red}20` : `1px solid ${C.border}30` }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:impactCol, flexShrink:0 }}/>
                  <span style={{ ...mono, fontSize:9, color:C.accent, minWidth:40 }}>{ev.time}</span>
                  <span style={{ color:C.text, fontSize:10, flex:1 }}>{ev.event}</span>
                  <Tag text={ev.impact} color={impactCol}/>
                </div>
              );
            })}
            {!calLoading && !events.length && (
              <div style={{ color:C.muted, fontSize:10, ...mono }}>No events found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PANEL 3: EXECUTION ASSISTANT ────────────────────────────────────────────
function ExecutionPanel({ macro, events }) {
  // Derive checklist from live data — context only, no decisions
  const highImpactSoon = events.some(e => {
    if (e.impact !== "HIGH") return false;
    const [h, m] = (e.time || "").split(":").map(Number);
    if (isNaN(h)) return false;
    const evMins = h * 60 + m;
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    return evMins - nowMins >= 0 && evMins - nowMins <= 30;
  });

  const checklist = [
    { label:"Macro context aligned", status: macro ? (macro.risk_tone || "").toUpperCase().includes("RISK-ON") : null },
    { label:"In key time window", status: isInKeyWindow() },
    { label:"High-impact event within 30 min", status: highImpactSoon, invert: true },
    { label:"Volatility context normal", status: true },
  ];

  const passed = checklist.filter(c => c.status === true && !c.invert).length
                  + checklist.filter(c => c.status === false && c.invert).length;
  const notPassed = checklist.length - passed;

  const statusKey = passed === 4 ? "FAVORABLE" : passed >= 2 ? "MIXED" : "UNFAVORABLE";
  const sm = STATUS_META[statusKey];

  return (
    <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:6,
      display:"flex", flexDirection:"column" }}>
      <PanelHeader label="EXECUTION ASSISTANT" sub="context checklist"/>

      <div style={{ padding:"12px 18px", flex:1 }}>
        <div style={{ marginBottom:18 }}>
          <FieldLabel>Pre-Execution Context</FieldLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:10 }}>
            {checklist.map((item, i) => {
              const isPositive = item.invert ? item.status === false : item.status === true;
              const isNull = item.status === null;
              const col = isNull ? C.muted : isPositive ? C.green : C.red;
              const val = isNull ? "—" : isPositive ? "YES" : "NO";
              return (
                <div key={i} style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"10px 12px", borderRadius:4,
                  background: isNull ? `${C.muted}08` : isPositive ? `${C.green}08` : `${C.red}08`,
                  border:`1px solid ${col}25`,
                }}>
                  <span style={{ color:C.text, fontSize:11 }}>{item.label}</span>
                  <span style={{ ...mono, fontSize:10, fontWeight:700, color:col }}>{val}</span>
                </div>
              );
            })}
          </div>

          {/* Descriptive summary — no score */}
          <div style={{ marginTop:10, padding:"8px 10px", background:C.dim, borderRadius:4 }}>
            <span style={{ ...mono, fontSize:9, color:C.text }}>
              {passed} condition{passed!==1?"s":""} aligned, {notPassed} not aligned
            </span>
          </div>
        </div>

        <div style={{ height:1, background:C.border, marginBottom:16 }}/>

        {/* Role note */}
        <div style={{ background:C.dim, borderRadius:4, padding:"10px 12px", marginBottom:16,
          borderLeft:`2px solid ${C.muted}` }}>
          <div style={{ ...mono, fontSize:8, color:C.muted, marginBottom:4 }}>NOTE</div>
          <div style={{ color:C.text, fontSize:10, lineHeight:1.6 }}>
            This checklist reflects context only. You determine structure, entry, and execution.
          </div>
        </div>

        {/* Context Condition */}
        <div style={{ background:`${sm.color}10`, border:`1px solid ${sm.color}35`,
          borderRadius:4, padding:"16px 14px" }}>
          <div style={{ ...mono, fontSize:8, color:C.muted, letterSpacing:"0.18em", marginBottom:8 }}>
            CONTEXT CONDITION
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:C.muted, ...mono, marginBottom:4 }}>
            Context Condition:
          </div>
          <div style={{ fontSize:20, fontWeight:900, color:sm.color,
            fontFamily:"'Barlow Condensed', sans-serif", letterSpacing:"0.06em", marginBottom:10 }}>
            {sm.label}
          </div>
          <div style={{ ...mono, fontSize:9, color:C.text, lineHeight:1.7 }}>
            {sm.desc}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [time, setTime] = useState(new Date());
  const [rawNews, setRawNews] = useState([]);
  const [events, setEvents] = useState([]);
  const [macro, setMacro] = useState(null);
  const [news, setNews] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [calLoading, setCalLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── Clock ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    const t = setInterval(()=>setTime(new Date()), 1000);
    return ()=>clearInterval(t);
  }, []);

  // ── Fetch FF calendar ──────────────────────────────────────────────────────
  const fetchCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      const res = await fetch(FF_CALENDAR);
      const d = await res.json();
      const parser = new DOMParser();
      const doc = parser.parseFromString(d.contents, "text/xml");
      const all = [...doc.querySelectorAll("event")].map(ev => {
        const raw = (ev.querySelector("impact")?.textContent || "").trim();
        const impact = /high|red/i.test(raw) ? "HIGH" : /med|orange/i.test(raw) ? "MED" : "LOW";
        return {
          time: ev.querySelector("time")?.textContent || "—",
          ccy: ev.querySelector("country")?.textContent || "",
          event: ev.querySelector("title")?.textContent || "",
          forecast: ev.querySelector("forecast")?.textContent || "—",
          impact,
        };
      }).filter(e => e.event && e.ccy === "USD");
      setEvents(all.slice(0, 8));
    } catch {}
    setCalLoading(false);
  }, []);

  // ── Fetch FF news + run AI synthesis ──────────────────────────────────────
  const fetchAndSynthesize = useCallback(async () => {
    setAiLoading(true);
    let headlines = [];
    try {
      const res = await fetch(FF_NEWS);
      const d = await res.json();
      const parser = new DOMParser();
      const doc = parser.parseFromString(d.contents, "text/xml");
      headlines = [...doc.querySelectorAll("item")]
        .map(el => el.querySelector("title")?.textContent || "")
        .filter(Boolean)
        .slice(0, 15);
      setRawNews(headlines);
    } catch {}

    if (!headlines.length) { setAiLoading(false); return; }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a macro context assistant for a futures trader who trades NQ and YM.
Your job is to read headlines and output a structured JSON context summary.

Respond ONLY with valid JSON — no markdown, no extra text:
{
  "macro": {
    "fed_tone": "one of: DOVISH / DOVISH LEAN / NEUTRAL / HAWKISH LEAN / HAWKISH",
    "inflation": "one of: COOLING / STABLE / ELEVATED / HOT",
    "jobs": "one of: WEAK / SOFTENING / RESILIENT / STRONG",
    "growth": "one of: CONTRACTING / SLOWING / STABLE / EXPANDING",
    "risk_tone": "one of: RISK-OFF / MIXED / RISK-ON",
    "ym_pressure": "one of: DOWNSIDE / NEUTRAL / UPSIDE",
    "nq_pressure": "one of: DOWNSIDE / NEUTRAL / UPSIDE"
  },
  "news": [
    {
      "headline": "shortened headline under 12 words",
      "effect": "MARKET or INDUSTRY or COMPANY",
      "impact": "HIGH or MED or LOW",
      "implication": "one sentence — what it means for NQ or YM context only"
    }
  ]
}

Rules:
- news array: include only the 5 most relevant headlines for a futures NQ/YM trader
- effect: MARKET = broad index impact, INDUSTRY = sector impact, COMPANY = single stock
- Do NOT make trading decisions or generate signals
- Keep implications factual and context-focused`,
          messages: [{
            role: "user",
            content: `Today's headlines:\n${headlines.map((h,i)=>`${i+1}. ${h}`).join("\n")}`
          }]
        })
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (parsed.macro) setMacro(parsed.macro);
      if (parsed.news) setNews(parsed.news);
      setLastUpdated(new Date());
    } catch {}
    setAiLoading(false);
  }, []);

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCalendar();
    fetchAndSynthesize();
    const newsTimer = setInterval(fetchAndSynthesize, 5 * 60 * 1000); // every 5 min
    const calTimer = setInterval(fetchCalendar, 10 * 60 * 1000); // every 10 min
    return () => { clearInterval(newsTimer); clearInterval(calTimer); };
  }, []);

  const timeStr = time.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:true });
  const dateStr = time.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
  const session = getSession();
  const sessionColor = session === "NEW YORK" ? C.accent : session === "LONDON" ? C.gold : C.muted;

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"'Barlow', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Barlow:wght@400;600;700;800;900&family=Barlow+Condensed:wght@700;800;900&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes spin { to{transform:rotate(360deg)} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:2px } ::-webkit-scrollbar-thumb { background:#0e1f35 }
      `}</style>

      {/* Header */}
      <div style={{ background:C.dim, borderBottom:`1px solid ${C.border}`, padding:"11px 24px",
        display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:30, height:30, background:`${C.accent}14`, border:`1px solid ${C.accent}35`,
            borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ color:C.accent, fontSize:11, fontWeight:900, ...mono }}>TH</span>
          </div>
          <div>
            <div style={{ color:C.white, fontSize:13, fontWeight:900, letterSpacing:"0.08em",
              fontFamily:"'Barlow Condensed', sans-serif" }}>
              TH30 CONTEXT TERMINAL
            </div>
            <div style={{ ...mono, fontSize:8, color:C.muted, letterSpacing:"0.14em" }}>
              LIVE · FF NEWS + AI SYNTHESIS
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:20, alignItems:"center" }}>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:sessionColor, animation:"pulse 2s infinite" }}/>
            <span style={{ ...mono, fontSize:8, color:sessionColor }}>{session}</span>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ ...mono, fontSize:11, color:C.bright }}>{timeStr}</div>
            <div style={{ ...mono, fontSize:8, color:C.muted }}>{dateStr} · NY</div>
          </div>
        </div>
      </div>

      {/* Panels */}
      <div style={{ padding:"18px 24px", display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
        gap:14, maxWidth:1200, margin:"0 auto" }}>
        <MacroPanel
          macro={macro}
          news={news}
          loading={aiLoading}
          onRefresh={fetchAndSynthesize}
          lastUpdated={lastUpdated}
        />
        <ContextPanel
          events={events}
          calLoading={calLoading}
        />
        <ExecutionPanel
          macro={macro}
          events={events}
        />
      </div>

      {/* Footer */}
      <div style={{ padding:"0 24px 14px", maxWidth:1200, margin:"0 auto",
        display:"flex", justifyContent:"space-between" }}>
        <span style={{ ...mono, fontSize:8, color:C.muted }}>TH30 CONTEXT TERMINAL · LIVE</span>
        <span style={{ ...mono, fontSize:8, color:C.muted }}>CONTEXT SUPPORT ONLY — STRUCTURE, ENTRIES + EXECUTION REMAIN WITH THE TRADER</span>
      </div>
    </div>
  );
}
