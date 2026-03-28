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
    JetstreamPageController ctrl = new JetstreamPageController();
    String result = ctrl.getCanvasParameters;

    // Assert
    System.assertEquals('{"isFullScreen":true}', result, 'When no sfdc.tabName param is present, isFullScreen should be true');
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
    JetstreamPageController ctrl = new JetstreamPageController();
    String result = ctrl.getCanvasParameters;

    // Assert
    System.assertEquals('{"isFullScreen":false}', result, 'When sfdc.tabName param is present, isFullScreen should be false');
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
    JetstreamPageController ctrl = new JetstreamPageController();
    String result = ctrl.getCanvasParameters;

    // Assert
    System.assertEquals('{"isFullScreen":true}', result, 'Blank sfdc.tabName should not affect fullscreen detection');
  }
}
