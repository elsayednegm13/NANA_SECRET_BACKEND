# Contact form email via Resend

The frontend sends JSON to the configured backend's `POST /api/contact`. Only the backend calls Resend; never put its API key in frontend files.

Set these variables in the backend host environment or `backend/.env`:

```dotenv
RESEND_API_KEY=your_resend_api_key
CONTACT_TO=recipient@example.com
RESEND_FROM="NANA SECRET Website <info@your-verified-domain.com>"
```

Verify the sending domain in Resend before using your own sender. The default `NANA SECRET Website <onboarding@resend.dev>` is for testing and is subject to Resend's recipient restrictions; it is not an unrestricted production sender.

Also configure:

- `frontend/assets/js/config.js`: public API origin.
- Backend `FRONTEND_ORIGINS`: actual frontend origin, including scheme and port when relevant.
- HTTPS on both applications in production.

Restart the backend after changing environment variables. Without a valid API key and sender setup, the website can run but contact email submission will fail.

Contact submissions share the visitor's name, phone, email and message with Resend and the recipient. Apply an appropriate privacy policy, sending limits and account billing controls. Integration tests do not send real emails or incur Resend charges.

See [README-AR.md](README-AR.md) for setup and [the analysis](docs/PROJECT-ANALYSIS.md) for remaining security work.
