import { useState, useEffect, useCallback } from "react";

// Finnhub news API — same key as prices, no proxy needed
const FINNHUB_NEWS_URL = (from, to) =>
  `https://finnhub.io/api/v1/news?category=general&minId=0&token=${FINNHUB_KEY}`;
const FINNHUB_MKT_NEWS = () =>
  `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`;
const FINNHUB_CALENDAR_URL = () =>
  `https://finnhub.io/api/v1/calendar/economic?token=${FINNHUB_KEY}`;

// Keep FF calendar as fallback via proxy
const PROXY = "https://api.allorigins.win/get?url=";
const FF_CALENDAR_URL = PROXY + encodeURIComponent("https://www.forexfactory.com/ffcal_week_this.xml");
const STORAGE_KEY   = "th30_last_known";
const FINNHUB_KEY   = "d816kvhr01qler4h78u0d816kvhr01qler4h78ug";
const FINNHUB_URL   = (sym) => `https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`;

// QQQ = NQ proxy, DIA = YM proxy, GLD = Gold proxy
const PRICE_SYMBOLS = [
  { symbol:"QQQ",  label:"QQQ",  name:"Nasdaq / NQ proxy",  color:"#00d4ff" },
  { symbol:"DIA",  label:"DIA",  name:"Dow / YM proxy",     color:"#00c87a" },
  { symbol:"GLD",  label:"GLD",  name:"Gold proxy",         color:"#f0a500" },
];

// ─── BASELINE DEFAULTS — always shown when no live data ───────────────────────
const BASELINE = {
  macro: {
    fed_tone:    "NEUTRAL",
    inflation:   "ELEVATED",
    jobs:        "RESILIENT",
    growth:      "SLOWING",
    risk_tone:   "MIXED",
    ym_pressure: "NEUTRAL",
    nq_pressure: "NEUTRAL",
  },
  news: [
    {
      headline:    "No live headlines — showing baseline context",
      effect:      "MARKET",
      impact:      "LOW",
      implication: "Market closed or no active news flow. Baseline macro read is in effect.",
    },
    {
      headline:    "Fed policy stance: data dependent, no imminent cuts",
      effect:      "MARKET",
      impact:      "MED",
      implication: "Rates held steady. NQ sensitive to any forward guidance shift.",
    },
    {
      headline:    "Equity futures maintaining upward structure",
      effect:      "MARKET",
      impact:      "MED",
      implication: "NQ leading. YM lagging. Macro pressure remains upside biased.",
    },
  ],
};

// ─── DESIGN ───────────────────────────────────────────────────────────────────
const C = {
  bg:      "#050810",
  surface: "#0a0e1a",
  card:    "#0d1220",
  border:  "#141d35",
  border2: "#1a2540",
  accent:  "#00d4ff",
  green:   "#00c87a",
  red:     "#ff3d5a",
  gold:    "#f0a500",
  muted:   "#2e4060",
  dim:     "#1c2a45",
  text:    "#7a9bb5",
  bright:  "#c8dff0",
  white:   "#eaf5ff",
};

const STATUS_META = {
  FAVORABLE:   { color:"#00c87a", label:"FAVORABLE",   desc:"Macro, timing, and volatility context are aligned. Structure and execution remain with the trader." },
  MIXED:       { color:"#f0a500", label:"MIXED",       desc:"Some context conditions are aligned, others are not. Review each factor individually." },
  UNFAVORABLE: { color:"#ff3d5a", label:"UNFAVORABLE", desc:"Context conditions are not aligned. Elevated noise, event risk, or macro conflict is present." },
};

const EFFECT_META = {
  MARKET:   { color:"#00d4ff", label:"MARKET EFFECT"   },
  INDUSTRY: { color:"#f0a500", label:"INDUSTRY EFFECT" },
  COMPANY:  { color:"#2e4060", label:"COMPANY EFFECT"  },
};

const WINDOWS = [
  { id:"pre",    label:"PRE-POSITION", time:"8:55–9:25"  },
  { id:"open",   label:"OPEN AUCTION", time:"9:30–9:33"  },
  { id:"trap",   label:"TRAP CONFIRM", time:"9:33–9:39"  },
  { id:"expand", label:"EXPANSION",    time:"9:39–10:00" },
  { id:"cont",   label:"CONTINUATION", time:"10:00+"     },
];

function getWindowId() {
  const t = new Date().getHours()*60 + new Date().getMinutes();
  if (t < 8*60+55) return "pre";
  if (t < 9*60+30) return "pre";
  if (t < 9*60+33) return "open";
  if (t < 9*60+39) return "trap";
  if (t < 10*60)   return "expand";
  return "cont";
}

function getSession() {
  const h = new Date().getUTCHours();
  if (h >= 13 && h < 22) return { label:"NEW YORK", color:"#00d4ff" };
  if (h >= 7  && h < 13) return { label:"LONDON",   color:"#f0a500" };
  return                         { label:"ASIA",     color:"#2e4060" };
}

function isInKeyWindow() {
  const t = new Date().getHours()*60 + new Date().getMinutes();
  return (t >= 8*60+55 && t < 9*60+33) || (t >= 9*60+39 && t < 10*60);
}

