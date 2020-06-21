[#ftl/]
[#-- @ftlvariable name="passwordValidationRules" type="io.fusionauth.domain.PasswordValidationRules" --]

[#import "../_helpers.ftl" as helpers/]

[@helpers.html]
  [@helpers.head]
    [#-- Custom <head> code goes here --]
  [/@helpers.head]
  [@helpers.body]
    [@helpers.header]
      [#-- Custom header code goes here --]
    [/@helpers.header]

    [@helpers.main title=theme.message('password-change-title')]
      <form action="change" method="POST" class="full">
        [@helpers.oauthHiddenFields/]
        [@helpers.hidden name="changePasswordId"/]

        [#-- Show the Password Validation Rules if there is a field error for 'password' --]
        [#if (fieldMessages?keys?seq_contains("password")!false) && passwordValidationRules??]
          [@helpers.passwordRules passwordValidationRules/]
        [/#if]
        <fieldset>
          [@helpers.input type="password" name="password" autocomplete="new-password" id="password" placeholder=theme.message('password') leftAddon="lock" autofocus=true required=true/]
          [@helpers.input type="password" name="passwordConfirm" autocomplete="new-password" id="passwordConfirm" placeholder=theme.message('passwordConfirm') leftAddon="lock" required=true/]
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