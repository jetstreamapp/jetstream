@IsTest
private class UserPreferencesTest {
  @IsTest
  static void testCreateAndReadUserPreferences() {
    UserPreferences__c prefs = UserPreferences__c.getInstance(UserInfo.getUserId());
    if (prefs == null || prefs.Id == null) {
      prefs = new UserPreferences__c(
        SetupOwnerId = UserInfo.getUserId(),
        SkipFrontdoorLogin__c = true,
        RecordSyncEnabled__c = false,
        NumIndent__c = 2,
        FieldMaxLineLength__c = 1,
        SubqueryParensOnOwnLine__c = true,
        WhereClauseOpsIndented__c = true,
        NewLineAfterKeywords__c = false
      );
      insert prefs;
    }

    UserPreferences__c fetched = UserPreferences__c.getInstance(UserInfo.getUserId());
    System.assertNotEquals(null, fetched, 'Custom setting record should exist');
    System.assertEquals(2, fetched.NumIndent__c, 'NumIndent should be 2');
    System.assertEquals(true, fetched.SkipFrontdoorLogin__c, 'SkipFrontdoorLogin should be true');
    System.assertEquals(true, fetched.SubqueryParensOnOwnLine__c, 'SubqueryParensOnOwnLine should be true');
  }

  @IsTest
  static void testOrgDefaultFallback() {
    UserPreferences__c prefs = UserPreferences__c.getOrgDefaults();
    System.assertNotEquals(null, prefs, 'getOrgDefaults should return a non-null instance');
  }
}
