import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./App.css";
import { Arrow, ArrowBack, Bulb, Hero } from "./Art";

const MAX_MB = 2; // keep same as server
const MAX_PAPERS = 10;
const TIPS = [
  "Start with the questions that came in the most papers.",
  "Write answers in short points. Examiners like clear points.",
  "Study 25 minutes, then take a 5 minute break.",
  "Write each 10 mark answer by hand once before the exam.",
  "Sleep well the night before. It helps more than one extra hour of reading.",
];

type Page = "home" | "papers" | "study" | "quiz";
type Paper = {
  id: number;
  title: string;
  subject: string;
  status: string;
  qcount: number;
  created_at: string;
  removed_at: string | null;
};
type Q = { id: number; text: string; topic: string; papers: number; chance: number };
type Mcq = { q: string; options: string[]; answer: number };
type Nav = { go: (p: Page) => void };
type Subj = { subject: string; setSubject: (s: string) => void };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
const Spin = () => <span className="spin" />;

async function api(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  if (!(opts.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch("/api" + path, { ...opts, headers });
  let data: any = {};
  try {
    data = await r.json();
  } catch {
    // server sent a non-JSON error page
  }
  if (r.status === 401 && token) {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("session-expired"));
  }
  if (!r.ok)
    throw new Error(
      data.error ||
        (r.status === 413 ? "File too large" : r.status === 504 ? "Took too long, try again" : "Something went wrong"),
    );
  return data;
}

// phone photos are 3-8 MB, so shrink them before upload
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.8));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("token"));
  const [page, setPage] = useState<Page>("home");
  const [subject, setSubject] = useState("");

  useEffect(() => {
    const out = () => setLoggedIn(false);
    window.addEventListener("session-expired", out);
    return () => window.removeEventListener("session-expired", out);
  }, []);

  if (!loggedIn) return <Landing done={() => setLoggedIn(true)} />;

  const tabs: [Page, string][] = [
    ["home", "Home"],
    ["papers", "My papers"],
    ["study", "Study"],
    ["quiz", "Quiz"],
  ];
  return (
    <div className="wrap">
      <header className="top">
        <div className="brand" onClick={() => setPage("home")}>
          <Bulb on />
          <span>Exam Mate</span>
        </div>
        <nav>
          {tabs.map(([p, label]) => (
            <button key={p} className={"tab" + (page === p ? " active" : "")} onClick={() => setPage(p)}>
              {label}
            </button>
          ))}
          <button
            className="tab"
            onClick={() => {
              localStorage.removeItem("token");
              setLoggedIn(false);
              setPage("home");
            }}
          >
            Logout
          </button>
        </nav>
      </header>
      <main key={page} className="page">
        {page === "home" && <Home go={setPage} />}
        {page === "papers" && <Papers go={setPage} />}
        {page === "study" && <Study go={setPage} subject={subject} setSubject={setSubject} />}
        {page === "quiz" && <Quiz go={setPage} subject={subject} setSubject={setSubject} />}
      </main>
      <footer>Keep going, you are closer than you think.</footer>
    </div>
  );
}

function Landing({ done }: { done: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (mode: "login" | "signup") => {
    setBusy(true);
    setErr("");
    try {
      const d = await api("/" + mode, { method: "POST", body: JSON.stringify({ email, password }) });
      localStorage.setItem("token", d.token);
      done();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  };
  return (
    <div className="wrap landing">
      <section>
        <h1 className="logo">Exam Mate</h1>
        <p className="lead">Upload your old question papers and see which questions keep coming back.</p>
        <ol className="flow">
          <li>Upload papers</li>
          <li className="arrow"><Arrow /></li>
          <li>See likely questions</li>
          <li className="arrow"><Arrow /></li>
          <li>Practice quiz</li>
        </ol>
        <Hero />
      </section>
      <form
        className="paper login"
        onSubmit={(e) => {
          e.preventDefault();
          go("login");
        }}
      >
        <h2>Welcome</h2>
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Password (6+ characters)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="row">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? <Spin /> : "Login"}
          </button>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => go("signup")}>
            Sign up
          </button>
        </div>
        <p className="err">{err}</p>
      </form>
    </div>
  );
}

