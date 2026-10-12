@IsTest
private class JetstreamPageControllerTest {
  // Verifies default behavior with no Lightning tab parameter present (full screen expected)
  @IsTest
  static void testGetCanvasParameters_defaultFullScreen() {
    // Arrange
    PageReference pr = Page.JetstreamPage;
    System.assertNotEquals(null, pr, 'Expected Visualforce page JetstreamPage to be available.');
    Test.setCurrentPage(pr);

    // Act
    Map<String, Object> result = getCanvasParameters();

    // Assert
    System.assertEquals(true, result.get('isFullScreen'), 'When no sfdc.tabName param is present, isFullScreen should be true');
  }

  // Verifies behavior when the VF page is embedded in a Lightning tab/layout (non-full screen)
  @IsTest
  static void testGetCanvasParameters_embeddedNotFullScreen() {
    // Arrange
    PageReference pr = Page.JetstreamPage;
    System.assertNotEquals(null, pr, 'Expected Visualforce page JetstreamPage to be available.');
    Test.setCurrentPage(pr);
    ApexPages.currentPage().getParameters().put('sfdc.tabName', 'standard__navItemPage');

    // Act
    Map<String, Object> result = getCanvasParameters();

    // Assert
    System.assertEquals(false, result.get('isFullScreen'), 'When sfdc.tabName param is present, isFullScreen should be false');
  }

  // Verifies that blank/whitespace sfdc.tabName is treated as not present (full screen)
  @IsTest
  static void testGetCanvasParameters_blankParamIsIgnored() {
    // Arrange
    PageReference pr = Page.JetstreamPage;
    System.assertNotEquals(null, pr, 'Expected Visualforce page JetstreamPage to be available.');
    Test.setCurrentPage(pr);
    // put a blank value which String.isNotBlank should treat as falsey
    ApexPages.currentPage().getParameters().put('sfdc.tabName', '   ');

    // Act
    Map<String, Object> result = getCanvasParameters();

    // Assert
    System.assertEquals(true, result.get('isFullScreen'), 'Blank sfdc.tabName should not affect fullscreen detection');
  }

  // Users without Limited Access keep full access, so the canvas app receives a null access profile
  @IsTest
  static void testGetCanvasParameters_fullAccessWithoutLimitedAccess() {
    User testUser = createUserWithCustomPermissions(new List<String>{ 'Tool_Query', 'Action_Records_Write' });

    System.runAs(testUser) {
      Test.setCurrentPage(Page.JetstreamPage);

      Map<String, Object> result = getCanvasParameters();

      System.assert(
        result.containsKey('accessProfile'),
        'accessProfile should always be sent so the canvas app can tell it apart from an older package'
      );
      System.assertEquals(null, result.get('accessProfile'), 'Tool permissions without Limited Access should not restrict the user');
    }
  }

  // Users with Limited Access only receive the tools and actions they also hold a custom permission for
  @IsTest
  static void testGetCanvasParameters_limitedAccessOnlyIncludesGrantedPermissions() {
    User testUser = createUserWithCustomPermissions(
      new List<String>{ 'Limited_Access', 'Tool_Query', 'Tool_Data_Analysis', 'Action_Records_Export' }
    );

    System.runAs(testUser) {
      Test.setCurrentPage(Page.JetstreamPage);

      Map<String, Object> result = getCanvasParameters();
      Map<String, Object> accessProfile = (Map<String, Object>) result.get('accessProfile');

      System.assertNotEquals(null, accessProfile, 'Limited Access should send an access profile');
      System.assertEquals(new Set<String>{ 'query', 'data-analysis' }, toStringSet(accessProfile.get('tools')), 'Unexpected tools');
      System.assertEquals(new Set<String>{ 'records.export' }, toStringSet(accessProfile.get('operations')), 'Unexpected operations');
    }
  }

