import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const reviewFunction = readFileSync(new URL('../supabase/functions/review-application/index.ts', import.meta.url), 'utf8');
const template = readFileSync(new URL('../email-templates/application-rejected.html', import.meta.url), 'utf8');
const setupGuide = readFileSync(new URL('../SUPABASE-APPLICATION-SETUP.md', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../scripts/admin.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const rendererStart = reviewFunction.indexOf('const escapeEmailHtml');
const rendererEnd = reviewFunction.indexOf('\nDeno.serve', rendererStart);
const rendererSource = reviewFunction.slice(rendererStart, rendererEnd)
  .replace(/\}: \{ applicantName: unknown; reason: string; infoUrl: string \}/, '}')
  .replace(/: unknown/g, '')
  .replace(/\[character\]!/, '[character]');
const renderRejectionEmail = Function(`${rendererSource}\nreturn renderRejectionEmail;`)();

test('rejection email renders branded HTML and a plain-text alternative', () => {
  const rendered = renderRejectionEmail({
    applicantName: 'Alex Applicant',
    reason: 'The current team is full.\nPlease apply again next term.',
  });

  assert.equal(rendered.subject, 'Update on your FIS Media Club application');
  assert.match(rendered.html, /Hi Alex,/);
  assert.match(rendered.html, /The current team is full\.<br>Please apply again next term\./);
  assert.match(rendered.html, /https:\/\/fismediaclub\.org\/assets\/fis-logo\.png/);
  assert.match(rendered.html, /font-family:Arial,Helvetica,sans-serif/);
  assert.match(rendered.html, /role="presentation"/);
  assert.match(rendered.text, /Decision details\nThe current team is full\.\nPlease apply again next term\./);
});

test('rejection email escapes reviewer and applicant content before inserting HTML', () => {
  const rendered = renderRejectionEmail({
    applicantName: '<img src=x onerror=alert(1)> Applicant',
    reason: '<script>alert("unsafe")</script> & more',
    infoUrl: 'javascript:alert(1)',
  });

  assert.doesNotMatch(rendered.html, /<script>|<img src=x/);
  assert.match(rendered.html, /&lt;script&gt;alert\(&quot;unsafe&quot;\)&lt;\/script&gt; &amp; more/);
  assert.match(rendered.html, /Hi &lt;img,/);
  assert.doesNotMatch(rendered.html, /javascript:/);
  assert.match(rendered.html, /https:\/\/info\.fismediaclub\.org\//);
});

test('application rejection sends privately through Resend before finalizing the decision', () => {
  assert.match(reviewFunction, /Deno\.env\.get\("RESEND_API_KEY"\)/);
  assert.match(reviewFunction, /to: \[recipientEmail\]/);
  assert.match(reviewFunction, /https:\/\/api\.resend\.com\/emails/);
  assert.match(reviewFunction, /"Idempotency-Key": `application-rejection-\$\{applicationId\}`/);
  assert.match(reviewFunction, /html: rendered\.html/);
  assert.match(reviewFunction, /text: rendered\.text/);
  assert.match(reviewFunction, /emailResponse\.ok/);
  assert.match(reviewFunction, /await releaseApplication\(\);[\s\S]*?Rejection email was not sent/);
  assert.ok(
    reviewFunction.indexOf('await fetch("https://api.resend.com/emails"')
      < reviewFunction.indexOf('status: "rejected"'),
    'Resend must accept the email before the application is marked rejected',
  );
  assert.doesNotMatch(reviewFunction, /\bbcc\s*:/i);
});

test('review UI and setup guide describe automatic rejection email delivery', () => {
  assert.match(indexHtml, /maxlength="1500"/);
  assert.match(indexHtml, /Reject and email applicant/);
  assert.match(adminSource, /Decision email sent to/);
  assert.doesNotMatch(adminSource, /Please email .*the applicant/);

  assert.match(template, /Application update/);
  assert.match(template, /\[Applicant first name\]/);
  assert.match(template, /\[Reviewer-provided rejection reason\]/);
  assert.match(template, /https:\/\/info\.fismediaclub\.org/);
  assert.doesNotMatch(template, /<script|javascript:|tracking/i);

  assert.match(setupGuide, /RESEND_API_KEY/);
  assert.match(setupGuide, /email renderer is included[\s\S]*?inside `index\.ts`/);
  assert.doesNotMatch(reviewFunction, /from "\.\/rejection-email/);
  assert.match(setupGuide, /marked rejected only after Resend accepts the email/);
  assert.doesNotMatch(setupGuide, /reviewer is reminded to email[\s\S]{0,40}manually/i);
});
