import { q } from "./db";

export const emailLive = () => process.env.EMAIL_LIVE === "true" && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;

/** Saves the email. It is only sent when EMAIL_LIVE=true; otherwise it stays a preview you can read in the app. */
export async function queueEmail(m: { kind: string; to: string[]; cc?: string[]; subject: string; html: string; text: string; dedupeKey?: string }) {
  const rows = await q(
    `insert into email_outbox(kind,to_list,cc_list,subject,html,body,status,dedupe_key) values($1,$2,$3,$4,$5,$6,'preview',$7)
     on conflict(dedupe_key) do nothing returning id`,
    [m.kind, m.to, m.cc || [], m.subject, m.html, m.text, m.dedupeKey || null]
  );
  if (!rows.length) return { id: null as number | null, status: "duplicate" };
  const id = rows[0].id as number;
  if (emailLive() && m.to.length) return { id, status: await deliver(id) };
  return { id, status: "preview" };
}

export async function deliver(id: number): Promise<string> {
  const [row] = await q("select * from email_outbox where id=$1", [id]);
  if (!row) throw new Error("Email not found");
  if (row.status === "sent") return "sent";
  if (!emailLive()) throw new Error("Email sending is off. Set EMAIL_LIVE=true and the SMTP settings.");
  if (!row.to_list?.length) throw new Error("This email has no recipients. Add them in Settings.");
  const nodemailer = await import("nodemailer");
  const tr = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com", port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  try {
    await tr.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: row.to_list, cc: row.cc_list?.length ? row.cc_list : undefined, subject: row.subject, html: row.html, text: row.body });
    await q("update email_outbox set status='sent', sent_at=now(), error=null where id=$1", [id]);
    return "sent";
  } catch (e: any) {
    await q("update email_outbox set status='failed', error=$2 where id=$1", [id, String(e.message).slice(0, 400)]);
    throw e;
  }
}
