import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const parse = (t?: string) =>
  JSON.parse((t || "").replace(/```json|```/g, "").trim());

export async function extractQuestions(data: Buffer, mime: string) {
  const r = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: mime, data: data.toString("base64") } },
          {
            text: 'This is an exam paper (maybe a photo or scan). Extract every question. Reply only JSON: [{"text":"...","topic":"short topic name"}]',
          },
        ],
      },
    ],
    config: { responseMimeType: "application/json" },
  });
  return parse(r.text) as { text: string; topic: string }[];
}

export async function embed(texts: string[]) {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    const r = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: texts.slice(i, i + 100),
      config: { outputDimensionality: 768 },
    });
    out.push(...r.embeddings!.map((e) => e.values!));
  }
  return out;
}

export async function answer(q: string, marks: number, web: boolean) {
  const r = await ai.models.generateContent({
    model: MODEL,
    contents: `Write an exam answer for a ${marks}-mark question, in short points a student can write.\nQuestion: ${q}`,
    config: web ? { tools: [{ googleSearch: {} }] } : undefined,
  });
  return r.text || "";
}

export async function makeMcqs(qs: string[]) {
  const r = await ai.models.generateContent({
    model: MODEL,
    contents:
      'Make one MCQ per question. Reply only JSON: [{"q":"","options":["","","",""],"answer":0}] (answer = index of correct option).\n' +
      qs.map((q, i) => `${i + 1}. ${q}`).join("\n"),
    config: { responseMimeType: "application/json" },
  });
  return parse(r.text);
}
