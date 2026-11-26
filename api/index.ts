import express from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { pool } from "../lib/db";
import { extractQuestions, embed, answer, makeMcqs } from "../lib/gemini";

// ---- limits (keeps Neon free tier and Gemini free quota safe) ----
const MAX_FILE = 2 * 1024 * 1024; // 2 MB
const MAX_ACTIVE = 10; // papers a user can keep
const MAX_PER_DAY = 5; // uploads per user per day
const MAX_Q = 50; // questions kept per paper
const SIMILAR = 0.25; // lower = stricter "same question" match
const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error("JWT_SECRET is missing");

const app = express();
app.use(express.json());
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE },
  fileFilter: (_req, file, cb) =>
    TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error("BAD_TYPE")),
});
type Req = express.Request & { uid?: number };
const bad = (res: express.Response, code: number, error: string) =>
  void res.status(code).json({ error });

const auth = (req: Req, res: express.Response, next: express.NextFunction) => {
  try {
    req.uid = (
      jwt.verify(
        (req.headers.authorization || "").replace("Bearer ", ""),
        SECRET,
      ) as any
    ).uid;
    next();
  } catch {
    bad(res, 401, "Please login again");
  }
};
const token = (uid: number) => jwt.sign({ uid }, SECRET, { expiresIn: "30d" });

app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body || {};
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    password.length < 6
  )
    return bad(res, 400, "Email and a 6+ character password needed");
  try {
    const r = await pool.query(
      "insert into users(email,password) values($1,$2) returning id",
      [email.trim().toLowerCase(), await bcrypt.hash(password, 10)],
    );
    res.json({ token: token(r.rows[0].id) });
  } catch (error) {
    const dbError = error as { code?: string };

    if (dbError.code === "23505") {
      return bad(res, 409, "Email already used");
    }

    console.error("Signup database error:", error);

    return bad(res, 500, "Unable to create account. Please try again.");
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || typeof password !== "string")
    return bad(res, 400, "Email and password needed");
  const u = (
    await pool.query("select * from users where email=$1", [
      email.trim().toLowerCase(),
    ])
  ).rows[0];
  if (!u || !(await bcrypt.compare(password, u.password)))
    return bad(res, 401, "Wrong email or password");
  res.json({ token: token(u.id) });
});

app.get("/api/papers", auth, async (req: Req, res) => {
  const r = await pool.query(
    "select id,title,subject,status,qcount,created_at,removed_at from papers where user_id=$1 order by created_at desc",
    [req.uid],
  );
  res.json(r.rows);
});

app.post("/api/papers", auth, upload.single("file"), async (req: Req, res) => {
  const f = req.file;
  const subject = String(req.body?.subject || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 40);
  const title = String(req.body?.title || f?.originalname || "Paper").slice(
    0,
    80,
  );
  if (!f || !subject) return bad(res, 400, "File and subject needed");

  // check limits BEFORE spending Gemini quota
  const lim = (
    await pool.query(
      `select count(*) filter (where status='active')::int as active,
              count(*) filter (where created_at > now() - interval '1 day')::int as today
       from papers where user_id=$1`,
      [req.uid],
    )
  ).rows[0];
  if (lim.active >= MAX_ACTIVE)
    return bad(
      res,
      400,
      `You can keep ${MAX_ACTIVE} papers. Remove an old one first.`,
    );
  if (lim.today >= MAX_PER_DAY)
    return bad(
      res,
      429,
      `Limit is ${MAX_PER_DAY} uploads per day. Come back tomorrow.`,
    );

  const qs = (await extractQuestions(f.buffer, f.mimetype))
    .filter((q) => q && typeof q.text === "string" && q.text.trim())
    .slice(0, MAX_Q)
    .map((q) => ({
      text: q.text.trim().slice(0, 300),
      topic: String(q.topic || "General").slice(0, 40),
    }));
  if (!qs.length)
    return bad(res, 422, "No questions found. Try a clearer file.");
  const vecs = await embed(qs.map((q) => q.text));

  // one atomic statement: paper + all its questions
  await pool.query(
    `with p as (
       insert into papers(user_id,title,subject,qcount)
       values($1::int,$2::text,$3::text,$4::int) returning id)
     insert into questions(paper_id,user_id,text,topic,embedding)
     select p.id,$1::int,x.t,x.tp,x.e::halfvec(768)
     from p, unnest($5::text[],$6::text[],$7::text[]) as x(t,tp,e)`,
    [
      req.uid,
      title,
      subject,
      qs.length,
      qs.map((q) => q.text),
      qs.map((q) => q.topic),
      vecs.map((v) => JSON.stringify(v)),
    ],
  );
  res.json({ count: qs.length });
});

