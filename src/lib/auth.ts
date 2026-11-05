// Temporary shared-password gate. Replace with Google sign-in and roles later.
export async function sessionToken() {
  const pw = process.env.APP_PASSWORD || "";
  const data = new TextEncoder().encode(pw + "|" + (process.env.SESSION_SECRET || "dev"));
  const h = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const authRequired = () => !!process.env.APP_PASSWORD;
export const COOKIE = "fpcms_session";
