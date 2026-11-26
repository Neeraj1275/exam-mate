Exam Mate 📚
An AI-powered exam preparation platform that turns previous-year
question papers into an intelligent study resource.

Exam Mate helps students organize previous-year question papers, extract
questions and topics with Google Gemini, explore recurring questions
using vector similarity, generate exam-oriented answers, and practice
with MCQs.
Features
- Paper upload: Upload supported PDF and image files.
- AI question extraction: Extract questions and short topic labels
  using Google Gemini.
- Similarity-based analysis: Compare question embeddings to
  identify similar or recurring questions across uploaded papers.
- AI-generated answers: Generate concise, exam-oriented answers.
- MCQ practice: Generate quizzes from extracted study material.
- Study dashboard: View and manage uploaded papers.
- Authentication: User signup and login using bcrypt password
  hashing and JWT.
- Answer caching: Store generated answers to reduce repeated AI
  requests.
- Paper management: Manage and delete uploaded papers.
Tech stack
  Layer                               Technology
  Frontend                            React, TypeScript, Vite

  Backend                             Node.js, Express, TypeScript

  Database                            Neon PostgreSQL

  Vector search                       pgvector (halfvec, as configured
in the database schema)

  AI                                  Google Gemini API

  Authentication                      JWT, bcryptjs

  PostgreSQL client                   pg
Deployment                          Vercel
How it works
1. A student uploads a question paper.
2. The Express API receives and validates the file.
3. Gemini processes the PDF or image and extracts questions and topic
   labels.
4. The application generates embeddings for the extracted questions.
5. Questions, metadata and embeddings are stored in Neon PostgreSQL.
6. Similarity search helps identify related questions across the papers
   available in the database.
7. Students can study extracted questions, generate answers and
   practice MCQs.
Similarity results are study aids based on the papers uploaded to the
application; they are not guarantees about future exams.
Project structure
exam-mate/
├── api/
│   └── index.ts
├── lib/
│   ├── db.ts
│   └── gemini.ts
├── client/
│   ├── public/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── Art.tsx
│   ├── index.html
│   └── package.json
├── server.ts
├── schema.sql
├── migrate.sql
├── vercel.json
├── package.json
├── package-lock.json
├── .env.example
└── README.md
Getting started
Prerequisites
- Node.js and npm
- A Neon PostgreSQL database
- A Google Gemini API key
1. Clone the repository
git clone https://github.com/Neeraj1275/Exam_mate.git
cd Exam_mate
2. Install dependencies
Install the root dependencies:
npm install
Install the frontend dependencies:
cd client
npm install
cd ..
3. Configure environment variables
Create a .env file in the project root. Use .env.example as a
template.
DATABASE_URL=your_neon_pooled_connection_string
JWT_SECRET=your_secure_jwt_secret
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=your_available_gemini_generation_model
EMBED_MODEL=your_available_gemini_embedding_model
Set the model names to models available to your Google AI project and
supported by the installed Gemini SDK.

Keep .env private. Never commit API keys, database credentials or
JWT secrets to GitHub.
4. Set up the database
Create a Neon PostgreSQL project and copy its pooled connection string
into DATABASE_URL.

For a fresh database, run the appropriate initialization SQL from
schema.sql in the Neon SQL Editor.

For an existing database, inspect migrate.sql before running it. The
supplied migration may clear existing paper, question and answer data.
Back up anything you need before applying a migration.
5. Run locally
Open two terminals from the project root.

Terminal 1 --- Backend
npm run dev:api
Terminal 2 --- Frontend
npm run dev:client
Open the frontend at:
http://localhost:5173
The local API server is configured to run at:
http://localhost:3001
Deployment on Vercel
1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Set the project root to the repository root.
4. Keep the repository's vercel.json build and routing configuration.
5. Add the required environment variables in Vercel Project Settings.
6. Deploy and test signup, login, paper upload, study and quiz
   functionality.
Configure these environment variables in Vercel:
- DATABASE_URL
- JWT_SECRET
- GEMINI_API_KEY
- GEMINI_MODEL
- EMBED_MODEL
Use the appropriate Neon connection string and model identifiers for the
deployment environment. Keep all secrets server-side.
Security notes
- Passwords are hashed before being stored.
- JWT is used to authenticate protected API requests.
- Database access uses parameterized SQL queries.
- Secrets are read from environment variables and should not be
  exposed in frontend code.
- File validation and upload limits should be kept enabled.
Future improvements
- More detailed subject-wise analytics.
- Personalized study plans and recommendations.
- Improved question trend analysis.
- Progress tracking and performance insights.
- Additional document-processing improvements.
Author
Neeraj Goswami

MCA Student | Full Stack Developer | AI Enthusiast

GitHub: @Neeraj1275
Built to make exam preparation smarter with AI.