function saveToStorage(macro, news) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ macro, news, savedAt: new Date().toISOString() }));
  } catch {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function timeAgoLabel(iso) {
  if (!iso) return null;
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}


// ─── EVENT PLAYBOOK DATA ──────────────────────────────────────────────────────
const PLAYBOOK_EVENTS = {
  "CPI":   {
    label:"CPI Report", icon:"📊",
    nq: { above:"BEARISH — hot inflation = Fed hawkish risk. NQ sells off.", at:"NEUTRAL — in line = no surprise. NQ ranges.", below:"BULLISH — cooling inflation = rate cut hope. NQ rallies." },
    ym: { above:"BEARISH — rising rates hurt growth. YM lags NQ on selloff.", at:"NEUTRAL — YM holds range. Watch for institutional rotation.", below:"BULLISH — YM catches bid. Financials + industrials lead." },
  },
  "NFP":   {
    label:"Non-Farm Payrolls", icon:"💼",
    nq: { above:"MIXED — strong jobs = Fed stays hawkish. Tech under pressure.", at:"NEUTRAL — no catalyst. NQ holds overnight range.", below:"BULLISH — weak jobs = Fed pivot closer. Growth stocks rally." },
    ym: { above:"BULLISH — strong economy favors Dow industrials and financials.", at:"NEUTRAL — YM stays rangebound. No directional bias.", below:"BEARISH — weak labor = recession fear. YM drops with cyclicals." },
  },
  "FOMC":  {
    label:"FOMC Decision", icon:"🏦",
    nq: { above:"BEARISH — hike or hawkish surprise crushes NQ. High multiple selloff.", at:"NEUTRAL — hold as expected = relief rally possible. Watch language.", below:"BULLISH — cut or dovish pivot = NQ rips. Tech leads the move." },
    ym: { above:"BEARISH — rate hike hurts all equities. YM drops with NQ.", at:"NEUTRAL — hold expected = YM stable. Watch Fed statement tone.", below:"BULLISH — dovish Fed = YM rallies. Financials + banks benefit." },
  },
  "GDP":   {
    label:"GDP Report", icon:"📈",
    nq: { above:"BULLISH — strong growth = earnings optimism. NQ leads rally.", at:"NEUTRAL — in line = no reaction. NQ holds current range.", below:"BEARISH — contraction fear = risk-off. NQ underperforms." },
    ym: { above:"BULLISH — GDP beat = cyclical strength. YM outperforms NQ.", at:"NEUTRAL — YM holds. No clear directional bias.", below:"BEARISH — weak GDP = recession risk. YM drops on cyclical fear." },
  },
  "PCE":   {
    label:"PCE Inflation", icon:"💰",
    nq: { above:"BEARISH — Fed's preferred measure hot = hawkish risk. NQ sells.", at:"NEUTRAL — PCE in line = no surprise. NQ rangebound.", below:"BULLISH — PCE cooling = rate cut timing moves closer. NQ bids." },
    ym: { above:"BEARISH — hot PCE = rates stay high. YM pressured.", at:"NEUTRAL — in line = YM holds. Watch equity breadth.", below:"BULLISH — cooling PCE = risk-on. YM and NQ both rally." },
  },
  "ISM":   {
    label:"ISM Manufacturing", icon:"🏭",
    nq: { above:"BULLISH — expansion signal. Tech and growth equities rally.", at:"NEUTRAL — borderline. NQ holds range. No strong catalyst.", below:"BEARISH — contraction = recession signal. NQ sells off." },
    ym: { above:"BULLISH — manufacturing strength = Dow industrials rally hard.", at:"NEUTRAL — YM mixed. Watch internals for rotation.", below:"BEARISH — ISM contraction hits YM harder than NQ." },
  },
};

function getPlaybookEvent(events) {
  const keywords = Object.keys(PLAYBOOK_EVENTS);
  for (const ev of events) {
    for (const key of keywords) {
      if (ev.event.toUpperCase().includes(key)) return { key, event: ev, data: PLAYBOOK_EVENTS[key] };
    }
  }
  return null;
}

// ─── EVENT PLAYBOOK COMPONENT ─────────────────────────────────────────────────
function EventPlaybook({ events }) {
  const [open, setOpen] = useState(false);
  const match = getPlaybookEvent(events);
  if (!match) return null;

  const { data, event } = match;
  const impactCol = event.impact==="HIGH" ? C.red : C.gold;

  const ScenarioRow = ({ dir, label, nq, ym, col }) => (
    <div style={{ marginBottom:10 }}>
      <div style={{ ...mono, fontSize:9, color:col, fontWeight:700, letterSpacing:"0.1em", marginBottom:6 }}>
        {dir} {label}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {[["NQ",nq],["YM",ym]].map(([sym,txt])=>(
          <div key={sym} style={{ background:C.bg, border:`1px solid ${col}25`, borderRadius:6, padding:"8px 10px" }}>
            <div style={{ ...mono, fontSize:8, color:col, marginBottom:4 }}>{sym}</div>
            <div style={{ color:C.text, fontSize:9, lineHeight:1.6 }}>{txt}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ marginTop:4 }}>
      <div style={{ height:1, background:C.border, margin:"12px 0" }}/>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", background:`${impactCol}10`, border:`1px solid ${impactCol}30`, borderRadius:8, padding:"10px 14px", cursor:"pointer" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:14 }}>{data.icon}</span>
          <div style={{ textAlign:"left" }}>
            <div style={{ ...mono, fontSize:9, color:impactCol, fontWeight:700, letterSpacing:"0.12em" }}>EVENT PLAYBOOK</div>
            <div style={{ ...mono, fontSize:8, color:C.text, marginTop:2 }}>{data.label} · {event.time}</div>
          </div>
        </div>
        <span style={{ ...mono, fontSize:12, color:impactCol }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:8, padding:"14px", marginTop:8 }}>
          <div style={{ ...mono, fontSize:8, color:C.muted, letterSpacing:"0.14em", marginBottom:12 }}>
            NQ + YM SCENARIO BREAKDOWN
          </div>
          <ScenarioRow dir="↑ ABOVE" label="forecast" nq={data.nq.above} ym={data.ym.above} col={C.green}/>
          <ScenarioRow dir="→ ON"    label="forecast" nq={data.nq.at}    ym={data.ym.at}    col={C.gold}/>
          <ScenarioRow dir="↓ BELOW" label="forecast" nq={data.nq.below} ym={data.ym.below} col={C.red}/>
          <div style={{ ...mono, fontSize:8, color:C.muted, marginTop:10, lineHeight:1.6, borderTop:`1px solid ${C.border}`, paddingTop:8 }}>
            Context only. These are historical behavioral tendencies — not trade signals. You determine structure and execution.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
const mono    = { fontFamily:"'JetBrains Mono', 'Fira Code', monospace" };
const display = { fontFamily:"'Syne', sans-serif" };

function toneColor(v) {
  if (!v) return C.muted;
  if (/dovish|cooling|soft|resilient|risk.on|upside|expanding/i.test(v)) return C.green;
  if (/hawkish|hot|weak|slowing|risk.off|downside|contracting/i.test(v)) return C.red;
  return C.gold;
}

function pressureColor(v) {
  if (!v) return C.muted;
  if (v==="UPSIDE")   return C.green;
  if (v==="DOWNSIDE") return C.red;
  return C.gold;
}

function MacroField({ label, value }) {
  const col = toneColor(value);
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
      <span style={{ ...mono, fontSize:9, color:C.text, letterSpacing:"0.12em", textTransform:"uppercase" }}>{label}</span>
      <span style={{ ...mono, fontSize:11, fontWeight:700, color:col }}>{value || "—"}</span>
    </div>
  );
}

function NewsCard({ item }) {
  const meta      = EFFECT_META[item.effect] || EFFECT_META.MARKET;
  const impactCol = item.impact==="HIGH" ? C.red : item.impact==="MED" ? C.gold : C.muted;
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:10, padding:"14px 16px", marginBottom:10, borderLeft:`3px solid ${meta.color}` }}>
      <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
        <span style={{ ...mono, fontSize:8, fontWeight:700, letterSpacing:"0.1em", padding:"3px 8px", borderRadius:4, background:`${meta.color}18`, color:meta.color, border:`1px solid ${meta.color}35` }}>{meta.label}</span>
        <span style={{ ...mono, fontSize:8, fontWeight:700, letterSpacing:"0.1em", padding:"3px 8px", borderRadius:4, background:`${impactCol}18`, color:impactCol, border:`1px solid ${impactCol}35` }}>{item.impact}</span>
      </div>
      <div style={{ ...display, color:C.white, fontSize:12, fontWeight:600, lineHeight:1.5, marginBottom:8 }}>{item.headline}</div>
      <div style={{ color:C.text, fontSize:10, lineHeight:1.6 }}>
        <span style={{ color:meta.color, fontWeight:700 }}>▸ </span>{item.implication}
      </div>
    </div>
  );
}

