# Supabase Auth Email Setup

This project now expects a public site URL instead of `localhost` for auth emails.

## 1. Set your public site URL

In Supabase Dashboard:

- Authentication -> URL Configuration

Set:

- Site URL:
  `https://YOUR_PUBLIC_DOMAIN`

Add Redirect URLs:

- `https://YOUR_PUBLIC_DOMAIN/auth/callback`

If you use a public preview or staging URL, add those exact URLs too.

Examples:

- `https://staging.yourdomain.com/auth/callback`
- `https://your-tunnel-url.ngrok.app/auth/callback`

## 2. Enable email auth

In Supabase Dashboard:

- Authentication -> Sign In / Providers -> Email

Enable the email provider and enable sign-ups if you want users to create accounts.

## 2a. Keep OTP length aligned

This storefront is currently configured for Supabase email auth through the Next.js React app and Supabase server/client helpers.

- Frontend expectation: `8` digits
- If your Supabase project is configured to send a different OTP length, update the frontend config to match

If your project sends 8-digit codes today, keep the backend and frontend aligned at 8.

## 3. Configure branded sending

To replace the default `Supabase Auth` sender and fully brand the emails, configure custom SMTP:

- Authentication -> SMTP Settings

Recommended values:

- Sender name: `Vione Hernal`
- From email: `no-reply@YOUR_PUBLIC_DOMAIN`

## 4. Update email templates

In Supabase Dashboard:

- Authentication -> Email Templates

Use the files in:

- [supabase/email-templates/confirm-signup.html](../supabase/email-templates/confirm-signup.html)
- [supabase/email-templates/magic-link.html](../supabase/email-templates/magic-link.html)
- [supabase/email-templates/reset-password.html](../supabase/email-templates/reset-password.html)
- [supabase/email-templates/invite-user.html](../supabase/email-templates/invite-user.html)
- [supabase/email-templates/change-email.html](../supabase/email-templates/change-email.html)

Suggested subjects:

- Confirm signup: `Confirm Your Account`
- Magic link: `Your Vione Hernal sign-in link`
- Reset password: `Reset Your Password`
- Invite user: `Your Vione Hernal invitation`
- Change email address: `Confirm Your New Email`

## 5. Production note

If `PUBLIC_SITE_URL` is not set in the app and the site is opened on `localhost`, the frontend now avoids injecting `localhost` into the email redirect. The branded templates in this repo use your Supabase Site URL, so the Site URL in the dashboard must be correct.
