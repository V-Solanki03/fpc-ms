import { q, one } from "./db";
import { scoreboard } from "./metrics";
import { setSetting } from "./settings";

export const aiConfigured = () => !!process.env.GEMINI_API_KEY;
async function budget() {
  const month = new Date().toISOString().slice(0, 7);
  const r = await one<{ value: any }>("select value from settings where key='ai_usage'");
  const u = r?.value?.month === month ? r.value : { month, calls: 0 };
  return { u, cap: Number(process.env.AI_MONTHLY_CALL_CAP || 300) };
}
export async function aiUsage() { const { u, cap } = await budget(); return { calls: u.calls as number, cap }; }

/** Sends only already-computed team numbers to Gemini. No names of students or contacts leave the app. */
export async function gemini(prompt: string): Promise<string> {
  if (!aiConfigured()) throw new Error("AI is off. Add GEMINI_API_KEY in Vercel to turn it on.");
  const { u, cap } = await budget();
  if (u.calls >= cap) throw new Error(`Monthly AI cap of ${cap} calls reached. Raise AI_MONTHLY_CALL_CAP to continue.`);
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 600 } }),
  });
  const j: any = await res.json();
  if (!res.ok) throw new Error("Gemini error: " + (j.error?.message || res.status));
  await setSetting("ai_usage", { month: u.month, calls: u.calls + 1 });
  return (j.candidates?.[0]?.content?.parts || []).map((p: any) => p.text).join("").trim() || "(empty answer)";
}

export async function summariseDay(day: string) {
  const { rows, total } = await scoreboard(day, day);
  const lines = rows.map((r) => `${r.member.name}: calls ${r.calls}/${r.target_calls}, connected ${r.connected}, meetings scheduled ${r.scheduled}, held ${r.held}, deals ${r.deals}`).join("\n");
  return gemini(`You are an operations analyst for a campus-hiring sales team. Write 4 short bullet points on how the team did on ${day}: what stands out, who needs a check-in, and one suggested action. Plain language, no hype.\nTotals: calls ${total.calls}, connected ${total.connected}, meetings scheduled ${total.scheduled}, held ${total.held}, deals ${total.deals}.\n${lines}`);
}
