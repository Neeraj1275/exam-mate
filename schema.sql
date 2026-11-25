
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

-- Papers table
CREATE TABLE IF NOT EXISTS papers (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    removed_at TIMESTAMPTZ
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    paper_id INT REFERENCES papers(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    topic TEXT,
    embedding VECTOR(768)
);

-- Answers table
CREATE TABLE IF NOT EXISTS answers (
    question_id INT REFERENCES questions(id) ON DELETE CASCADE,
    marks INT NOT NULL,
    text TEXT,
    PRIMARY KEY (question_id, marks)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_papers_user_id
ON papers(user_id);

CREATE INDEX IF NOT EXISTS idx_questions_user_id
ON questions(user_id);
