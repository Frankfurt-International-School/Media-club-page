const escapeHtml = (value) => String(value || "").replace(/[&<>'"]/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
}[character]));

const firstNameFrom = (name) => String(name || "Applicant").trim().split(/\s+/)[0] || "Applicant";

const publicInfoUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol === "https:") return url.toString();
  } catch (_) {
    // Fall through to the trusted production address.
  }
  return "https://info.fismediaclub.org/";
};

export function renderRejectionEmail({ applicantName, reason, infoUrl = "https://info.fismediaclub.org" }) {
  const firstName = firstNameFrom(applicantName);
  const safeFirstName = escapeHtml(firstName);
  const safeReason = escapeHtml(reason).replace(/\r?\n/g, "<br>");
  const destination = publicInfoUrl(infoUrl);
  const safeInfoUrl = escapeHtml(destination);
  const subject = "Update on your FIS Media Club application";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
  <style>
    @media only screen and (max-width:620px) {
      .email-shell { width:100% !important; max-width:100% !important; table-layout:fixed !important; }
      .email-pad { padding-left:24px !important; padding-right:24px !important; }
      .email-title { font-size:30px !important; line-height:38px !important; overflow-wrap:break-word !important; }
      .email-button { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f1ec;color:#25222c;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Thank you for applying to the FIS Media Club.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f4f1ec;font-family:Arial,Helvetica,sans-serif;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" class="email-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #e4ded5;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(35,24,31,0.08);">
          <tr>
            <td bgcolor="#201923" style="padding:0;background-color:#201923;background-image:linear-gradient(135deg,#201923 0%,#53092a 60%,#a40134 100%);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr><td style="height:6px;background-color:#e0aa4f;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td class="email-pad" style="padding:30px 42px 34px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="82" valign="middle" style="width:82px;">
                          <div style="width:68px;height:68px;border-radius:50%;background-color:#ffffff;border:2px solid rgba(255,255,255,0.7);">
                            <img src="https://fismediaclub.org/assets/fis-logo.png" width="68" height="68" alt="FIS logo" style="display:block;width:68px;height:68px;border:0;border-radius:50%;">
                          </div>
                        </td>
                        <td valign="middle" style="padding-left:16px;">
                          <div style="color:#e8b75f;font-size:12px;font-weight:700;line-height:16px;letter-spacing:2.4px;text-transform:uppercase;">FIS Media Club</div>
                          <div style="margin-top:5px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:27px;font-weight:700;line-height:32px;letter-spacing:0.2px;">Crew Center</div>
                          <div style="margin-top:5px;color:#e7dfe5;font-size:13px;line-height:18px;">Create · Cover · Collaborate</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:42px 42px 18px;">
              <div style="display:inline-block;padding:7px 11px;border-radius:999px;background-color:#f8e9ee;color:#8d062e;font-size:11px;font-weight:700;line-height:14px;letter-spacing:1.4px;text-transform:uppercase;">Application update</div>
              <h1 class="email-title" style="margin:18px 0 14px;color:#201923;font-family:Arial,Helvetica,sans-serif;font-size:38px;font-weight:700;line-height:46px;letter-spacing:-0.4px;overflow-wrap:break-word;">Thank you for applying.</h1>
              <p style="margin:0;color:#57505b;font-size:17px;line-height:27px;">Hi ${safeFirstName},</p>
              <p style="margin:16px 0 0;color:#57505b;font-size:16px;line-height:26px;">Thank you for your interest in the FIS Media Club and for the time you put into your application. After reviewing it, we are unable to offer you a place in the club at this time.</p>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:12px 42px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8f6f2;border-left:4px solid #e0aa4f;border-radius:8px;">
                <tr>
                  <td style="padding:17px 19px;color:#625a64;font-size:14px;line-height:22px;overflow-wrap:anywhere;"><strong style="display:block;margin-bottom:6px;color:#302936;">Decision details</strong>${safeReason}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:0 42px 18px;">
              <p style="margin:0;color:#57505b;font-size:15px;line-height:24px;">We appreciate your interest and encourage you to keep developing your media skills. If you need clarification about this decision, please speak with a Media Club faculty supervisor.</p>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:10px 42px 38px;">
              <a class="email-button" href="${safeInfoUrl}" style="display:inline-block;padding:14px 22px;border-radius:10px;background-color:#a40134;color:#ffffff;font-size:15px;font-weight:700;line-height:20px;text-decoration:none;box-shadow:0 6px 16px rgba(164,1,52,0.22);">Visit the Media Club website&nbsp;&nbsp;→</a>
            </td>
          </tr>
          <tr>
            <td style="padding:23px 42px;background-color:#201923;color:#cfc5cc;font-size:12px;line-height:18px;text-align:center;">
              FIS Media Club Crew Center<br>
              <a href="${safeInfoUrl}" style="color:#e8b75f;text-decoration:none;">info.fismediaclub.org</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text = `Thank you for applying\n\nHi ${firstName},\n\nThank you for your interest in the FIS Media Club and for the time you put into your application. After reviewing it, we are unable to offer you a place in the club at this time.\n\nDecision details\n${String(reason || "").trim()}\n\nWe appreciate your interest and encourage you to keep developing your media skills. If you need clarification about this decision, please speak with a Media Club faculty supervisor.\n\n${destination}`;

  return { subject, html, text };
}
