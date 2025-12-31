import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.FROM_EMAIL || "Burn Rate Calendar <noreply@burnrate.app>";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

/**
 * Send email verification email for registration
 */
export async function sendVerificationEmail(
  email: string,
  verificationToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.error("Resend API key not configured");
    return { success: false, error: "Email service not configured" };
  }

  const verifyUrl = `${APP_URL}/verify-email?token=${verificationToken}`;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Підтвердіть email - Burn Rate Calendar",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="font-size: 32px;">&#128293;</span>
                <h1 style="margin: 8px 0 0; color: #333; font-size: 24px;">Burn Rate Calendar</h1>
              </div>

              <h2 style="color: #333; font-size: 20px; margin-bottom: 16px;">Підтвердіть вашу електронну пошту</h2>

              <p style="color: #666; line-height: 1.6; margin-bottom: 24px;">
                Дякуємо за реєстрацію! Натисніть кнопку нижче, щоб підтвердити вашу електронну адресу
                та активувати ваш акаунт.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${verifyUrl}"
                   style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600;">
                  Підтвердити email
                </a>
              </div>

              <p style="color: #999; font-size: 14px; line-height: 1.6;">
                Або скопіюйте це посилання в браузер:<br>
                <a href="${verifyUrl}" style="color: #10b981; word-break: break-all;">${verifyUrl}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">

              <p style="color: #999; font-size: 12px; line-height: 1.6;">
                Це посилання дійсне протягом 24 годин. Якщо ви не реєструвалися в Burn Rate Calendar,
                проігноруйте цей лист.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: "Failed to send email" };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.error("Resend API key not configured");
    return { success: false, error: "Email service not configured" };
  }

  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Скидання пароля - Burn Rate Calendar",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="font-size: 32px;">&#128293;</span>
                <h1 style="margin: 8px 0 0; color: #333; font-size: 24px;">Burn Rate Calendar</h1>
              </div>

              <h2 style="color: #333; font-size: 20px; margin-bottom: 16px;">Скидання пароля</h2>

              <p style="color: #666; line-height: 1.6; margin-bottom: 24px;">
                Ви отримали цей лист, тому що запросили скидання пароля для вашого акаунту.
                Натисніть кнопку нижче, щоб встановити новий пароль.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}"
                   style="display: inline-block; background-color: #f97316; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600;">
                  Скинути пароль
                </a>
              </div>

              <p style="color: #999; font-size: 14px; line-height: 1.6;">
                Або скопіюйте це посилання в браузер:<br>
                <a href="${resetUrl}" style="color: #f97316; word-break: break-all;">${resetUrl}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">

              <p style="color: #999; font-size: 12px; line-height: 1.6;">
                Це посилання дійсне протягом 1 години. Якщо ви не запитували скидання пароля,
                проігноруйте цей лист.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: "Failed to send email" };
  }
}
