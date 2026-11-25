import express from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { pool } from "../lib/db";
import { extractQuestions, embed, answer, makeMcqs } from "../lib/gemini";

const app = express();
app.use(express.json());
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});
const SECRET = process.env.JWT_SECRET!;
type Req = express.Request & { uid?: number };

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
    res.status(401).json({ error: "Please login again" });
  }
};
const token = (uid: number) => jwt.sign({ uid }, SECRET, { expiresIn: "30d" });

app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6)
    return res
      .status(400)
      .json({ error: "Email and a 6+ character password needed" });
  try {
    const r = await pool.query(
      "insert into users(email,password) values($1,$2) returning id",
      [email.toLowerCase(), await bcrypt.hash(password, 10)],
    );
    res.json({ token: token(r.rows[0].id) });
  } catch {
    res.status(400).json({ error: "Email already used" });
  }
});

app.post("/api/login", async (req, res) => {
  const u = (
    await pool.query("select * from users where email=$1", [
      String(req.body.email).toLowerCase(),
    ])
  ).rows[0];
  if (!u || !(await bcrypt.compare(req.body.password, u.password)))
    return res.status(401).json({ error: "Wrong email or password" });
  res.json({ token: token(u.id) });
});

app.get("/api/papers", auth, async (req: Req, res) => {
  const r = await pool.query(
    "select p.*, (select count(*) from questions where paper_id=p.id) as qcount from papers p where user_id=$1 order by created_at desc",
    [req.uid],
  );
  res.json(r.rows);
});

app.post("/api/papers", auth, upload.single("file"), async (req: Req, res) => {
  const f = req.file;
  const { subject, title } = req.body;
  if (!f || !subject)
    return res.status(400).json({ error: "File and subject needed" });
  const qs = (await extractQuestions(f.buffer, f.mimetype)).filter(
    (q) => q.text,
  );
  if (!qs.length)
    return res
      .status(422)
      .json({ error: "No questions found. Try a clearer file." });
  const vecs = await embed(qs.map((q) => q.text));
  const c = await pool.connect();
  try {
    await c.query("begin");
    const p = await c.query(
      "insert into papers(user_id,title,subject) values($1,$2,$3) returning id",
      [req.uid, title || f.originalname, subject.trim().toLowerCase()],
    );
    for (let i = 0; i < qs.length; i++)
      await c.query(
        "insert into questions(paper_id,user_id,text,topic,embedding) values($1,$2,$3,$4,$5)",
        [
          p.rows[0].id,
          req.uid,
          qs[i].text,
          qs[i].topic,
          JSON.stringify(vecs[i]),
        ],
      );
    await c.query("commit");
    res.json({ count: qs.length });
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
});

app.delete("/api/papers/:id", auth, async (req: Req, res) => {
  await pool.query(
    "update papers set status='removed', removed_at=now() where id=$1 and user_id=$2",
    [req.params.id, req.uid],
  );
  res.json({ ok: true });
});

app.get("/api/subjects", auth, async (req: Req, res) => {
  const r = await pool.query(
    "select distinct subject from papers where user_id=$1 and status='active'",
    [req.uid],
  );
  res.json(r.rows.map((x) => x.subject));
});

app.get("/api/likely", auth, async (req: Req, res) => {
  const subject = String(req.query.subject || "").toLowerCase();
  const topic = req.query.topic ? String(req.query.topic) : null;
  const total = +(
    await pool.query(
      "select count(*) from papers where user_id=$1 and subject=$2 and status='active'",
      [req.uid, subject],
    )
  ).rows[0].count;
  const base = `select q.* from questions q join papers p on p.id=q.paper_id
                where q.user_id=$1 and p.subject=$2 and p.status='active'`;
  const topics = (
    await pool.query(`with q as (${base}) select distinct topic from q`, [
      req.uid,
      subject,
    ])
  ).rows.map((x) => x.topic);
  const r = await pool.query(
    `
    with q as (${base})
    select a.id, a.text, a.topic,
      (select count(distinct b.paper_id) from q b where b.embedding <=> a.embedding < 0.25) as papers
    from q a
    where ($3::text is null or a.topic=$3)
      and not exists (select 1 from q c where c.id < a.id and c.embedding <=> a.embedding < 0.25)
    order by papers desc, a.id limit 15`,
    [req.uid, subject, topic],
  );
  res.json({
    total,
    topics,
    questions: r.rows.map((x) => ({
      ...x,
      chance: total ? Math.round((100 * x.papers) / total) : 0,
    })),
  });
});

app.post("/api/answer", auth, async (req: Req, res) => {
  const { id, marks = 5, web = false } = req.body;
  const q = (
    await pool.query("select text from questions where id=$1 and user_id=$2", [
      id,
      req.uid,
    ])
  ).rows[0];
  if (!q) return res.status(404).json({ error: "Question not found" });
  if (!web) {
    const c = (
      await pool.query(
        "select text from answers where question_id=$1 and marks=$2",
        [id, marks],
      )
    ).rows[0];
    if (c) return res.json({ answer: c.text });
  }
  const text = await answer(q.text, marks, web);
  if (!web)
    await pool.query(
      "insert into answers values($1,$2,$3) on conflict do nothing",
      [id, marks, text],
    );
  res.json({ answer: text });
});

app.post("/api/mcq", auth, async (req: Req, res) => {
  const r = await pool.query(
    "select text from questions where id = any($1) and user_id=$2",
    [req.body.ids.slice(0, 10), req.uid],
  );
  res.json(await makeMcqs(r.rows.map((x) => x.text)));
});

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong, please try again" });
  },
);

export default app;
