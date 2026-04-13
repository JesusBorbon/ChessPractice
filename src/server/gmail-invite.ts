import nodemailer from "nodemailer";

export type OfflineFriendInviteEmailInput = {
  toEmail: string;
  inviterName: string;
  roomId: string;
  shareUrl: string;
};

const EMAIL_SMTP_USER = process.env.GMAIL_SMTP_USER?.trim() ?? "";
const EMAIL_SMTP_PASS = process.env.GMAIL_SMTP_PASS?.trim() ?? "";
const EMAIL_FROM = process.env.GMAIL_SMTP_FROM?.trim() || EMAIL_SMTP_USER;

const friendInviteMailer = EMAIL_SMTP_USER && EMAIL_SMTP_PASS
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: EMAIL_SMTP_USER,
        pass: EMAIL_SMTP_PASS,
      },
    })
  : null;

export function canSendFriendInviteEmail(): boolean {
  return Boolean(friendInviteMailer && EMAIL_FROM);
}

export function getGmailInviteConfigErrorMessage(): string {
  const missingKeys: string[] = [];
  if (!EMAIL_SMTP_USER) {
    missingKeys.push("GMAIL_SMTP_USER");
  }
  if (!EMAIL_SMTP_PASS) {
    missingKeys.push("GMAIL_SMTP_PASS");
  }

  if (missingKeys.length === 0) {
    return "Gmail invites are not configured on the server.";
  }

  return `Gmail invites are not configured on the server (missing ${missingKeys.join(" / ")}).`;
}

export async function sendOfflineFriendInviteEmail(input: OfflineFriendInviteEmailInput): Promise<void> {
  if (!friendInviteMailer || !EMAIL_FROM) {
    throw new Error("Friend invite email transport is not configured.");
  }

  const subject = `${input.inviterName} invited you to a ChessPractice room`;
  const text = [
    `${input.inviterName} invited you to join room ${input.roomId}.`,
    "",
    `Accept invitation: ${input.shareUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.45;color:#1e2b24;max-width:560px;margin:0 auto;">
      <h2 style="margin:0 0 12px;">You have a chess invitation</h2>
      <p style="margin:0 0 14px;"><strong>${input.inviterName}</strong> invited you to room <strong>${input.roomId}</strong>.</p>
      <p style="margin:0 0 20px;">Tap accept to open the app and join the correct room automatically.</p>
      <a href="${input.shareUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#1f7a53;color:#ffffff;text-decoration:none;font-weight:700;">Accept invitation</a>
    </div>
  `;

  await friendInviteMailer.sendMail({
    from: EMAIL_FROM,
    to: input.toEmail,
    subject,
    text,
    html,
  });
}
