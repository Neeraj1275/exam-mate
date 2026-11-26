-- Fresh database: run this whole file in the Neon SQL editor
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS papers (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    qcount INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    removed_at TIMESTAMPTZ
);

-- halfvec = half the storage of vector (good for Neon free tier)
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    paper_id INT REFERENCES papers(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    topic TEXT,
    embedding HALFVEC(768)
);

CREATE TABLE IF NOT EXISTS answers (
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    marks INT NOT NULL,
    text TEXT,
    PRIMARY KEY (question_id, marks)
);

CREATE INDEX IF NOT EXISTS idx_papers_user ON papers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_paper ON questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_questions_user ON questions(user_id);
