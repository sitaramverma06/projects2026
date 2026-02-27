import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, LineChart, Line
} from "recharts";

// ─────────────────────────────────────────────
//  MOCK BACKEND — simulates FastAPI + Spark pipeline
// ─────────────────────────────────────────────
const MockBackend = {
  async trackKeyword(keyword) {
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    return {
      job_id: `job_${Date.now()}`,
      keyword,
      status: "streaming",
      stream_url: `/ws/sentiment/${keyword.toLowerCase().replace(/\s/g, "_")}`,
      estimated_posts_per_min: Math.floor(120 + Math.random() * 880),
    };
  },
  getSentimentTimeseries(keyword) {
    const now = Date.now();
    return Array.from({ length: 24 }, (_, i) => {
      const base = 40 + Math.sin(i * 0.4) * 15;
      const pos = Math.max(5, base + Math.random() * 20);
      const neg = Math.max(5, 100 - pos - (20 + Math.random() * 20));
      const neu = Math.max(5, 100 - pos - neg);
      return {
        time: new Date(now - (23 - i) * 3600000).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
        positive: +pos.toFixed(1),
        negative: +neg.toFixed(1),
        neutral: +neu.toFixed(1),
        volume: Math.floor(500 + Math.random() * 4500),
        compound: +(pos - neg).toFixed(2),
      };
    });
  },
  getDistribution() {
    const pos = 35 + Math.random() * 25;
    const neg = 15 + Math.random() * 20;
    return [
      { name: "Positive", value: +pos.toFixed(1), color: "#00ffa3" },
      { name: "Neutral", value: +(100 - pos - neg).toFixed(1), color: "#00d4ff" },
      { name: "Negative", value: +neg.toFixed(1), color: "#ff4d6d" },
    ];
  },
  getInsights(keyword) {
    return [
      { type: "spike", icon: "↑", label: "Positive Spike Detected", detail: `Sentiment for "${keyword}" surged +34% in the last 2 hours, correlated with a trending news cycle.`, severity: "success" },
      { type: "anomaly", icon: "⚡", label: "Anomaly Identified", detail: `Unusual bot-like activity detected — 12% of posts flagged by the LSTM anomaly classifier.`, severity: "warning" },
      { type: "trend", icon: "◈", label: "Emerging Sub-topic", detail: `Cluster analysis identified "pricing" and "launch" as co-occurring entities with high engagement velocity.`, severity: "info" },
      { type: "forecast", icon: "◉", label: "24h Forecast", detail: `Model predicts a 68% probability of sustained positive sentiment over the next 24 hours (confidence: 0.81).`, severity: "info" },
    ];
  },
  getModelInfo() {
    return {
      architecture: "BiLSTM + Multi-Head Attention",
      layers: [
        { name: "Embedding", params: "768-dim, GloVe + fine-tuned" },
        { name: "BiLSTM × 2", params: "512 hidden units, dropout 0.3" },
        { name: "Attention", params: "8 heads, 64-dim key/value" },
        { name: "Dense Classifier", params: "3-class softmax" },
      ],
      metrics: { accuracy: 0.923, f1: 0.918, auc: 0.971, latency_ms: 18 },
      pipeline: ["Tokenize → BPE", "LSTM Encode", "Attend", "Classify", "Stream to Kafka"],
    };
  },
  getPlatformData() {
    return [
      { platform: "Twitter/X", posts: 42300, positive: 48, negative: 22, neutral: 30 },
      { platform: "Reddit", posts: 18700, positive: 35, negative: 38, neutral: 27 },
      { platform: "News", posts: 9100, positive: 40, negative: 28, neutral: 32 },
      { platform: "Blogs", posts: 5400, positive: 55, negative: 18, neutral: 27 },
    ];
  },
  tick(currentData) {
    const last = currentData[currentData.length - 1];
    const pos = Math.max(5, Math.min(85, last.positive + (Math.random() - 0.5) * 6));
    const neg = Math.max(5, Math.min(50, last.negative + (Math.random() - 0.5) * 4));
    const neu = Math.max(5, 100 - pos - neg);
    return [...currentData.slice(-23), {
      time: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      positive: +pos.toFixed(1), negative: +neg.toFixed(1), neutral: +neu.toFixed(1),
      volume: Math.floor(500 + Math.random() * 4500), compound: +(pos - neg).toFixed(2),
    }];
  },
};