// removing a paper keeps its record but deletes its questions to free Neon space
app.delete("/api/papers/:id", auth, async (req: Req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return bad(res, 400, "Bad id");
  await pool.query(
    `with p as (update papers set status='removed', removed_at=now()
                where id=$1 and user_id=$2 and status='active' returning id)
     delete from questions where paper_id in (select id from p)`,
    [id, req.uid],
  );
  res.json({ ok: true });
});

app.get("/api/subjects", auth, async (req: Req, res) => {
  const r = await pool.query(
    "select distinct subject from papers where user_id=$1 and status='active' order by subject",
    [req.uid],
  );
  res.json(r.rows.map((x) => x.subject));
});

async function likely(uid: number, subject: string, topic: string | null) {
  const base = `select q.id, q.text, q.topic, q.paper_id, q.embedding
                from questions q join papers p on p.id=q.paper_id
                where q.user_id=$1 and p.subject=$2 and p.status='active'`;
  const [t, tp, r] = await Promise.all([
    pool.query(
      "select count(*)::int as n from papers where user_id=$1 and subject=$2 and status='active'",
      [uid, subject],
    ),
    pool.query(`select distinct topic from (${base}) q order by topic`, [
      uid,
      subject,
    ]),
    pool.query(
      `with q as (${base})
       select a.id, a.text, a.topic,
         (select count(distinct b.paper_id)::int from q b where b.embedding <=> a.embedding < ${SIMILAR}) as papers
       from q a
       where ($3::text is null or a.topic=$3)
         and not exists (select 1 from q c where c.id < a.id and c.embedding <=> a.embedding < ${SIMILAR})
       order by papers desc, a.id limit 15`,
      [uid, subject, topic],
    ),
  ]);
  const total: number = t.rows[0].n;
  return {
    total,
    topics: tp.rows.map((x) => x.topic).filter(Boolean),
    questions: r.rows.map((x) => ({
      ...x,
      chance: total ? Math.round((100 * x.papers) / total) : 0,
    })),
  };
}

app.get("/api/likely", auth, async (req: Req, res) => {
  const subject = String(req.query.subject || "").toLowerCase();
  const topic = req.query.topic ? String(req.query.topic) : null;
  res.json(await likely(req.uid as number, subject, topic));
});

app.post("/api/answer", auth, async (req: Req, res) => {
  const { id, marks = 5, web = false } = req.body || {};
  if (!Number.isInteger(id) || ![2, 5, 10].includes(marks))
    return bad(res, 400, "Bad request");
  const q = (
    await pool.query("select text from questions where id=$1 and user_id=$2", [
      id,
      req.uid,
    ])
  ).rows[0];
  if (!q) return bad(res, 404, "Question not found");
  if (!web) {
    const c = (
      await pool.query(
        "select text from answers where question_id=$1 and marks=$2",
        [id, marks],
      )
    ).rows[0];
    if (c) return void res.json({ answer: c.text });
  }
  const text = await answer(q.text, marks, !!web);
  if (!web && text)
    await pool.query(
      "insert into answers values($1,$2,$3) on conflict do nothing",
      [id, marks, text],
    );
  res.json({ answer: text });
});

app.post("/api/mcq", auth, async (req: Req, res) => {
  const subject = String(req.body?.subject || "").toLowerCase();
  const { questions } = await likely(req.uid as number, subject, null);
  if (!questions.length)
    return bad(res, 404, "Upload a paper for this subject first");
  res.json(await makeMcqs(questions.slice(0, 8).map((q) => q.text)));
});

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err?.code === "LIMIT_FILE_SIZE")
      return bad(
        res,
        413,
        "File too large. Max 2 MB (photos are shrunk automatically).",
      );
    if (err?.message === "BAD_TYPE")
      return bad(res, 415, "Only PDF, JPG, PNG or WEBP files");
    if (err?.message === "BUSY")
      return bad(res, 503, "AI is busy, please try again in a minute");
    console.error(err);
    bad(res, 500, "Something went wrong, please try again");
  },
);

export default app;