  // Limited Access on its own grants nothing
  @IsTest
  static void testGetCanvasParameters_limitedAccessWithoutOtherPermissions() {
    User testUser = createUserWithCustomPermissions(new List<String>{ 'Limited_Access' });

    System.runAs(testUser) {
      Test.setCurrentPage(Page.JetstreamPage);

      Map<String, Object> accessProfile = (Map<String, Object>) getCanvasParameters().get('accessProfile');

      System.assertNotEquals(null, accessProfile, 'Limited Access should send an access profile');
      System.assertEquals(new Set<String>(), toStringSet(accessProfile.get('tools')), 'No tools should be granted');
      System.assertEquals(new Set<String>(), toStringSet(accessProfile.get('operations')), 'No operations should be granted');
    }
  }

  // Catches a typo in the key => custom permission maps, which would otherwise silently hide a tool
  @IsTest
  static void testPermissionMappings_matchPackagedCustomPermissions() {
    Set<String> expectedNames = new Set<String>{ JetstreamPageController.LIMITED_ACCESS_PERMISSION };
    expectedNames.addAll(JetstreamPageController.TOOL_PERMISSIONS.values());
    expectedNames.addAll(JetstreamPageController.OPERATION_PERMISSIONS.values());

    Set<String> foundNames = new Set<String>();
    for (CustomPermission customPermission : queryCustomPermissions(expectedNames)) {
      foundNames.add(customPermission.DeveloperName);
    }

    System.assertEquals(expectedNames, foundNames, 'Every mapped custom permission should exist in the package');
  }

  private static Map<String, Object> getCanvasParameters() {
    JetstreamPageController ctrl = new JetstreamPageController();
    return (Map<String, Object>) JSON.deserializeUntyped(ctrl.getCanvasParameters);
  }

  private static Set<String> toStringSet(Object values) {
    Set<String> result = new Set<String>();
    for (Object value : (List<Object>) values) {
      result.add((String) value);
    }
    return result;
  }

  // Custom permissions carry the package namespace in packaging and subscriber orgs, and none in a non-namespaced org
  private static List<CustomPermission> queryCustomPermissions(Set<String> developerNames) {
    List<String> classNameParts = JetstreamPageControllerTest.class.getName().split('\\.', 2);
    String namespacePrefix = classNameParts.size() == 2 ? classNameParts[0] : null;
    return [SELECT Id, DeveloperName FROM CustomPermission WHERE DeveloperName IN :developerNames AND NamespacePrefix = :namespacePrefix];
  }

  private static User createUserWithCustomPermissions(List<String> customPermissionNames) {
    String uniqueSuffix = String.valueOf(Math.abs(Crypto.getRandomLong()));
    User testUser = new User(
      ProfileId = UserInfo.getProfileId(),
      LastName = 'Jetstream Test',
      Email = 'jetstream-test@example.com',
      Username = 'jetstream-test-' + uniqueSuffix + '@example.com',
      Alias = 'jstest',
      TimeZoneSidKey = 'America/Los_Angeles',
      LocaleSidKey = 'en_US',
      EmailEncodingKey = 'UTF-8',
      LanguageLocaleKey = 'en_US'
    );
    insert testUser;

    PermissionSet permissionSet = new PermissionSet(Name = 'JetstreamPageControllerTest', Label = 'Jetstream Page Controller Test');
    insert permissionSet;

    List<SetupEntityAccess> customPermissionAccess = new List<SetupEntityAccess>();
    for (CustomPermission customPermission : queryCustomPermissions(new Set<String>(customPermissionNames))) {
      customPermissionAccess.add(new SetupEntityAccess(ParentId = permissionSet.Id, SetupEntityId = customPermission.Id));
    }
    System.assertEquals(customPermissionNames.size(), customPermissionAccess.size(), 'Every custom permission should exist in the package');
    insert customPermissionAccess;

    insert new PermissionSetAssignment(AssigneeId = testUser.Id, PermissionSetId = permissionSet.Id);
    return testUser;
  }
}
