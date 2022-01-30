const FRAGMENTS = {
  ACCOUNT_DEACTIVATION_WARNING: `
  <p class="sm-leading-32" style="margin: 0; margin-bottom: 24px; font-size: 24px; font-weight: 600; color: #000000;">We haven't seen you login to Jetstream recently.</p>
  <p style="margin: 0; margin-bottom: 24px;">
    If you do not login to Jetstream in the next 30 days, your account and all of your data will be deleted.
    If you want to continue using Jetstream, login to your account within the next 30 days.
  </p>
`,
};

export const TEXT_EMAIL_CONTENT: typeof FRAGMENTS = {
  ACCOUNT_DEACTIVATION_WARNING: `
  We haven't seen you login to Jetstream recently.

  If you do not login to Jetstream in the next 30 days, your account and all of your data will be deleted.
  If you want to continue using Jetstream, login to your account within the next 30 days.
`,
};

export function getTemplate(title: string, previewText: string, fragment: keyof typeof FRAGMENTS) {
  return `<!DOCTYPE html>
  <html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
    <head>
      <meta charset="utf-8" />
      <meta name="x-apple-disable-message-reformatting" />
      <meta http-equiv="x-ua-compatible" content="ie=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta
        name="format-detection"
        content="telephone=no, date=no, address=no, email=no"
      />
      <!--[if mso]>
        <noscript>
          <xml>
            <o:OfficeDocumentSettings
              xmlns:o="urn:schemas-microsoft-com:office:office"
            >
              <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
          </xml>
        </noscript>
        <style>
          td,
          th,
          div,
          p,
          a,
          h1,
          h2,
          h3,
          h4,
          h5,
          h6 {
            font-family: "Segoe UI", sans-serif;
            mso-line-height-rule: exactly;
          }
        </style>
      <![endif]-->
      <title>${title}</title>
      <style>
        .hover-bg-blue-600:hover {
          background-color: #0b5cab !important;
        }
        .hover-underline:hover {
          text-decoration: underline !important;
        }
        @media (max-width: 600px) {
          .sm-w-full {
            width: 100% !important;
          }
          .sm-py-32 {
            padding-top: 32px !important;
            padding-bottom: 32px !important;
          }
          .sm-px-24 {
            padding-left: 24px !important;
            padding-right: 24px !important;
          }
          .sm-leading-32 {
            line-height: 32px !important;
          }
        }
      </style>
    </head>
    <body
      style="
        margin: 0;
        width: 100%;
        padding: 0;
        word-break: break-word;
        -webkit-font-smoothing: antialiased;
        background-color: #f3f4f6;
      "
    >
      <div style="display: none">
        ${previewText}&#847; &#847;
        &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
        &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
        &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
        &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
        &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
        &#847; &#847; &#847; &#847; &zwnj; &#160;&#847; &#847; &#847; &#847;
        &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
        &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
        &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
        &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
        &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
        &#847; &#847; &#847; &zwnj; &#160;&#847; &#847; &#847; &#847; &#847;
      </div>
      <div
        role="article"
        aria-roledescription="email"
        aria-label="${title}"
        lang="en"
      >
        <table
          style="
            width: 100%;
            font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI',
              sans-serif;
          "
          cellpadding="0"
          cellspacing="0"
          role="presentation"
        >
          <tr>
            <td align="center" style="background-color: #f3f4f6">
              <table
                class="sm-w-full"
                style="width: 600px"
                cellpadding="0"
                cellspacing="0"
                role="presentation"
              >
                <tr>
                  <td
                    class="sm-py-32 sm-px-24"
                    style="padding: 48px; text-align: center"
                  >
                    <a href="https://getjetstream.app">
                      <img
                        src="https://res.cloudinary.com/getjetstream/image/upload/c_scale,w_300/v1634490317/public/email/jetstream-logo-1200w.png"
                        width="300"
                        alt="Jetstream"
                        style="
                          max-width: 100%;
                          vertical-align: middle;
                          line-height: 100%;
                          border: 0;
                        "
                      />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" class="sm-px-24">
                    <table
                      style="width: 100%"
                      cellpadding="0"
                      cellspacing="0"
                      role="presentation"
                    >
                      <tr>
                        <td class="sm-px-24" style="border-radius: 4px; background-color: #ffffff; padding: 48px; text-align: left; font-size: 16px; line-height: 24px; color: #1f2937;">
                          ${FRAGMENTS[fragment]}
                          <table style="width: 100%;" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td style="padding-top: 32px; padding-bottom: 32px;">
                                <div style="height: 1px; background-color: #e5e7eb; line-height: 1px;">&zwnj;</div>
                              </td>
                            </tr>
                          </table>
                          <p style="margin: 0; margin-bottom: 16px;">
                            Thanks,
                            <br>
                            The Jetstream Team
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="height: 48px"></td>
                      </tr>
                      <tr>
                        <td
                          style="
                            padding-left: 24px;
                            padding-right: 24px;
                            text-align: center;
                            font-size: 12px;
                            color: #4b5563;
                          "
                        >
                          <p style="margin-bottom: 24px; cursor: default">
                            <a
                              href="https://getjetstream.app"
                              class="hover-underline"
                              style="color: #0176d3; text-decoration: none"
                            >
                              Jetstream
                            </a>
                            &bull;
                            <a
                              href="https://docs.getjetstream.app"
                              class="hover-underline"
                              style="color: #0176d3; text-decoration: none"
                            >
                              Documentation
                            </a>
                            &bull;
                            <a
                              href="mailto:support@getjetstream.app"
                              class="hover-underline"
                              style="color: #0176d3; text-decoration: none"
                            >
                              Contact Us
                            </a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    </body>
  </html>`;
}