// ─────────────────────────────────────────────
//  DESIGN TOKENS
// ─────────────────────────────────────────────
const C = {
  bg: "#090e1a", surface: "#0d1526", card: "#111c30", border: "#1a2d4a",
  accent: "#00d4ff", green: "#00ffa3", red: "#ff4d6d", yellow: "#ffd166",
  muted: "#4a6080", text: "#c8daf0", textDim: "#607a96",
};

const mono = { fontFamily: '"IBM Plex Mono", "Courier New", monospace' };
const cardStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px" };
const tag = (color) => ({
  display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 11,
  fontWeight: 700, letterSpacing: "0.08em", background: `${color}18`,
  color, border: `1px solid ${color}40`, ...mono,
});

// ─────────────────────────────────────────────
//  SMALL COMPONENTS
// ─────────────────────────────────────────────
function GlowDot({ color = C.green, pulse = true }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: 10, height: 10 }}>
      {pulse && <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.3, animation: "pingAnim 1.8s ease-in-out infinite", transform: "scale(1.8)" }} />}
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
    </span>
  );
}

function StatCard({ label, value, sub, color = C.accent, delta }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 11, color: C.textDim, letterSpacing: "0.1em", textTransform: "uppercase", ...mono, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color, ...mono, lineHeight: 1 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        {delta !== undefined && <span style={tag(delta > 0 ? C.green : C.red)}>{delta > 0 ? "+" : ""}{delta}%</span>}
        {sub && <span style={{ fontSize: 12, color: C.textDim }}>{sub}</span>}
      </div>
    </div>
  );
}

