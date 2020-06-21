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

    [@helpers.main title=theme.message('forgot-password-title')]
      <form action="forgot" method="POST" class="full">
        [@helpers.oauthHiddenFields/]

        <fieldset>
          [@helpers.input type="text" name="email" id="email" label=theme.message('forgot-password') autocapitalize="none" autofocus=true autocomplete="on" autocorrect="off" placeholder=theme.message('email') leftAddon="user" required=true/]
        </fieldset>
        [@helpers.button class="slds-button_brand slds-button_stretch" text=theme.message('submit')/]
      </form>
      <hr />
      [@helpers.link url="/oauth2/authorize"]${theme.message('return-to-login')}[/@helpers.link]
    [/@helpers.main]

    [@helpers.footer]
      [#-- Custom footer code goes here --]
    [/@helpers.footer]
  [/@helpers.body]
[/@helpers.html]