function Home({ go }: Nav) {
  const [on, setOn] = useState(false);
  const [tip, setTip] = useState(0);
  const cards: [Page, string, string][] = [
    ["papers", "Upload papers", "Add old question papers as a PDF or a clear photo."],
    ["study", "See likely questions", "Find the questions that repeat most, topic by topic."],
    ["quiz", "Practice quiz", "Quick MCQs from the questions that matter."],
  ];
  return (
    <>
      <h2>Ready to study?</h2>
      <div className="cards">
        {cards.map(([p, title, text], i) => (
          <button key={p} className="step-card" onClick={() => go(p)}>
            <span className="num">{i + 1}</span>
            <b>{title}</b>
            <span>{text}</span>
            <span className="go"><Arrow /></span>
          </button>
        ))}
      </div>
      <div className="tipbox">
        <button
          className={"bulb-btn" + (on ? " on" : "")}
          onClick={() => {
            if (on) setTip((t) => (t + 1) % TIPS.length);
            setOn(true);
          }}
        >
          <Bulb on={on} /> {on ? "Another tip" : "Need a tip?"}
        </button>
        {on && <p className="tip">{TIPS[tip]}</p>}
      </div>
    </>
  );
}

function Papers({ go }: Nav) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState({ t: "", bad: false });
  const [busy, setBusy] = useState(false);
  const say = (t: string, bad = false) => setMsg({ t, bad });
  const load = () => api("/papers").then(setPapers).catch((e) => say(errMsg(e), true));
  useEffect(() => {
    load();
  }, []);

  const active = papers.filter((p) => p.status === "active");
  const removed = papers.filter((p) => p.status === "removed");
  const tooBig = !!file && file.size > MAX_MB * 1024 * 1024;

  const pick = async (f: File | null) => {
    if (!f) return setFile(null);
    const small = await shrink(f);
    setFile(small);
    say(small.size > MAX_MB * 1024 * 1024 ? `File is ${(small.size / 1048576).toFixed(1)} MB, the limit is ${MAX_MB} MB.` : "", true);
  };
  const upload = async () => {
    if (!file || !subject.trim()) return say("Pick a file and write the subject", true);
    if (tooBig) return;
    setBusy(true);
    say("Reading your paper, this can take up to a minute...");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("subject", subject);
    fd.append("title", file.name);
    try {
      const d = await api("/papers", { method: "POST", body: fd });
      say(`Done! Found ${d.count} questions.`);
      setFile(null);
      load();
    } catch (e) {
      say(errMsg(e), true);
    }
    setBusy(false);
  };
  const remove = async (p: Paper) => {
    if (!window.confirm(`Remove "${p.title}"? Its questions will be deleted.`)) return;
    try {
      await api("/papers/" + p.id, { method: "DELETE" });
    } catch (e) {
      say(errMsg(e), true);
    }
    load();
  };

  return (
    <>
      <h2>Upload a paper</h2>
      <div className="paper">
        <input list="subs" placeholder="Subject (e.g. DBMS)" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <datalist id="subs">
          {[...new Set(active.map((p) => p.subject))].map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files?.[0] || null)} />
        <p className="hint">PDF or photo, max {MAX_MB} MB. Photos are shrunk for you. Use the same subject name for every paper so repeats are found.</p>
        <button className="btn" disabled={busy || tooBig} onClick={upload}>
          {busy ? <Spin /> : "Upload"}
        </button>
        <p className={msg.bad ? "err" : "ok"}>{msg.t}</p>
      </div>

      <h2>Your papers ({active.length}/{MAX_PAPERS})</h2>
      {!active.length && <p className="hint">Nothing here yet. Upload your first paper above.</p>}
      {active.map((p) => (
        <div key={p.id} className="paper row between">
          <span>
            <b>{p.title}</b> <span className="chip">{p.subject}</span>
            <br />
            <small>{p.qcount} questions, added {new Date(p.created_at).toLocaleDateString()}</small>
          </span>
          <button className="btn ghost" onClick={() => remove(p)}>Remove</button>
        </div>
      ))}

      {!!removed.length && <h2>Removed</h2>}
      {removed.map((p) => (
        <div key={p.id} className="paper faded">
          {p.title} <span className="chip">{p.subject}</span>
          <br />
          <small>removed on {new Date(p.removed_at!).toLocaleDateString()}</small>
        </div>
      ))}

      <div className="row between nav-row">
        <span />
        <button className="btn next" onClick={() => go("study")}>
          Next: Study <Arrow />
        </button>
      </div>
    </>
  );
}

