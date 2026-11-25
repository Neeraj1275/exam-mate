import { useEffect, useState } from "react";
import "./App.css";

type Paper = {
  id: number;
  title: string;
  subject: string;
  status: string;
  created_at: string;
  removed_at: string | null;
  qcount: string;
};
type Q = {
  id: number;
  text: string;
  topic: string;
  papers: string;
  chance: number;
};
type Mcq = { q: string; options: string[]; answer: number };

async function api(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const headers: any = {
    ...(opts.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };
  const r = await fetch("/api" + path, { ...opts, headers });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Error");
  return data;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("token"));
  const [tab, setTab] = useState<"papers" | "study">("papers");
  if (!loggedIn) return <Login done={() => setLoggedIn(true)} />;
  return (
    <div className="wrap">
      <header>
        <h1>Exam Mate</h1>
        <nav>
          <button onClick={() => setTab("papers")}>My papers</button>
          <button onClick={() => setTab("study")}>Study</button>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              setLoggedIn(false);
            }}
          >
            Logout
          </button>
        </nav>
      </header>
      {tab === "papers" ? <Papers /> : <Study />}
    </div>
  );
}

function Login({ done }: { done: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const go = async (mode: "login" | "signup") => {
    try {
      const d = await api("/" + mode, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("token", d.token);
      done();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <div className="wrap small">
      <h1>Exam Mate</h1>
      <p>Upload old papers, see which questions keep coming back.</p>
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={() => go("login")}>Login</button>{" "}
      <button onClick={() => go("signup")}>Sign up</button>
      <p className="err">{err}</p>
    </div>
  );
}

function Papers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api("/papers").then(setPapers);
  useEffect(() => {
    load();
  }, []);

  const upload = async () => {
    if (!file || !subject) return setMsg("Pick a file and write the subject");
    setBusy(true);
    setMsg("Reading your paper, this takes a few seconds...");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("subject", subject);
    fd.append("title", file.name);
    try {
      const d = await api("/papers", { method: "POST", body: fd });
      setMsg(`Done, found ${d.count} questions`);
      setFile(null);
      load();
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy(false);
  };
  const remove = async (id: number) => {
    await api("/papers/" + id, { method: "DELETE" });
    load();
  };

  const row = (p: Paper) => (
    <li key={p.id}>
      {p.title} ({p.subject}, {p.qcount} questions)
      {p.status === "active" ? (
        <button onClick={() => remove(p.id)}>Remove</button>
      ) : (
        <small>
          {" "}
          removed on {new Date(p.removed_at!).toLocaleDateString()}
        </small>
      )}
    </li>
  );
  return (
    <div>
      <h2>Upload a paper</h2>
      <input
        placeholder="Subject (e.g. DBMS)"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <input
        type="file"
        accept="application/pdf,image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button disabled={busy} onClick={upload}>
        Upload
      </button>
      <p>{msg}</p>
      <h2>Uploaded</h2>
      <ul>{papers.filter((p) => p.status === "active").map(row)}</ul>
      <h2>Removed</h2>
      <ul>{papers.filter((p) => p.status === "removed").map(row)}</ul>
    </div>
  );
}

function Study() {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [data, setData] = useState<{
    total: number;
    topics: string[];
    questions: Q[];
  } | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [marks, setMarks] = useState(5);
  const [web, setWeb] = useState(false);
  const [quiz, setQuiz] = useState<Mcq[]>([]);
  const [picked, setPicked] = useState<Record<number, number>>({});

  useEffect(() => {
    api("/subjects").then((s) => {
      setSubjects(s);
      if (s[0]) setSubject(s[0]);
    });
  }, []);
  useEffect(() => {
    if (subject)
      api(
        `/likely?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}`,
      ).then(setData);
  }, [subject, topic]);

  const getAnswer = async (id: number) => {
    setAnswers((a) => ({ ...a, [id]: "Loading..." }));
    try {
      const d = await api("/answer", {
        method: "POST",
        body: JSON.stringify({ id, marks, web }),
      });
      setAnswers((a) => ({ ...a, [id]: d.answer }));
    } catch (e: any) {
      setAnswers((a) => ({ ...a, [id]: e.message }));
    }
  };
  const makeQuiz = async () => {
    setPicked({});
    setQuiz(
      await api("/mcq", {
        method: "POST",
        body: JSON.stringify({
          ids: data!.questions.slice(0, 10).map((q) => q.id),
        }),
      }),
    );
  };

  if (!subjects.length) return <p>Upload a paper first.</p>;
  return (
    <div>
      <select
        value={subject}
        onChange={(e) => {
          setSubject(e.target.value);
          setTopic("");
        }}
      >
        {subjects.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>{" "}
      <select value={topic} onChange={(e) => setTopic(e.target.value)}>
        <option value="">All units/topics</option>
        {data?.topics.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <p>
        Answer length:{" "}
        <select value={marks} onChange={(e) => setMarks(+e.target.value)}>
          {[2, 5, 10].map((m) => (
            <option key={m} value={m}>
              {m} marks
            </option>
          ))}
        </select>{" "}
        <label>
          <input
            type="checkbox"
            checked={web}
            onChange={(e) => setWeb(e.target.checked)}
          />{" "}
          use web
        </label>{" "}
        <button onClick={makeQuiz}>Make MCQ quiz</button>
      </p>
      {quiz.map((m, i) => (
        <div key={i} className="card">
          <b>
            {i + 1}. {m.q}
          </b>
          {m.options.map((o, j) => (
            <div key={j}>
              <button onClick={() => setPicked({ ...picked, [i]: j })}>
                {o}
              </button>
              {picked[i] === j && (j === m.answer ? " ✔ correct" : " ✘ wrong")}
            </div>
          ))}
        </div>
      ))}
      <h2>Most likely questions ({data?.total} papers)</h2>
      {data?.questions.map((q) => (
        <div key={q.id} className="card">
          <p>{q.text}</p>
          <small>
            {q.topic} | came in {q.papers} of {data.total} papers (~{q.chance}%)
          </small>
          <br />
          <button onClick={() => getAnswer(q.id)}>Show answer</button>
          {answers[q.id] && <pre>{answers[q.id]}</pre>}
        </div>
      ))}
    </div>
  );
}
