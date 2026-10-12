public with sharing class JetstreamPageController {
  /**
   * Users without this custom permission can use every Jetstream tool, so existing installs are unaffected.
   * Users with it only get the tools and actions whose custom permission they also hold.
   */
  @TestVisible
  private static final String LIMITED_ACCESS_PERMISSION = 'Limited_Access';

  /**
   * Jetstream tool key => custom permission that grants it. The keys must match Jetstream's tool keys, a key
   * Jetstream does not recognize is ignored by the canvas app.
   */
  @TestVisible
  private static final Map<String, String> TOOL_PERMISSIONS = new Map<String, String>{
    'query' => 'Tool_Query',
    'load' => 'Tool_Load',
    'update-records' => 'Tool_Update_Records',
    'create-record' => 'Tool_Create_Record',
    'data-history' => 'Tool_Data_History',
    'platform-events' => 'Tool_Platform_Events',
    'automation-control' => 'Tool_Automation_Control',
    'manage-permissions' => 'Tool_Manage_Permissions',
    'permission-analysis' => 'Tool_Permission_Analysis',
    'data-analysis' => 'Tool_Data_Analysis',
    'deploy-metadata' => 'Tool_Deploy_Metadata',
    'create-fields' => 'Tool_Create_Fields',
    'record-type-manager' => 'Tool_Record_Type_Manager',
    'formula-evaluator' => 'Tool_Formula_Evaluator',
    'object-export' => 'Tool_Object_Export',
    'anonymous-apex' => 'Tool_Anonymous_Apex',
    'apex-tests' => 'Tool_Apex_Tests',
    'debug-logs' => 'Tool_Debug_Logs',
    'salesforce-api' => 'Tool_Salesforce_Api'
  };

  /**
   * Jetstream operation key => custom permission that grants it. Connecting orgs does not apply here, the
   * canvas app only works with the org that opened it.
   */
  @TestVisible
  private static final Map<String, String> OPERATION_PERMISSIONS = new Map<String, String>{
    'records.write' => 'Action_Records_Write',
    'records.delete' => 'Action_Records_Delete',
    'records.export' => 'Action_Records_Export',
    'metadata.deploy' => 'Action_Metadata_Deploy'
  };

  public String getCanvasParameters {
    get {
      Boolean isFullScreen = true;
      // This does not cover all cases, but does cover cases where the VFP is embedded in a Lightning page/tab
      String tabId = ApexPages.currentPage().getParameters().get('sfdc.tabName');
      if (String.isNotBlank(tabId)) {
        isFullScreen = false;
      }
      Map<String, Object> params = new Map<String, Object>{ 'isFullScreen' => isFullScreen, 'accessProfile' => getAccessProfile() };
      return JSON.serialize(params);
    }
    private set;
  }

  /**
   * The tools and actions Jetstream shows the current user, or null for full access. This only decides what
   * Jetstream shows, Salesforce permissions still decide what the user can do.
   */
  @TestVisible
  private static Map<String, Object> getAccessProfile() {
    if (!FeatureManagement.checkPermission(LIMITED_ACCESS_PERMISSION)) {
      return null;
    }
    return new Map<String, Object>{ 'tools' => getGrantedKeys(TOOL_PERMISSIONS), 'operations' => getGrantedKeys(OPERATION_PERMISSIONS) };
  }

  private static List<String> getGrantedKeys(Map<String, String> permissionByKey) {
    List<String> grantedKeys = new List<String>();
    for (String key : permissionByKey.keySet()) {
      if (FeatureManagement.checkPermission(permissionByKey.get(key))) {
        grantedKeys.add(key);
      }
    }
    return grantedKeys;
  }
}
