interface EmailAddress {
  email: string;
  name?: string;
}

interface SendEmailMessage {
  to: string | string[];
  from: EmailAddress;
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
}

interface Env {
  ASSETS: Fetcher;
  EMAIL: {
    send(message: SendEmailMessage): Promise<{ messageId?: string }>;
  };
}

const ACQUISITION_EMAIL = 'sales@desertrich.com';
const INQUIRY_FROM_EMAIL = 'inquiries@icra.builders';
const INQUIRY_FROM_NAME = 'icra.builders Inquiry';

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const rateHits = new Map<string, number[]>();

function isAssetPath(pathname: string): boolean {
  return /\.\w{2,8}$/i.test(pathname);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const hits = (rateHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    rateHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  rateHits.set(ip, hits);
  if (rateHits.size > 5000) rateHits.clear();
  return true;
}

async function handleInquire(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return json({ error: 'Unsupported media type' }, 415);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const str = (key: string, max: number): string =>
    String(body[key] ?? '')
      .trim()
      .slice(0, max);

  const name = str('name', 120);
  const company = str('company', 160);
  const email = str('email', 200);
  const phone = str('phone', 40);
  const message = str('message', 4000);
  const honeypot = str('website', 200);

  if (honeypot) {
    return json({ ok: true });
  }

  if (!name || !email || !message) {
    return json({ error: 'Name, email, and message are required.' }, 400);
  }
  if (!isValidEmail(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }
  if (name.length < 2) {
    return json({ error: 'Please enter your full name.' }, 400);
  }
  if (message.length < 10) {
    return json({ error: 'Please tell us a bit more about your interest.' }, 400);
  }

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!allowRequest(ip)) {
    return json({ error: 'Too many requests. Please try again shortly.' }, 429);
  }

  const subject = `icra.builders inquiry — ${name}${company ? ` (${company})` : ''}`;
  const referer = request.headers.get('referer') ?? '—';
  const userAgent = request.headers.get('user-agent') ?? '—';

  const text = [
    'New acquisition inquiry for icra.builders',
    '',
    `Name: ${name}`,
    `Company: ${company || '—'}`,
    `Email: ${email}`,
    `Phone: ${phone || '—'}`,
    '',
    'Message:',
    message,
    '',
    '---',
    `IP: ${ip}`,
    `Referrer: ${referer}`,
    `User-Agent: ${userAgent}`,
  ].join('\n');

  const html = `
<!doctype html>
<html>
  <body style="font-family: Georgia, serif; color: #0f172a; line-height: 1.55;">
    <h2 style="margin: 0 0 4px; font-size: 20px;">New acquisition inquiry — icra.builders</h2>
    <p style="margin: 0 0 20px; color: #64748b; font-size: 13px;">Received from icra.builders inquiry form</p>
    <table style="border-collapse: collapse; width: 100%; max-width: 560px; font-size: 14px;">
      <tr><td style="padding: 6px 12px 6px 0; color: #64748b; width: 110px;">Name</td><td style="padding: 6px 0;">${escapeHtml(name)}</td></tr>
      <tr><td style="padding: 6px 12px 6px 0; color: #64748b;">Company</td><td style="padding: 6px 0;">${escapeHtml(company || '—')}</td></tr>
      <tr><td style="padding: 6px 12px 6px 0; color: #64748b;">Email</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
      <tr><td style="padding: 6px 12px 6px 0; color: #64748b;">Phone</td><td style="padding: 6px 0;">${escapeHtml(phone || '—')}</td></tr>
    </table>
    <h3 style="margin: 24px 0 8px; font-size: 15px;">Message</h3>
    <p style="margin: 0; white-space: pre-wrap; font-size: 14px;">${escapeHtml(message)}</p>
    <hr style="margin: 24px 0 12px; border: none; border-top: 1px solid #e2e8f0;" />
    <p style="margin: 0; color: #94a3b8; font-size: 12px;">
      IP: ${escapeHtml(ip)}<br/>
      Referrer: ${escapeHtml(referer)}<br/>
      User-Agent: ${escapeHtml(userAgent)}
    </p>
  </body>
</html>`.trim();

  try {
    await env.EMAIL.send({
      to: ACQUISITION_EMAIL,
      from: { email: INQUIRY_FROM_EMAIL, name: INQUIRY_FROM_NAME },
      replyTo: email,
      subject,
      html,
      text,
    });
    return json({ ok: true });
  } catch (error) {
    const err = error as { code?: string; message?: string };
    console.error('Inquiry email failed:', err.code, err.message);
    return json(
      { error: 'We could not send your inquiry right now. Please email us directly.' },
      502,
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/inquire') {
      return handleInquire(request, env);
    }

    let redirect = false;

    if (url.hostname === 'www.icra.builders') {
      url.hostname = 'icra.builders';
      redirect = true;
    }

    if (
      !url.pathname.startsWith('/api/') &&
      !url.pathname.endsWith('/') &&
      !isAssetPath(url.pathname)
    ) {
      url.pathname = url.pathname + '/';
      redirect = true;
    }

    if (redirect) {
      return Response.redirect(url.toString(), 301);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