function SubjectBar({ subject, setSubject, extra }: Subj & { extra?: ReactNode }) {
  const [subjects, setSubjects] = useState<string[] | null>(null);
  useEffect(() => {
    api("/subjects")
      .then((s: string[]) => {
        setSubjects(s);
        if (s.length && !s.includes(subject)) setSubject(s[0]);
      })
      .catch(() => setSubjects([]));
  }, []);
  if (!subjects) return <p className="hint">Loading...</p>;
  if (!subjects.length) return <p className="hint">No papers yet. Upload one from "My papers" first.</p>;
  return (
    <div className="row wrap-row">
      <select value={subject} onChange={(e) => setSubject(e.target.value)}>
        {subjects.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      {extra}
    </div>
  );
}

function Study({ go, subject, setSubject }: Nav & Subj) {
  const [topic, setTopic] = useState("");
  const [data, setData] = useState<{ total: number; topics: string[]; questions: Q[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState(0);
  const [marks, setMarks] = useState(5);
  const [web, setWeb] = useState(false);
  const [err, setErr] = useState("");
  const key = (id: number) => id + "-" + marks;

  useEffect(() => {
    if (!subject) return;
    let live = true;
    setErr("");
    api(`/likely?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}`)
      .then((d) => live && setData(d))
      .catch((e) => live && setErr(errMsg(e)));
    return () => {
      live = false;
    };
  }, [subject, topic]);

  const getAnswer = async (id: number) => {
    setBusyId(id);
    try {
      const d = await api("/answer", { method: "POST", body: JSON.stringify({ id, marks, web }) });
      setAnswers((a) => ({ ...a, [key(id)]: d.answer || "No answer came back, try again." }));
    } catch (e) {
      setAnswers((a) => ({ ...a, [key(id)]: errMsg(e) }));
    }
    setBusyId(0);
  };

  return (
    <>
      <h2>Most likely questions</h2>
      <SubjectBar
        subject={subject}
        setSubject={(s) => {
          setSubject(s);
          setTopic("");
          setData(null);
        }}
        extra={
          <>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">All units / topics</option>
              {data?.topics.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select value={marks} onChange={(e) => setMarks(+e.target.value)}>
              {[2, 5, 10].map((m) => (
                <option key={m} value={m}>{m} marks</option>
              ))}
            </select>
            <label className="check">
              <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} /> use web
            </label>
          </>
        }
      />
      <p className="err">{err}</p>
      {data && <p className="hint">Based on {data.total} paper(s).</p>}
      {data?.questions.map((q) => (
        <div key={q.id} className="paper">
          <p>{q.text}</p>
          <small>{q.topic} | came in {q.papers} of {data.total} papers</small>
          <div className="bar" title={q.chance + "%"}><i style={{ width: q.chance + "%" }} /></div>
          <button className="btn ghost" disabled={busyId === q.id} onClick={() => getAnswer(q.id)}>
            {busyId === q.id ? <Spin /> : "Show answer"}
          </button>
          {answers[key(q.id)] && <pre>{answers[key(q.id)]}</pre>}
        </div>
      ))}
      <div className="row between nav-row">
        <button className="btn ghost" onClick={() => go("papers")}><ArrowBack /> Papers</button>
        <button className="btn next" onClick={() => go("quiz")}>Practice quiz <Arrow /></button>
      </div>
    </>
  );
}

function Quiz({ go, subject, setSubject }: Nav & Subj) {
  const [qs, setQs] = useState<Mcq[]>([]);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const make = async () => {
    setBusy(true);
    setErr("");
    setPicked({});
    try {
      setQs(await api("/mcq", { method: "POST", body: JSON.stringify({ subject }) }));
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  };
  const finished = qs.length > 0 && Object.keys(picked).length === qs.length;
  const score = qs.filter((m, i) => picked[i] === m.answer).length;

  return (
    <>
      <h2>Practice quiz</h2>
      <SubjectBar
        subject={subject}
        setSubject={(s) => {
          setSubject(s);
          setQs([]);
        }}
        extra={
          <button className="btn" disabled={busy || !subject} onClick={make}>
            {busy ? <Spin /> : qs.length ? "New quiz" : "Make quiz"}
          </button>
        }
      />
      <p className="err">{err}</p>
      {qs.map((m, i) => {
        const done = picked[i] !== undefined;
        return (
          <div key={i} className="paper">
            <b>{i + 1}. {m.q}</b>
            {m.options.map((o, j) => (
              <button
                key={j}
                disabled={done}
                className={"opt" + (done ? (j === m.answer ? " correct" : picked[i] === j ? " wrong" : "") : "")}
                onClick={() => setPicked({ ...picked, [i]: j })}
              >
                {o}
              </button>
            ))}
          </div>
        );
      })}
      {finished && (
        <div className="paper score">
          <Bulb on={score / qs.length >= 0.6} />
          <b>You got {score} out of {qs.length}.</b>
          <span>{score / qs.length >= 0.6 ? "Nice work!" : "Check the likely questions again and retry."}</span>
        </div>
      )}
      <div className="row between nav-row">
        <button className="btn ghost" onClick={() => go("study")}><ArrowBack /> Likely questions</button>
        <button className="btn next" onClick={() => go("home")}>Home <Arrow /></button>
      </div>
    </>
  );
}
