[#ftl/]
[#-- @ftlvariable name="application" type="io.fusionauth.domain.Application" --]
[#-- @ftlvariable name="collectBirthDate" type="boolean" --]
[#-- @ftlvariable name="hideBirthDate" type="boolean" --]
[#-- @ftlvariable name="passwordValidationRules" type="io.fusionauth.domain.PasswordValidationRules" --]
[#-- @ftlvariable name="parentEmailRequired" type="boolean" --]

[#import "../_helpers.ftl" as helpers/]

[@helpers.html]
  [@helpers.head]
    [#-- Custom <head> code goes here --]
  [/@helpers.head]
  [@helpers.body]
    [@helpers.header]
      [#-- Custom header code goes here --]
    [/@helpers.header]

    [@helpers.main title=theme.message('register')]
      <form action="register" method="POST" class="full">
        [@helpers.oauthHiddenFields/]
        [@helpers.hidden name="collectBirthDate"/]
        [@helpers.hidden name="parentEmailRequired"/]
        [#if !collectBirthDate && (!application.registrationConfiguration.birthDate.enabled || hideBirthDate)]
          [@helpers.hidden name="user.birthDate" dateTimeFormat="yyyy-MM-dd"/]
        [/#if]

        [#-- Show the Password Validation Rules if there is a field error for 'user.password' --]
        [#if (fieldMessages?keys?seq_contains("user.password")!false) && passwordValidationRules??]
          [@helpers.passwordRules passwordValidationRules/]
        [/#if]

        <fieldset>
          [#if collectBirthDate]
            [@helpers.input type="text" name="user.birthDate" id="birthDate" placeholder=theme.message('birthDate') leftAddon="calendar" class="date-picker" dateTimeFormat="yyyy-MM-dd" required=true/]
          [#else]
            [#if application.registrationConfiguration.loginIdType == 'email']
              [@helpers.input label=theme.message('email') type="text" name="user.email" id="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" autofocus=true placeholder=theme.message('email') leftAddon="user" required=true/]
            [#else]
              [@helpers.input label=theme.message('username') type="text" name="user.username" id="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" autofocus=true placeholder=theme.message('username') leftAddon="user" required=true/]
            [/#if]
            [@helpers.input label=theme.message('password') type="password" name="user.password" id="password" autocomplete="new-password" placeholder=theme.message('password') leftAddon="lock" required=true/]
            [#if application.registrationConfiguration.confirmPassword]
              [@helpers.input label=theme.message('passwordConfirm') type="password" name="passwordConfirm" id="passwordConfirm" autocomplete="new-password" placeholder=theme.message('passwordConfirm') leftAddon="lock" required=true/]
            [/#if]
            [#if parentEmailRequired]
              [@helpers.input label=theme.message('parentEmail') type="text" name="user.parentEmail" id="parentEmail" placeholder=theme.message('parentEmail') leftAddon="user" required=true/]
            [/#if]
            [#if application.registrationConfiguration.birthDate.enabled ||
            application.registrationConfiguration.firstName.enabled    ||
            application.registrationConfiguration.fullName.enabled     ||
            application.registrationConfiguration.middleName.enabled   ||
            application.registrationConfiguration.lastName.enabled     ||
            application.registrationConfiguration.mobilePhone.enabled   ]
              <div class="mt-5 mb-5"></div>
              [#if application.registrationConfiguration.firstName.enabled]
                  [@helpers.input label=theme.message('firstName') type="text" name="user.firstName" id="firstName" placeholder=theme.message('firstName') leftAddon="user" required=application.registrationConfiguration.firstName.required/]
              [/#if]
              [#if application.registrationConfiguration.fullName.enabled]
                  [@helpers.input label=theme.message('fullName') type="text" name="user.fullName" id="fullName" placeholder=theme.message('fullName') leftAddon="user" required=application.registrationConfiguration.fullName.required/]
              [/#if]
              [#if application.registrationConfiguration.middleName.enabled]
                  [@helpers.input label=theme.message('middleName') type="text" name="user.middleName" id="middleName" placeholder=theme.message('middleName') leftAddon="user" required=application.registrationConfiguration.middleName.required/]
              [/#if]
              [#if application.registrationConfiguration.lastName.enabled]
                  [@helpers.input label=theme.message('lastName') type="text" name="user.lastName" id="lastName" placeholder=theme.message('lastName') leftAddon="user" required=application.registrationConfiguration.lastName.required/]
              [/#if]
              [#if application.registrationConfiguration.birthDate.enabled]
                  [@helpers.input label=theme.message('birthDate') type="text" name="user.birthDate" id="birthDate" placeholder=theme.message('birthDate') leftAddon="calendar" class="date-picker" dateTimeFormat="yyyy-MM-dd" required=application.registrationConfiguration.birthDate.required/]
              [/#if]
              [#if application.registrationConfiguration.mobilePhone.enabled]
                  [@helpers.input label=theme.message('mobilePhone') type="text" name="user.mobilePhone" id="mobilePhone" placeholder=theme.message('mobilePhone') leftAddon="phone" required=application.registrationConfiguration.mobilePhone.required/]
              [/#if]
            [/#if]
          [/#if]
        </fieldset>

        [@helpers.button class="slds-button_brand slds-button_stretch" text=theme.message('register')/]

        <hr />
        <div>
          [@helpers.link url="/password/forgot"]${theme.message('forgot-your-password')}[/@helpers.link]
        </div>
        <div>
          ${theme.message('already-have-an-account')}
          [@helpers.link url="/oauth2/authorize"]${theme.message('return-to-login')}[/@helpers.link]
        </div>
      </form>
    [/@helpers.main]

    [@helpers.footer]
      [#-- Custom footer code goes here --]
    [/@helpers.footer]
  [/@helpers.body]
[/@helpers.html]