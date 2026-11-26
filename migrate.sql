-- Already ran the old schema? Run this ONCE instead of schema.sql.
-- Old test uploads are deleted: their vectors came from the retired embedding model and can't be reused.
TRUNCATE answers, questions, papers RESTART IDENTITY CASCADE;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS qcount INT DEFAULT 0;
ALTER TABLE questions ALTER COLUMN embedding TYPE HALFVEC(768) USING embedding::halfvec(768);
CREATE INDEX IF NOT EXISTS idx_papers_user ON papers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_paper ON questions(paper_id);