function Panel({ children, style }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden", display:"flex", flexDirection:"column", ...style }}>
      {children}
    </div>
  );
}

function PanelHead({ title, sub, right }) {
  return (
    <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
      <div>
        <div style={{ ...mono, fontSize:10, fontWeight:700, letterSpacing:"0.2em", color:C.accent }}>{title}</div>
        {sub && <div style={{ ...mono, fontSize:8, color:C.muted, marginTop:2 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 0" }}>
      <div style={{ width:11, height:11, border:`2px solid ${C.border2}`, borderTop:`2px solid ${C.accent}`, borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
      <span style={{ ...mono, fontSize:9, color:C.muted }}>Synthesizing…</span>
    </div>
  );
}

// ─── PANEL 1: MACRO WAR ROOM ──────────────────────────────────────────────────
function MacroPanel({ macro, news, loading, onRefresh, lastUpdated, isBaseline, savedAt, events }) {
  const sourceLabel = isBaseline
    ? (savedAt ? `Last session · ${timeAgoLabel(savedAt)}` : "Baseline context — no live data")
    : lastUpdated
      ? `Live · updated ${lastUpdated.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true})}`
      : "Fetching…";

  const sourceColor = isBaseline ? C.gold : C.green;

  return (
    <Panel>
      <PanelHead
        title="MACRO WAR ROOM"
        sub={sourceLabel}
        right={
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:sourceColor, animation:"pulse 2s infinite" }}/>
            <button onClick={onRefresh} disabled={loading}
              style={{ ...mono, fontSize:9, color:loading?C.muted:C.accent, background:`${C.accent}12`, border:`1px solid ${C.accent}35`, borderRadius:6, padding:"5px 12px", cursor:loading?"not-allowed":"pointer" }}>
              {loading ? "…" : "↻ Refresh"}
            </button>
          </div>
        }
      />

      <div style={{ padding:"4px 20px 8px" }}>
        {loading && !macro ? <Spinner/> : <>
          <MacroField label="Fed Tone"  value={macro?.fed_tone}/>
          <MacroField label="Inflation" value={macro?.inflation}/>
          <MacroField label="Jobs"      value={macro?.jobs}/>
          <MacroField label="Growth"    value={macro?.growth}/>
          <MacroField label="Risk Tone" value={macro?.risk_tone}/>

          {/* YM / NQ pressure — always visible */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, margin:"14px 0 4px" }}>
            {[["YM MACRO PRESSURE", macro?.ym_pressure, pressureColor(macro?.ym_pressure)],
              ["NQ MACRO PRESSURE", macro?.nq_pressure, pressureColor(macro?.nq_pressure)]].map(([lbl,val,col])=>(
              <div key={lbl} style={{ background:C.card, border:`1px solid ${col}30`, borderRadius:8, padding:"12px 14px" }}>
                <div style={{ ...mono, fontSize:8, color:C.text, letterSpacing:"0.1em", marginBottom:6 }}>{lbl}</div>
                <div style={{ ...mono, fontSize:15, fontWeight:800, color:col }}>{val || "NEUTRAL"}</div>
              </div>
            ))}
          </div>
        </>}
      </div>

      <div style={{ height:1, background:C.border }}/>

      <div style={{ padding:"14px 20px 16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ ...mono, fontSize:9, color:C.text, letterSpacing:"0.15em" }}>NEWS CLASSIFICATION</div>
          {isBaseline && (
            <span style={{ ...mono, fontSize:8, color:C.gold, background:`${C.gold}14`, border:`1px solid ${C.gold}30`, padding:"2px 8px", borderRadius:4 }}>
              LAST SESSION
            </span>
          )}
        </div>
        {loading && !news.length ? <Spinner/> : (
          news.map((item,i) => <NewsCard key={i} item={item}/>)
        )}
        <EventPlaybook events={events}/>
      </div>
    </Panel>
  );
}

// ─── PANEL 2: SESSION CONTEXT ─────────────────────────────────────────────────
function ContextPanel({ events, calLoading }) {
  const activeId = getWindowId();
  const session  = getSession();

  return (
    <Panel>
      <PanelHead title="SESSION CONTEXT" sub="Time + Environment"/>
      <div style={{ padding:"16px 20px" }}>

        {/* Session badge */}
        <div style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:10, padding:"14px 16px", marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ ...mono, fontSize:8, color:C.text, letterSpacing:"0.14em", marginBottom:4 }}>ACTIVE SESSION</div>
            <div style={{ ...display, fontSize:18, fontWeight:800, color:session.color }}>{session.label}</div>
          </div>
          <div style={{ width:10, height:10, borderRadius:"50%", background:session.color, animation:"pulse 2s infinite" }}/>
        </div>

        {/* Time windows */}
        <div style={{ ...mono, fontSize:8, color:C.text, letterSpacing:"0.14em", marginBottom:10 }}>NY TIME WINDOWS</div>
        <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:16 }}>
          {WINDOWS.map(w => {
            const active = w.id === activeId;
            return (
              <div key={w.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", borderRadius:8, background:active?`${C.accent}10`:"transparent", border:active?`1px solid ${C.accent}30`:`1px solid transparent` }}>
                <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:active?C.accent:C.muted, flexShrink:0, animation:active?"pulse 2s infinite":"none" }}/>
                  <span style={{ ...mono, fontSize:9, color:active?C.accent:C.muted, fontWeight:active?700:400, letterSpacing:"0.08em" }}>{w.label}</span>
                </div>
                <span style={{ ...mono, fontSize:8, color:C.muted }}>{w.time}</span>
              </div>
            );
          })}
        </div>

        <div style={{ height:1, background:C.border, marginBottom:16 }}/>

        {/* Environment */}
        <div style={{ ...mono, fontSize:8, color:C.text, letterSpacing:"0.14em", marginBottom:10 }}>MARKET ENVIRONMENT</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
          {[["VOLATILITY","NORMAL",C.green],["MARKET BEHAVIOR","EXPANDING",C.green]].map(([lbl,val,col])=>(
            <div key={lbl} style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:8, padding:"12px 14px" }}>
              <div style={{ ...mono, fontSize:8, color:C.text, letterSpacing:"0.1em", marginBottom:6 }}>{lbl}</div>
              <div style={{ ...mono, fontSize:11, fontWeight:700, color:col }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ height:1, background:C.border, marginBottom:16 }}/>

        {/* Events */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ ...mono, fontSize:8, color:C.text, letterSpacing:"0.14em" }}>UPCOMING EVENTS</div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:calLoading?C.gold:C.green, animation:"pulse 2s infinite" }}/>
            <span style={{ ...mono, fontSize:8, color:calLoading?C.gold:C.green }}>{calLoading?"LOADING":"LIVE"}</span>
          </div>
        </div>

        {calLoading && !events.length ? <Spinner/> : events.length ? (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {events.map((ev,i) => {
              const ic = ev.impact==="HIGH"?C.red:ev.impact==="MED"?C.gold:C.muted;
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, background:ev.impact==="HIGH"?`${C.red}08`:C.card, border:`1px solid ${ev.impact==="HIGH"?C.red+"25":C.border2}` }}>
                  <div style={{ width:6, height:6, borderRadius:"50%", background:ic, flexShrink:0 }}/>
                  <span style={{ ...mono, fontSize:9, color:C.accent, minWidth:38 }}>{ev.time}</span>
                  <span style={{ color:C.bright, fontSize:10, flex:1, lineHeight:1.4 }}>{ev.event}</span>
                  <span style={{ ...mono, fontSize:8, fontWeight:700, padding:"2px 6px", borderRadius:3, background:`${ic}18`, color:ic }}>{ev.impact}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:8, padding:"12px 14px" }}>
            <div style={{ ...mono, fontSize:9, color:C.muted }}>No scheduled events — market closed or weekend</div>
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─── PANEL 3: EXECUTION ASSISTANT ────────────────────────────────────────────
function ExecutionPanel({ macro, events }) {
  const highImpactSoon = events.some(e => {
    if (e.impact!=="HIGH") return false;
    const [h,m] = (e.time||"").split(":").map(Number);
    if (isNaN(h)) return false;
    const diff = (h*60+m) - (new Date().getHours()*60+new Date().getMinutes());
    return diff>=0 && diff<=30;
  });

  const checklist = [
    { label:"Macro context aligned",           status: macro ? /risk.on/i.test(macro.risk_tone||"") : null },
    { label:"In key time window",              status: isInKeyWindow() },
    { label:"High-impact event within 30 min", status: highImpactSoon, invert:true },
    { label:"Volatility context normal",       status: true },
  ];

  const passed    = checklist.filter(c => c.invert ? c.status===false : c.status===true).length;
  const notPassed = checklist.length - passed;
  const statusKey = passed===4?"FAVORABLE":passed>=2?"MIXED":"UNFAVORABLE";
  const sm        = STATUS_META[statusKey];

  return (
    <Panel>
      <PanelHead title="EXECUTION ASSISTANT" sub="Context Checklist"/>
      <div style={{ padding:"16px 20px", flex:1 }}>

        <div style={{ ...mono, fontSize:8, color:C.text, letterSpacing:"0.14em", marginBottom:12 }}>PRE-EXECUTION CONTEXT</div>

        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
          {checklist.map((item,i) => {
            const isPos  = item.invert ? item.status===false : item.status===true;
            const isNull = item.status===null;
            const col    = isNull?C.muted:isPos?C.green:C.red;
            const val    = isNull?"—":isPos?"YES":"NO";
            return (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", borderRadius:10, background:isNull?C.card:isPos?`${C.green}08`:`${C.red}08`, border:`1px solid ${isNull?C.border2:col+"30"}` }}>
                <span style={{ color:C.bright, fontSize:11, lineHeight:1.4 }}>{item.label}</span>
                <span style={{ ...mono, fontSize:11, fontWeight:800, color:col, minWidth:24, textAlign:"right" }}>{val}</span>
              </div>
            );
          })}
        </div>

        <div style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:8, padding:"10px 14px", marginBottom:16 }}>
          <span style={{ ...mono, fontSize:9, color:C.text }}>
            {passed} condition{passed!==1?"s":""} aligned · {notPassed} not aligned
          </span>
        </div>

        <div style={{ height:1, background:C.border, marginBottom:16 }}/>

        <div style={{ background:C.card, border:`1px solid ${C.border2}`, borderRadius:10, padding:"12px 14px", marginBottom:16, borderLeft:`3px solid ${C.muted}` }}>
          <div style={{ ...mono, fontSize:8, color:C.muted, letterSpacing:"0.12em", marginBottom:5 }}>NOTE</div>
          <div style={{ color:C.text, fontSize:10, lineHeight:1.7 }}>
            This checklist reflects context only. You determine structure, entry, and execution.
          </div>
        </div>

        <div style={{ background:`${sm.color}0c`, border:`1px solid ${sm.color}30`, borderRadius:12, padding:"18px 16px" }}>
          <div style={{ ...mono, fontSize:8, color:C.text, letterSpacing:"0.16em", marginBottom:10 }}>CONTEXT CONDITION</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:10 }}>
            <span style={{ ...mono, fontSize:10, color:C.text }}>Context Condition:</span>
            <span style={{ ...display, fontSize:22, fontWeight:900, color:sm.color, letterSpacing:"0.04em" }}>{sm.label}</span>
          </div>
          <div style={{ color:C.text, fontSize:10, lineHeight:1.7 }}>{sm.desc}</div>
        </div>
      </div>
    </Panel>
  );
}



