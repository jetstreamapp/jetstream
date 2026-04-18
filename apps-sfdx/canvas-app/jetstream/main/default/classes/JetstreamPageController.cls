public with sharing class JetstreamPageController {
  public String getCanvasParameters {
    get {
      Boolean isFullScreen = true;
      // This does not cover all cases, but does cover cases where the VFP is embedded in a Lightning page/tab
      String tabId = ApexPages.currentPage().getParameters().get('sfdc.tabName');
      if (String.isNotBlank(tabId)) {
        isFullScreen = false;
      }
      Map<String, Object> params = new Map<String, Object>{ 'isFullScreen' => isFullScreen };
      return JSON.serialize(params);
    }
    private set;
  }
}
