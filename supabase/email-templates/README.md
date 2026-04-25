# Supabase Auth Email Templates

These files are the branded source of truth for the customer-facing auth emails used by Vione Hernal.

Paste each file into Supabase Dashboard -> Authentication -> Email Templates:

- `confirm-signup.html` -> `Confirm signup`
- `magic-link.html` -> `Magic Link`
- `reset-password.html` -> `Reset Password`
- `invite-user.html` -> `Invite user`
- `change-email.html` -> `Change Email Address`

Suggested subjects:

- `Confirm signup` -> `Confirm Your Account`
- `Magic Link` -> `Your Vione Hernal Sign-In Link`
- `Reset Password` -> `Reset Your Password`
- `Invite user` -> `Your Vione Hernal Invitation`
- `Change Email Address` -> `Confirm Your New Email`

These templates intentionally route through the branded website callback instead of sending customers to a raw Supabase URL:

- `{{ .SiteURL }}/auth/callback?...`

Keep Supabase URL Configuration aligned with your live domain so these branded links resolve correctly.