// ─── PRICE TICKER ─────────────────────────────────────────────────────────────
function PriceTicker({ prices, loading }) {
  return (
    <div style={{ background:"#060b14", borderBottom:`1px solid ${C.border}`, padding:"0 24px" }}>
      <div style={{ maxWidth:1280, margin:"0 auto", display:"flex", gap:0 }}>
        {PRICE_SYMBOLS.map(({ label, name, color }) => {
          const p = prices[label];
          const up = p?.changePct >= 0;
          const col = p ? (up ? C.green : C.red) : C.muted;
          return (
            <div key={label} style={{ padding:"8px 20px 8px 0", marginRight:20, borderRight:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
              <div>
                <div style={{ ...mono, fontSize:8, color:color, letterSpacing:"0.14em", marginBottom:2 }}>{label}</div>
                <div style={{ ...mono, fontSize:9, color:C.muted }}>{name}</div>
              </div>
              {loading && !p ? (
                <div style={{ ...mono, fontSize:10, color:C.muted }}>—</div>
              ) : p ? (
                <div>
                  <div style={{ ...mono, fontSize:14, fontWeight:800, color:C.white }}>${p.price?.toFixed(2)}</div>
                  <div style={{ ...mono, fontSize:9, color:col }}>
                    {up?"+":""}{p.changePct?.toFixed(2)}% ({up?"+":""}{p.change?.toFixed(2)})
                  </div>
                </div>
              ) : (
                <div style={{ ...mono, fontSize:10, color:C.muted }}>—</div>
              )}
            </div>
          );
        })}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center" }}>
          <div style={{ display:"flex", gap:5, alignItems:"center" }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:loading?C.gold:C.green, animation:"pulse 2s infinite" }}/>
            <span style={{ ...mono, fontSize:8, color:loading?C.gold:C.green }}>
              {loading ? "LOADING" : "LIVE · 15s"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── PRIVATE BRIEFINGS ────────────────────────────────────────────────────────
function BriefingsPanel({ briefings, loading, onGenerate, lastBrief }) {
  const inNY = (() => {
    const t = new Date().getHours()*60+new Date().getMinutes();
    return t >= 8*60+30 && t <= 17*60;
  })();

  return (
    <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 24px 16px" }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:inNY?C.green:C.muted, animation:inNY?"pulse 2s infinite":"none" }}/>
            <div>
              <div style={{ ...mono, fontSize:10, fontWeight:700, letterSpacing:"0.2em", color:C.accent }}>PRIVATE BRIEFINGS</div>
              <div style={{ ...mono, fontSize:8, color:C.muted, marginTop:2 }}>
                {inNY ? "NY session active · auto-generates every 5 min" : "NY session closed · showing last session briefings"}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {lastBrief && <span style={{ ...mono, fontSize:8, color:C.muted }}>{lastBrief.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true})}</span>}
            <button onClick={onGenerate} disabled={loading}
              style={{ ...mono, fontSize:9, color:loading?C.muted:C.accent, background:`${C.accent}12`, border:`1px solid ${C.accent}35`, borderRadius:6, padding:"5px 12px", cursor:loading?"not-allowed":"pointer" }}>
              {loading ? "Generating…" : "↻ Generate"}
            </button>
          </div>
        </div>

        {/* Briefings list */}
        <div style={{ maxHeight:280, overflowY:"auto" }}>
          {!briefings.length && !loading && (
            <div style={{ padding:"24px 20px", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ color:C.muted, fontSize:11 }}>
                {inNY ? "Hit Generate for your first briefing of the session." : "No briefings yet — open during NY session hours (8:30 AM – 5:00 PM ET)."}
              </div>
            </div>
          )}
          {loading && !briefings.length && (
            <div style={{ padding:"20px", display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:11, height:11, border:`2px solid ${C.border2}`, borderTop:`2px solid ${C.accent}`, borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
              <span style={{ ...mono, fontSize:9, color:C.muted }}>Generating briefing…</span>
            </div>
          )}
          {briefings.map((b,i)=>(
            <div key={i} style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}20`, background:i===0?`${C.accent}05`:"transparent" }}>
              <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:8 }}>
                <span style={{ ...mono, fontSize:9, color:C.accent, fontWeight:700 }}>{b.time}</span>
                <span style={{ ...mono, fontSize:8, color:C.muted }}>—</span>
                <span style={{ ...mono, fontSize:8, color:b.inSession?C.green:C.muted }}>{b.window}</span>
                {i===0 && <span style={{ ...mono, fontSize:7, color:C.accent, background:`${C.accent}18`, border:`1px solid ${C.accent}30`, padding:"1px 6px", borderRadius:3 }}>LATEST</span>}
              </div>
              <div style={{ color:C.bright, fontSize:12, lineHeight:1.75 }}>{b.text}</div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ padding:"10px 20px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ ...mono, fontSize:8, color:C.muted }}>Context only · AI-generated · Not a trade signal</span>
          <span style={{ ...mono, fontSize:8, color:C.muted }}>{briefings.length} briefing{briefings.length!==1?"s":""} this session</span>
        </div>
      </div>
    </div>
  );
}

// ─── FF LIVE FEED ─────────────────────────────────────────────────────────────
function FeedItem({ item, index }) {
  const title = item.title;
  const isHigh = /fed|fomc|cpi|nfp|gdp|pce|rate|powell|treasury|inflation|jobs|payroll|war|iran|sanction/i.test(title);
  const isMed  = /oil|gold|nasdaq|dow|equity|stock|earnings|crypto|bitcoin|sector/i.test(title);
  const impact = isHigh ? "HIGH" : isMed ? "MED" : "LOW";
  const impactCol = impact==="HIGH" ? C.red : impact==="MED" ? C.gold : C.muted;

  function timeAgo(dateStr) {
    if (!dateStr) return "";
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60)   return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    return `${Math.floor(diff/3600)}h ago`;
  }

  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"11px 16px", borderBottom:`1px solid ${C.border}25`, background: index%2===0 ? C.card : "transparent" }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:36 }}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:impactCol, flexShrink:0, marginTop:3 }}/>
        <span style={{ ...mono, fontSize:7, color:impactCol, fontWeight:700, letterSpacing:"0.08em" }}>{impact}</span>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ color:C.bright, fontSize:11, lineHeight:1.55, marginBottom:3 }}>{title}</div>
        <div style={{ ...mono, fontSize:8, color:C.muted }}>{timeAgo(item.pubDate)}</div>
      </div>
    </div>
  );
}

function FFLiveFeed({ feed, loading }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ maxWidth:1280, margin:"0 auto", padding:"0 24px 24px" }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }} onClick={()=>setExpanded(e=>!e)}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background: loading ? C.gold : feed.length ? C.green : C.muted, animation:"pulse 2s infinite" }}/>
            <div>
              <div style={{ ...mono, fontSize:10, fontWeight:700, letterSpacing:"0.2em", color:C.accent }}>MARKET NEWS — LIVE FEED</div>
              <div style={{ ...mono, fontSize:8, color:C.muted, marginTop:2 }}>Finnhub market news · auto-refreshes every 5 min</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ ...mono, fontSize:8, color:C.muted }}>{feed.length} headlines</span>
            <span style={{ ...mono, fontSize:11, color:C.muted }}>{expanded ? "▲" : "▼"}</span>
          </div>
        </div>

        {/* Feed */}
        {expanded && (
          <div style={{ maxHeight:320, overflowY:"auto" }}>
            {loading && !feed.length && (
              <div style={{ padding:"20px 16px", display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:11, height:11, border:`2px solid ${C.border2}`, borderTop:`2px solid ${C.accent}`, borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                <span style={{ ...mono, fontSize:9, color:C.muted }}>Fetching live feed…</span>
              </div>
            )}
            {!loading && !feed.length && (
              <div style={{ padding:"20px 16px" }}>
                <span style={{ ...mono, fontSize:10, color:C.muted }}>No live headlines — market may be closed or feed loading.</span>
              </div>
            )}
            {feed.map((item, i) => <FeedItem key={i} item={item} index={i}/>)}
          </div>
        )}

        {/* Legend */}
        {expanded && (
          <div style={{ padding:"10px 20px", borderTop:`1px solid ${C.border}`, display:"flex", gap:16 }}>
            {[["HIGH", C.red],["MED", C.gold],["LOW", C.muted]].map(([lbl,col])=>(
              <div key={lbl} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:col }}/>
                <span style={{ ...mono, fontSize:8, color:col }}>{lbl} IMPACT</span>
              </div>
            ))}
            <span style={{ ...mono, fontSize:8, color:C.muted, marginLeft:"auto" }}>Auto-classified by keyword · not AI synthesized</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [time,        setTime]        = useState(new Date());
  const [prices,      setPrices]      = useState({});
  const [briefings,   setBriefings]   = useState([]);
  const [briefLoading,setBriefLoading]= useState(false);
  const [lastBrief,   setLastBrief]   = useState(null);
  const [priceLoading,setPriceLoading]= useState(true);
  const [events,      setEvents]      = useState([]);
  const [macro,       setMacro]       = useState(null);
  const [news,        setNews]        = useState([]);
  const [rawFeed,     setRawFeed]     = useState([]);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [calLoading,  setCalLoading]  = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isBaseline,  setIsBaseline]  = useState(false);
  const [savedAt,     setSavedAt]     = useState(null);

  useEffect(()=>{ const t=setInterval(()=>setTime(new Date()),1000); return()=>clearInterval(t); },[]);

  // Load saved or baseline data immediately on mount — never blank
  useEffect(()=>{
    const saved = loadFromStorage();
    if (saved?.macro) {
      setMacro(saved.macro);
      setNews(saved.news || BASELINE.news);
      setSavedAt(saved.savedAt);
      setIsBaseline(true);
    } else {
      setMacro(BASELINE.macro);
      setNews(BASELINE.news);
      setIsBaseline(true);
    }
  },[]);

  const fetchPrices = useCallback(async()=>{
    try {
      const results = await Promise.all(
        PRICE_SYMBOLS.map(async({symbol,label})=>{
          const res  = await fetch(FINNHUB_URL(symbol));
          const data = await res.json();
          return { label, symbol, price:data.c, open:data.o, prevClose:data.pc, change:data.d, changePct:data.dp };
        })
      );
      const map = {};
      results.forEach(r=>{ map[r.label]=r; });
      setPrices(map);
    } catch {}
    setPriceLoading(false);
  },[]);

  const fetchCalendar = useCallback(async()=>{
    setCalLoading(true);
    try {
      // Try Finnhub economic calendar first
      const res = await fetch(FINNHUB_CALENDAR_URL());
      if (res.ok) {
        const data = await res.json();
        const evts = (data.economicCalendar || [])
          .filter(e => e.country === "US" && e.event)
          .map(e => ({
            time:   e.time ? e.time.slice(11,16) : "—",
            ccy:    "USD",
            event:  e.event,
            impact: e.impact === "high" ? "HIGH" : e.impact === "medium" ? "MED" : "LOW",
            forecast: e.estimate || "—",
            prev:     e.prev || "—",
          }));
        if (evts.length) { setEvents(evts.slice(0,8)); setCalLoading(false); return; }
      }
    } catch {}
    // Fallback to FF via proxy
    try {
      const res2 = await fetch(FF_CALENDAR_URL);
      if (res2.ok) {
        const d = await res2.json();
        if (d.contents) {
          const parser = new DOMParser();
          const doc    = parser.parseFromString(d.contents,"text/xml");
          const all = [...doc.querySelectorAll("event")].map(ev=>{
            const raw    = (ev.querySelector("impact")?.textContent||"").trim();
            const impact = /high|red/i.test(raw)?"HIGH":/med|orange/i.test(raw)?"MED":"LOW";
            return { time:ev.querySelector("time")?.textContent||"—", ccy:ev.querySelector("country")?.textContent||"", event:ev.querySelector("title")?.textContent||"", impact };
          }).filter(e=>e.event&&e.ccy==="USD");
          setEvents(all.slice(0,8));
        }
      }
    } catch {}
    setCalLoading(false);
  },[]);

  const fetchAndSynthesize = useCallback(async()=>{
    setAiLoading(true);
    let headlines = [];
    let feedItems = [];

    // Step 1: Fetch Finnhub news
    try {
      const res = await fetch(FINNHUB_MKT_NEWS(), { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const data = await res.json();
        feedItems = (Array.isArray(data) ? data : [])
          .filter(n => n.headline && n.headline.length > 10)
          .slice(0, 25)
          .map(n => ({
            title:   n.headline,
            pubDate: new Date((n.datetime||0) * 1000).toISOString(),
            link:    n.url || "",
            source:  n.source || "",
          }));
        headlines = feedItems.map(i => i.title).slice(0, 15);
        if (feedItems.length) setRawFeed(feedItems);
      }
    } catch(e) { console.warn("Finnhub news fetch failed:", e); }

    // Step 2: If no headlines, bail but keep existing data
    if (!headlines.length) {
      setAiLoading(false);
      return;
    }

    // Step 3: AI synthesis via Anthropic
    try {
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a macro context assistant for a futures trader who trades NQ and YM.
You MUST respond with ONLY a valid JSON object. No markdown fences, no explanation, no extra text. Just the raw JSON.
{
  "macro": {
    "fed_tone": "one of: DOVISH, DOVISH LEAN, NEUTRAL, HAWKISH LEAN, HAWKISH",
    "inflation": "one of: COOLING, STABLE, ELEVATED, HOT",
    "jobs": "one of: WEAK, SOFTENING, RESILIENT, STRONG",
    "growth": "one of: CONTRACTING, SLOWING, STABLE, EXPANDING",
    "risk_tone": "one of: RISK-OFF, MIXED, RISK-ON",
    "ym_pressure": "one of: DOWNSIDE, NEUTRAL, UPSIDE",
    "nq_pressure": "one of: DOWNSIDE, NEUTRAL, UPSIDE"
  },
  "news": [
    {
      "headline": "shortened headline max 12 words",
      "effect": "MARKET or INDUSTRY or COMPANY",
      "impact": "HIGH or MED or LOW",
      "implication": "one sentence about NQ or YM impact"
    }
  ]
}
Pick the 5 most market-moving headlines. No trading decisions. Raw JSON only.`,
          messages: [{
            role: "user",
            content: `Analyze these headlines and return the JSON:
${headlines.map((h,i) => `${i+1}. ${h}`).join("
")}`
          }]
        })
      });

      if (!aiRes.ok) {
        console.warn("AI call failed with status:", aiRes.status);
        setAiLoading(false);
        return;
      }

      const aiData = await aiRes.json();
      const rawText = (aiData.content || []).map(b => b.text || "").join("").trim();

      // Strip any markdown fences just in case
      const cleanText = rawText.replace(/^```json\s*/,"").replace(/\s*```$/,"").trim();

      let parsed;
      try {
        parsed = JSON.parse(cleanText);
      } catch(parseErr) {
        // Try to extract JSON from the text
        const match = cleanText.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else { console.warn("Could not parse AI response:", cleanText.slice(0,200)); setAiLoading(false); return; }
      }

      if (parsed?.macro && parsed?.news) {
        setMacro(parsed.macro);
        setNews(parsed.news);
        setIsBaseline(false);
        setLastUpdated(new Date());
        setSavedAt(new Date().toISOString());
        saveToStorage(parsed.macro, parsed.news);
      }
    } catch(e) {
      console.warn("AI synthesis error:", e);
    }

    setAiLoading(false);
  },[]);

  const generateBriefing = useCallback(async(currentMacro, currentPrices, currentEvents)=>{
    // Only run during NY session hours (8:30 AM - 5:00 PM ET)
    const h = new Date().getHours();
    const m = new Date().getMinutes();
    const t = h * 60 + m;
    const inSession = t >= 8*60+30 && t <= 17*60;

    // Build context from current data
    const windowId  = getWindowId();
    const windowMap = { pre:"PRE-POSITION (8:55-9:25)", open:"OPEN AUCTION (9:30-9:33)", trap:"TRAP CONFIRM (9:33-9:39)", expand:"EXPANSION (9:39-10:00)", cont:"CONTINUATION (10:00+)" };
    const window    = windowMap[windowId] || windowId;
    const timeStr   = new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true});

    const qqq = currentPrices?.QQQ;
    const dia = currentPrices?.DIA;
    const priceCtx = qqq && dia
      ? `QQQ ${qqq.changePct>=0?"+":""}${qqq.changePct?.toFixed(2)}% ($${qqq.price?.toFixed(2)}) | DIA ${dia.changePct>=0?"+":""}${dia.changePct?.toFixed(2)}% ($${dia.price?.toFixed(2)})`
      : "Price data unavailable";

    const highEvents = (currentEvents||[]).filter(e=>e.impact==="HIGH").map(e=>`${e.time} ${e.event}`).join(", ") || "None";

    const macroCtx = currentMacro
      ? `Fed: ${currentMacro.fed_tone} | Inflation: ${currentMacro.inflation} | Risk: ${currentMacro.risk_tone} | NQ Pressure: ${currentMacro.nq_pressure} | YM Pressure: ${currentMacro.ym_pressure}`
      : "Macro: baseline context";

    setBriefLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:200,
          system:`You are an institutional trading briefing system for a futures scalper who trades NQ and YM.
Generate a concise private briefing in 2-3 sentences max. Use institutional language.
Format: State current market condition, what NQ and YM are doing, and one key thing to watch.
Do NOT give trade signals or say buy/sell. Context only. Be direct and specific.`,
          messages:[{role:"user", content:`Time: ${timeStr} | Window: ${window}
Prices: ${priceCtx}
Macro: ${macroCtx}
High-impact events today: ${highEvents}
${inSession ? "NY session is ACTIVE." : "NY session is CLOSED. Generate end-of-session or pre-session context."}
Generate the briefing now.`}]
        })
      });
      const data = await res.json();
      const text = (data.content||[]).map(b=>b.text||"").join("").trim();
      if (text) {
        const newBrief = { time:timeStr, text, window, inSession };
        setBriefings(prev => [newBrief, ...prev].slice(0,12));
        setLastBrief(new Date());
      }
    } catch(e) { console.warn("Briefing error:", e); }
    setBriefLoading(false);
  },[]);

  useEffect(()=>{
    fetchCalendar();
    fetchAndSynthesize();
    fetchPrices();
    // Generate first briefing after 3 seconds so prices/macro load first
    const initTimer = setTimeout(()=>generateBriefing(macro, prices, events), 3000);
    const t1=setInterval(fetchAndSynthesize,5*60*1000);
    const t2=setInterval(fetchCalendar,10*60*1000);
    const t3=setInterval(fetchPrices,15*1000);
    const t4=setInterval(()=>generateBriefing(macro,prices,events),5*60*1000);
    return()=>{clearTimeout(initTimer);clearInterval(t1);clearInterval(t2);clearInterval(t3);clearInterval(t4);};
  },[]);

  const timeStr = time.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true});
  const dateStr = time.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const session = getSession();

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"'Syne', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#141d35;border-radius:2px}
        .main-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; padding:20px 24px; max-width:1280px; margin:0 auto; animation:fadeUp 0.4s ease; }
        .footer-row { padding:0 24px 18px; max-width:1280px; margin:0 auto; display:flex; justify-content:space-between; }
        .header-inner { padding:14px 24px; }
        @media (max-width:768px) {
          .main-grid { grid-template-columns:1fr !important; padding:12px 14px !important; gap:12px !important; }
          .footer-row { padding:0 14px 16px; flex-direction:column; gap:6px; }
          .header-inner { padding:10px 14px; }
        }
      `}</style>

      {/* Header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:38, height:38, background:`linear-gradient(135deg,${C.accent}22,${C.accent}40)`, border:`1px solid ${C.accent}50`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ ...mono, color:C.accent, fontSize:13, fontWeight:800 }}>TH</span>
          </div>
          <div>
            <div style={{ ...display, color:C.white, fontSize:16, fontWeight:800, letterSpacing:"0.04em" }}>TH30 CONTEXT TERMINAL</div>
            <div style={{ ...mono, fontSize:8, color:C.muted, letterSpacing:"0.16em", marginTop:2 }}>LIVE · FF NEWS + AI SYNTHESIS</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:24, alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:session.color, animation:"pulse 2s infinite" }}/>
            <span style={{ ...mono, fontSize:9, color:session.color, letterSpacing:"0.1em" }}>{session.label}</span>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ ...mono, fontSize:13, color:C.white, letterSpacing:"0.04em" }}>{timeStr}</div>
            <div style={{ ...mono, fontSize:8, color:C.muted, marginTop:1 }}>{dateStr} · NY</div>
          </div>
        </div>
      </div>

      {/* Price Ticker */}
      <PriceTicker prices={prices} loading={priceLoading}/>

      {/* Panels */}
      <div className="main-grid">
        <MacroPanel
          macro={macro} news={news} loading={aiLoading}
          onRefresh={fetchAndSynthesize} lastUpdated={lastUpdated}
          isBaseline={isBaseline} savedAt={savedAt} events={events}
        />
        <ContextPanel events={events} calLoading={calLoading}/>
        <ExecutionPanel macro={macro} events={events}/>
      </div>

      {/* Private Briefings */}
      <BriefingsPanel
        briefings={briefings}
        loading={briefLoading}
        onGenerate={()=>generateBriefing(macro,prices,events)}
        lastBrief={lastBrief}
      />

      {/* FF Live Feed */}
      <FFLiveFeed feed={rawFeed} loading={aiLoading}/>

      {/* Footer */}
      <div className="footer-row">
        <span style={{ ...mono, fontSize:8, color:C.muted }}>TH30 CONTEXT TERMINAL · LIVE</span>
        <span style={{ ...mono, fontSize:8, color:C.muted }}>CONTEXT SUPPORT ONLY — STRUCTURE, ENTRIES + EXECUTION REMAIN WITH THE TRADER</span>
      </div>
    </div>
  );
}