function SectionHeader({ title, sub, badge }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>{title}</h2>
        {badge && <span style={tag(C.accent)}>{badge}</span>}
      </div>
      {sub && <p style={{ margin: "3px 0 0", fontSize: 12, color: C.textDim }}>{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
      <p style={{ margin: "0 0 6px", fontSize: 11, color: C.textDim, ...mono }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ margin: "2px 0", fontSize: 12, color: p.color, ...mono }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
//  TAB: DASHBOARD
// ─────────────────────────────────────────────
function DashboardTab({ data, keyword, distribution, platformData, stats }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <StatCard label="Overall Sentiment" value={`${stats.overallPos}%`} sub="Positive index" color={C.green} delta={stats.posDelta} />
        <StatCard label="Posts Analyzed" value={stats.postsAnalyzed} sub="Last 24 hours" color={C.accent} />
        <StatCard label="Avg Confidence" value={`${stats.confidence}%`} sub="Model score" color={C.yellow} />
        <StatCard label="Anomalies" value={stats.anomalies} sub="Flagged by LSTM" color={C.red} delta={-8.2} />
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Sentiment Trend — Live Stream" sub={`Tracking: "${keyword}" · WebSocket feed active`} badge="LIVE" />
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.green} stopOpacity={0.3} /><stop offset="95%" stopColor={C.green} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradNeg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.red} stopOpacity={0.3} /><stop offset="95%" stopColor={C.red} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradNeu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.accent} stopOpacity={0.2} /><stop offset="95%" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="time" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
            <YAxis tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="positive" stroke={C.green} strokeWidth={2} fill="url(#gradPos)" name="Positive" />
            <Area type="monotone" dataKey="negative" stroke={C.red} strokeWidth={2} fill="url(#gradNeg)" name="Negative" />
            <Area type="monotone" dataKey="neutral" stroke={C.accent} strokeWidth={1.5} fill="url(#gradNeu)" name="Neutral" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }}>
        <div style={cardStyle}>
          <SectionHeader title="Sentiment Distribution" sub="Aggregated 24h window" />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={distribution} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                  {distribution.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {distribution.map(d => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: C.text }}>{d.name}</span>
                  <span style={{ ...mono, fontSize: 13, color: d.color, marginLeft: "auto" }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <SectionHeader title="Platform Breakdown" sub="Volume by source" />
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={platformData} layout="vertical" margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="platform" tick={{ fill: C.text, fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="positive" stackId="a" fill={C.green} name="Positive" />
              <Bar dataKey="neutral" stackId="a" fill={C.accent} name="Neutral" />
              <Bar dataKey="negative" stackId="a" fill={C.red} radius={[0, 4, 4, 0]} name="Negative" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  TAB: DATA INPUT
// ─────────────────────────────────────────────
function DataInputTab({ onSubmit, jobs, isLoading }) {
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("en");
  const [sources, setSources] = useState({ twitter: true, reddit: true, news: true, blogs: false });
  const toggleSource = k => setSources(p => ({ ...p, [k]: !p[k] }));

  const inputStyle = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "10px 14px", color: C.text, fontSize: 14, ...mono, outline: "none", width: "100%",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 780 }}>
      <div style={cardStyle}>
        <SectionHeader title="Keyword / Hashtag Tracker" sub="POST /api/v1/track — Ingestion endpoint" badge="API" />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", ...mono }}>KEYWORD OR HASHTAG</label>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && input.trim() && onSubmit(input.trim())}
                placeholder="e.g. #AI, climate change, Tesla..."
                style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => input.trim() && onSubmit(input.trim())} disabled={isLoading || !input.trim()}
                style={{
                  padding: "10px 22px", borderRadius: 8, border: "none", cursor: isLoading ? "not-allowed" : "pointer",
                  background: isLoading ? C.border : C.accent, color: isLoading ? C.textDim : C.bg,
                  fontWeight: 700, fontSize: 13, ...mono, transition: "all 0.2s",
                }}>
                {isLoading ? "QUEUING..." : "TRACK →"}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <div>
              <label style={{ fontSize: 11, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", ...mono }}>LANGUAGE</label>
              <select value={language} onChange={e => setLanguage(e.target.value)}
                style={{ display: "block", marginTop: 6, ...inputStyle, width: "auto", padding: "8px 12px" }}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.textDim, letterSpacing: "0.08em", textTransform: "uppercase", ...mono }}>DATA SOURCES</label>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {Object.entries(sources).map(([k, v]) => (
                  <button key={k} onClick={() => toggleSource(k)} style={{
                    padding: "5px 12px", borderRadius: 6, border: `1px solid ${v ? C.accent : C.border}`,
                    background: v ? `${C.accent}18` : "transparent", color: v ? C.accent : C.textDim,
                    fontSize: 11, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase",
                    ...mono, fontWeight: v ? 700 : 400,
                  }}>{k}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Active Streaming Jobs" sub="Spark-like distributed processing workers" />
        {jobs.length === 0
          ? <p style={{ color: C.textDim, fontSize: 13, ...mono }}>No active jobs. Submit a keyword above to begin.</p>
          : jobs.map(job => (
            <div key={job.job_id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
              <GlowDot color={C.green} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{job.keyword}</span>
                  <span style={tag(C.green)}>STREAMING</span>
                </div>
                <span style={{ fontSize: 11, color: C.textDim, ...mono }}>{job.stream_url}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.accent, ...mono }}>{job.estimated_posts_per_min}</div>
                <div style={{ fontSize: 10, color: C.textDim }}>posts/min</div>
              </div>
            </div>
          ))}
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Pipeline Health" sub="Data streaming infrastructure status" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { name: "Kafka Broker", load: "34%" }, { name: "Spark Workers", load: "4/4 active" },
            { name: "Model Inference", load: "18ms avg" }, { name: "HDFS Storage", load: "62% used" },
            { name: "Redis Cache", load: "128ms TTL" }, { name: "API Gateway", load: "99.9% uptime" },
          ].map(node => (
            <div key={node.name} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <GlowDot color={C.green} pulse={false} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{node.name}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={tag(C.green)}>ONLINE</span>
                <span style={{ fontSize: 11, color: C.textDim, ...mono }}>{node.load}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  TAB: MODEL ENGINE
// ─────────────────────────────────────────────
function ModelTab({ modelInfo }) {
  const radarData = [
    { metric: "Accuracy", value: 92 }, { metric: "Precision", value: 90 },
    { metric: "Recall", value: 88 }, { metric: "F1-Score", value: 91 },
    { metric: "AUC-ROC", value: 97 }, { metric: "Speed", value: 95 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={cardStyle}>
        <SectionHeader title="Model Architecture" sub="Hybrid BiLSTM + Multi-Head Attention Sentiment Classifier" badge="DEEP LEARNING" />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {modelInfo.layers.map((layer, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 16px", minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, ...mono }}>{layer.name}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>{layer.params}</div>
              </div>
              {i < modelInfo.layers.length - 1 && <div style={{ fontSize: 18, color: C.border, padding: "0 6px" }}>→</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
        <div style={cardStyle}>
          <SectionHeader title="Evaluation Metrics" sub="Validation dataset performance" />
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
              <PolarGrid stroke={C.border} />
              <PolarAngleAxis dataKey="metric" tick={{ fill: C.textDim, fontSize: 11 }} />
              <Radar name="Model" dataKey="value" stroke={C.accent} fill={C.accent} fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div style={cardStyle}>
          <SectionHeader title="Performance Summary" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Accuracy", value: "92.3%", color: C.green },
              { label: "Macro F1", value: "91.8%", color: C.green },
              { label: "AUC-ROC", value: "0.971", color: C.accent },
              { label: "Avg Latency", value: "18 ms", color: C.yellow },
              { label: "Throughput", value: "4,200 /sec", color: C.accent },
              { label: "Model Size", value: "127 MB", color: C.textDim },
            ].map(m => (
              <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <span style={{ fontSize: 12, color: C.textDim }}>{m.label}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: m.color, ...mono }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Inference Pipeline" sub="Data flow from ingestion to prediction" />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {modelInfo.pipeline.map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ background: `${C.accent}15`, border: `1px solid ${C.accent}40`, borderRadius: 6, padding: "6px 14px", fontSize: 12, color: C.accent, ...mono }}>{step}</div>
              {i < modelInfo.pipeline.length - 1 && <span style={{ color: C.muted, fontSize: 16 }}>⟶</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  TAB: TREND INSIGHTS
// ─────────────────────────────────────────────
function InsightsTab({ insights, keyword, data }) {
  const cfg = {
    success: { color: C.green, bg: `${C.green}12`, border: `${C.green}35` },
    warning: { color: C.yellow, bg: `${C.yellow}12`, border: `${C.yellow}35` },
    info:    { color: C.accent, bg: `${C.accent}12`, border: `${C.accent}35` },
  };
  const volumeData = data.slice(-12).map(d => ({ time: d.time, volume: d.volume, compound: d.compound }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={cardStyle}>
        <SectionHeader title="AI-Generated Insights" sub={`Actionable signals for "${keyword}"`} badge="AUTOMATED" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {insights.map((ins, i) => {
            const c = cfg[ins.severity];
            return (
              <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ fontSize: 20, lineHeight: 1.2, color: c.color }}>{ins.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{ins.label}</div>
                  <div style={{ fontSize: 13, color: C.text, marginTop: 4, lineHeight: 1.6 }}>{ins.detail}</div>
                </div>
                <span style={{ ...tag(c.color), textTransform: "uppercase", flexShrink: 0 }}>{ins.type}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Volume & Compound Score" sub="Post volume vs. compound sentiment score" />
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={volumeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="time" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: C.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar yAxisId="left" dataKey="volume" fill={`${C.accent}50`} stroke={C.accent} strokeWidth={1} radius={[3, 3, 0, 0]} name="Volume" />
            <Line yAxisId="right" type="monotone" dataKey="compound" stroke={C.green} strokeWidth={2} dot={false} name="Compound" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={cardStyle}>
        <SectionHeader title="Sentiment Signal Grid" sub="24-hour hourly heatmap" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 3 }}>
          {data.map((d, i) => {
            const score = (d.positive - d.negative) / 100;
            const color = score > 0.1 ? C.green : score < -0.1 ? C.red : C.accent;
            const opacity = 0.2 + Math.abs(score) * 0.8;
            return <div key={i} title={`${d.time}: +${d.positive}% -${d.negative}%`} style={{ height: 36, borderRadius: 4, background: color, opacity }} />;
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 10, color: C.textDim, ...mono }}>24h ago</span>
          <span style={{ fontSize: 10, color: C.textDim, ...mono }}>Now</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  ROOT APP
// ─────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [keyword, setKeyword] = useState("Artificial Intelligence");
  const [data, setData] = useState(() => MockBackend.getSentimentTimeseries("Artificial Intelligence"));
  const [distribution, setDistribution] = useState(() => MockBackend.getDistribution());
  const [insights, setInsights] = useState(() => MockBackend.getInsights("Artificial Intelligence"));
  const [platformData] = useState(MockBackend.getPlatformData());
  const [modelInfo] = useState(MockBackend.getModelInfo());
  const [jobs, setJobs] = useState([{ job_id: "job_init", keyword: "Artificial Intelligence", status: "streaming", stream_url: "/ws/sentiment/artificial_intelligence", estimated_posts_per_min: 847 }]);
  const [isLoading, setIsLoading] = useState(false);
  const [liveCounter, setLiveCounter] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setData(prev => MockBackend.tick(prev));
      setLiveCounter(c => c + 1);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const stats = {
    overallPos: data[data.length - 1]?.positive?.toFixed(1) ?? "--",
    postsAnalyzed: `${(data.reduce((s, d) => s + d.volume, 0) / 1000).toFixed(1)}K`,
    confidence: (91 + Math.sin(liveCounter * 0.3) * 2).toFixed(1),
    anomalies: Math.floor(3 + Math.sin(liveCounter * 0.7) * 2),
    posDelta: +(data[data.length - 1]?.positive - (data[data.length - 4]?.positive || 0)).toFixed(1),
  };

  const handleTrack = useCallback(async (kw) => {
    setIsLoading(true);
    const job = await MockBackend.trackKeyword(kw);
    setKeyword(kw);
    setData(MockBackend.getSentimentTimeseries(kw));
    setDistribution(MockBackend.getDistribution());
    setInsights(MockBackend.getInsights(kw));
    setJobs(prev => [job, ...prev.slice(0, 4)]);
    setIsLoading(false);
    setActiveTab("dashboard");
  }, []);

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "input", label: "Data Input", icon: "⊕" },
    { id: "model", label: "Sentiment Engine", icon: "◉" },
    { id: "insights", label: "Trend Insights", icon: "▲" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: '"Syne", "Segoe UI", sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #090e1a; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #090e1a; }
        ::-webkit-scrollbar-thumb { background: #1a2d4a; border-radius: 3px; }
        input:focus, select:focus { border-color: #00d4ff !important; }
        @keyframes pingAnim {
          0%, 100% { transform: scale(1.8); opacity: 0.3; }
          50% { transform: scale(2.8); opacity: 0; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* TOPBAR */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, background: C.surface, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, ${C.green})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: C.bg }}>S</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.05em", color: C.text }}>SENTRIX</div>
            <div style={{ fontSize: 10, color: C.textDim, letterSpacing: "0.1em", ...mono }}>SENTIMENT INTELLIGENCE</div>
          </div>
        </div>

        <nav style={{ display: "flex", gap: 4 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "6px 16px", borderRadius: 7, border: "none", cursor: "pointer",
              background: activeTab === t.id ? `${C.accent}18` : "transparent",
              color: activeTab === t.id ? C.accent : C.textDim,
              fontSize: 13, fontWeight: activeTab === t.id ? 700 : 400,
              fontFamily: '"Syne", sans-serif', transition: "all 0.15s",
            }}>
              <span style={{ marginRight: 6, fontSize: 11 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GlowDot color={C.green} />
          <span style={{ fontSize: 11, color: C.textDim, ...mono }}>{keyword.toUpperCase().slice(0, 20)} · TICK #{liveCounter}</span>
        </div>
      </header>

      {/* BODY */}
      <main style={{ padding: "28px 32px", maxWidth: 1280, margin: "0 auto", animation: "fadeIn 0.3s ease" }}>
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: C.textDim, ...mono }}>SENTRIX</span>
          <span style={{ color: C.border }}>/</span>
          <span style={{ fontSize: 11, color: C.accent, ...mono }}>{tabs.find(t => t.id === activeTab)?.label.toUpperCase()}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <span style={tag(C.accent)}>BiLSTM + ATTENTION</span>
            <span style={tag(C.yellow)}>SPARK PIPELINE</span>
            <span style={tag(C.green)}>LIVE</span>
          </div>
        </div>

        {activeTab === "dashboard" && <DashboardTab data={data} keyword={keyword} distribution={distribution} platformData={platformData} stats={stats} />}
        {activeTab === "input"     && <DataInputTab onSubmit={handleTrack} jobs={jobs} isLoading={isLoading} />}
        {activeTab === "model"     && <ModelTab modelInfo={modelInfo} />}
        {activeTab === "insights"  && <InsightsTab insights={insights} keyword={keyword} data={data} />}
      </main>

      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "14px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.textDim, ...mono }}>SENTRIX v2.4.1 · FastAPI + React · BiLSTM Sentiment Engine</span>
        <div style={{ display: "flex", gap: 16 }}>
          {["REST API", "WebSocket", "HDFS", "Kafka"].map(t => <span key={t} style={{ fontSize: 10, color: C.muted, ...mono }}>{t}</span>)}
        </div>
      </footer>
    </div>
  );
}
