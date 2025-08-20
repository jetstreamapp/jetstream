import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { NavbarItem, NavbarMenuItems } from '@jetstream/ui';

export const HeaderNavbarItems = () => {
  return (
    <>
      <NavbarItem
        path={APP_ROUTES.HOME.ROUTE}
        search={APP_ROUTES.HOME.SEARCH_PARAM}
        title="Home"
        label={
          <button className="slds-button slds-icon-waffle_container">
            <span className="slds-icon-waffle">
              <span className="slds-r1"></span>
              <span className="slds-r2"></span>
              <span className="slds-r3"></span>
              <span className="slds-r4"></span>
              <span className="slds-r5"></span>
              <span className="slds-r6"></span>
              <span className="slds-r7"></span>
              <span className="slds-r8"></span>
              <span className="slds-r9"></span>
            </span>
            <span className="slds-assistive-text">Home Page</span>
          </button>
        }
      />
      <NavbarItem
        path={APP_ROUTES.QUERY.ROUTE}
        search={APP_ROUTES.QUERY.SEARCH_PARAM}
        title={APP_ROUTES.QUERY.DESCRIPTION}
        label={APP_ROUTES.QUERY.TITLE}
      />

      <NavbarMenuItems
        label="Load Records"
        items={[
          {
            id: 'load',
            path: APP_ROUTES.LOAD.ROUTE,
            search: APP_ROUTES.LOAD.SEARCH_PARAM,
            title: APP_ROUTES.LOAD.DESCRIPTION,
            label: APP_ROUTES.LOAD.TITLE,
          },
          {
            id: 'load-with-relationships',
            path: APP_ROUTES.LOAD_MULTIPLE.ROUTE,
            search: APP_ROUTES.LOAD_MULTIPLE.SEARCH_PARAM,
            title: APP_ROUTES.LOAD_MULTIPLE.DESCRIPTION,
            label: APP_ROUTES.LOAD_MULTIPLE.TITLE,
          },
          {
            id: 'update-records',
            path: APP_ROUTES.LOAD_MASS_UPDATE.ROUTE,
            search: APP_ROUTES.LOAD_MASS_UPDATE.SEARCH_PARAM,
            title: APP_ROUTES.LOAD_MASS_UPDATE.DESCRIPTION,
            label: APP_ROUTES.LOAD_MASS_UPDATE.TITLE,
          },
          {
            id: 'create-records',
            path: APP_ROUTES.LOAD_CREATE_RECORD.ROUTE,
            search: APP_ROUTES.LOAD_CREATE_RECORD.SEARCH_PARAM,
            title: APP_ROUTES.LOAD_CREATE_RECORD.DESCRIPTION,
            label: APP_ROUTES.LOAD_CREATE_RECORD.TITLE,
          },
        ]}
      />

      <NavbarItem
        path={APP_ROUTES.AUTOMATION_CONTROL.ROUTE}
        search={APP_ROUTES.AUTOMATION_CONTROL.SEARCH_PARAM}
        title={APP_ROUTES.AUTOMATION_CONTROL.DESCRIPTION}
        label={APP_ROUTES.AUTOMATION_CONTROL.TITLE}
      />
      <NavbarItem
        path={APP_ROUTES.PERMISSION_MANAGER.ROUTE}
        search={APP_ROUTES.PERMISSION_MANAGER.SEARCH_PARAM}
        title={APP_ROUTES.PERMISSION_MANAGER.DESCRIPTION}
        label={APP_ROUTES.PERMISSION_MANAGER.TITLE}
      />

      <NavbarMenuItems
        label="Deploy Metadata"
        items={[
          {
            id: 'deploy-metadata',
            path: APP_ROUTES.DEPLOY_METADATA.ROUTE,
            search: APP_ROUTES.DEPLOY_METADATA.SEARCH_PARAM,
            title: APP_ROUTES.DEPLOY_METADATA.DESCRIPTION,
            label: APP_ROUTES.DEPLOY_METADATA.TITLE,
          },
          {
            id: 'deploy-sobject-metadata',
            path: APP_ROUTES.CREATE_FIELDS.ROUTE,
            search: APP_ROUTES.CREATE_FIELDS.SEARCH_PARAM,
            title: APP_ROUTES.CREATE_FIELDS.DESCRIPTION,
            label: APP_ROUTES.CREATE_FIELDS.TITLE,
          },
          {
            id: 'record-type-manager',
            path: APP_ROUTES.RECORD_TYPE_MANAGER.ROUTE,
            search: APP_ROUTES.RECORD_TYPE_MANAGER.SEARCH_PARAM,
            title: APP_ROUTES.RECORD_TYPE_MANAGER.DESCRIPTION,
            label: APP_ROUTES.RECORD_TYPE_MANAGER.TITLE,
          },
          {
            id: 'formula-evaluator',
            path: APP_ROUTES.FORMULA_EVALUATOR.ROUTE,
            search: APP_ROUTES.FORMULA_EVALUATOR.SEARCH_PARAM,
            title: APP_ROUTES.FORMULA_EVALUATOR.DESCRIPTION,
            label: APP_ROUTES.FORMULA_EVALUATOR.TITLE,
          },
        ]}
      />

      <NavbarMenuItems
        label="Developer Tools"
        items={[
          {
            id: 'apex',
            path: APP_ROUTES.ANON_APEX.ROUTE,
            search: APP_ROUTES.ANON_APEX.SEARCH_PARAM,
            title: APP_ROUTES.ANON_APEX.DESCRIPTION,
            label: APP_ROUTES.ANON_APEX.TITLE,
          },
          {
            id: 'debug-logs',
            path: APP_ROUTES.DEBUG_LOG_VIEWER.ROUTE,
            search: APP_ROUTES.DEBUG_LOG_VIEWER.SEARCH_PARAM,
            title: APP_ROUTES.DEBUG_LOG_VIEWER.DESCRIPTION,
            label: APP_ROUTES.DEBUG_LOG_VIEWER.TITLE,
          },
          {
            id: 'sobject-export',
            path: APP_ROUTES.OBJECT_EXPORT.ROUTE,
            search: APP_ROUTES.OBJECT_EXPORT.SEARCH_PARAM,
            title: APP_ROUTES.OBJECT_EXPORT.DESCRIPTION,
            label: APP_ROUTES.OBJECT_EXPORT.TITLE,
          },
          {
            id: 'salesforce-api',
            path: APP_ROUTES.SALESFORCE_API.ROUTE,
            search: APP_ROUTES.SALESFORCE_API.SEARCH_PARAM,
            title: APP_ROUTES.SALESFORCE_API.DESCRIPTION,
            label: APP_ROUTES.SALESFORCE_API.TITLE,
          },
          {
            id: 'platform-event-monitor',
            path: APP_ROUTES.PLATFORM_EVENT_MONITOR.ROUTE,
            search: APP_ROUTES.PLATFORM_EVENT_MONITOR.SEARCH_PARAM,
            title: APP_ROUTES.PLATFORM_EVENT_MONITOR.DESCRIPTION,
            label: APP_ROUTES.PLATFORM_EVENT_MONITOR.TITLE,
          },
        ]}
      />
      <NavbarMenuItems
        label="Documentation &amp; Support"
        items={[
          {
            id: 'feedback',
            path: APP_ROUTES.FEEDBACK_SUPPORT.ROUTE,
            search: APP_ROUTES.FEEDBACK_SUPPORT.SEARCH_PARAM,
            title: APP_ROUTES.FEEDBACK_SUPPORT.DESCRIPTION,
            label: APP_ROUTES.FEEDBACK_SUPPORT.TITLE,
          },
          {
            id: 'documentation',
            path: 'https://docs.getjetstream.app',
            isExternal: true,
            title: 'Documentation',
            label: 'Documentation',
          },
        ]}
      />
    </>
  );
};
