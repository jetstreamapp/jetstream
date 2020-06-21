[#ftl/]
[#import "../_helpers.ftl" as helpers/]

[@helpers.html]
  [@helpers.head]
    [#-- Custom <head> code goes here --]
  [/@helpers.head]
  [@helpers.body]
    [@helpers.header]
      [#-- Custom header code goes here --]
    [/@helpers.header]

    [@helpers.main title=theme.message('forgot-password-email-sent-title')]
      <p>
        ${theme.message('forgot-password-email-sent')}
      </p>
      <hr />
      [@helpers.link url="/oauth2/authorize"]${theme.message('return-to-login')}[/@helpers.link]
    [/@helpers.main]

    [@helpers.footer]
      [#-- Custom footer code goes here --]
    [/@helpers.footer]
  [/@helpers.body]
[/@helpers.html]