insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{"Content-Type":"application/x-www-form-urlencoded"}', 'a7e24a9e-c047-487e-93bf-f7dc40b40af9', 'POST', 'Refresh Token', '2021-05-31 13:24:53.598375', 'services/oauth2/token');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "query": "SELECT fields FROM bigObject",
    "operation": "<insert update upsert>",
    "targetObject": "<custom object>",
    "targetFieldMap": {
        "firstField__c": "firstFieldTarget__c",
        "secondField__c": "secondFieldTarget__c"
    },
    "targetValueMap": {
        "$JOB_ID": "BackgroundOperationLookup__c",
        "Copy fields from source to target": "BackgroundOperationDescription__c"
    },
    "targetExternalIdField":"<external id field used in upsert>"
}', '2021-05-31 13:24:53.598375', NULL, 'Submit Async SOQL queries to be processed asynchronously and check on their status. Use async query resources to make consistent SOQL queries, no matter what size the data is or where the data is stored.

📚 [Async Query Resources Documentation](https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_async_queries_home.htm)', 'Async Query', '{"Content-Type":"application/json"}', 'eb0ad811-0e48-4a9b-8d56-6fdb64ab5f2c', 'POST', 'Create Async Query', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/async-queries');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Submit Async SOQL queries to be processed asynchronously and check on their status. Use async query resources to make consistent SOQL queries, no matter what size the data is or where the data is stored.

📚 [Async Query Resources Documentation](https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_async_queries_home.htm)', 'Async Query', '{"Content-Type":"application/json"}', 'ee729933-8076-4ba2-8292-0c67f7c3636b', 'GET', 'Get Async Query Info', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/async-queries/{{_jobId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Submit Async SOQL queries to be processed asynchronously and check on their status. Use async query resources to make consistent SOQL queries, no matter what size the data is or where the data is stored.

📚 [Async Query Resources Documentation](https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_async_queries_home.htm)', 'Async Query', '{"Content-Type":"application/json"}', '00f55fa8-7d00-4f22-b24e-850b79e96489', 'DELETE', 'Delete Async Query', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/async-queries/{{_jobId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'JWT Auth', 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{"Content-Type":"application/x-www-form-urlencoded"}', '31a8fdb8-56eb-4597-8929-5ae9a8e07c6a', 'POST', 'JWT Bearer Token Flow', '2021-05-31 13:24:53.598375', 'services/oauth2/token');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{}', '0519f9aa-6c27-4e0f-85a5-0eba8d06aa58', 'GET', 'User Agent Flow', '2021-05-31 13:24:53.598375', 'services/oauth2/authorize');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{}', '46dcb5db-cf4f-4b37-b085-c39752092906', 'GET', 'Web Server Flow 1', '2021-05-31 13:24:53.598375', 'services/oauth2/authorize');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{}', 'c4367113-90ed-4a22-9b09-7caead92066f', 'POST', 'Web Server Flow 2', '2021-05-31 13:24:53.598375', 'services/oauth2/token');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"}', '6c11a110-6ed7-475a-87a9-389a81c6144a', 'POST', 'OAuth Username Password', '2021-05-31 13:24:53.598375', 'services/oauth2/token');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{"Content-Type":"application/x-www-form-urlencoded"}', '910aa37c-ec74-4f0f-9c4d-2793240b32de', 'POST', 'Asset Token Flow', '2021-05-31 13:24:53.598375', 'services/oauth2/token');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{"Content-Type":"application/x-www-form-urlencoded"}', 'e588d501-ac0d-45c6-af8e-ebc90f4deefd', 'POST', 'Revoke Token', '2021-05-31 13:24:53.598375', 'services/oauth2/revoke');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{}', 'f7f6fb5b-2b4c-476d-be7d-c6098d10261f', 'GET', 'OpenID Connect Discovery Endpoint', '2021-05-31 13:24:53.598375', '.well-known/openid-configuration');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{}', '31d4c391-3e65-4c99-b347-bd34c8196d4b', 'GET', 'Authentication Configuration Endpoint', '2021-05-31 13:24:53.598375', '.well-known/auth-configuration');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{"Content-Type":"application/json"}', 'f140aca6-e65c-4154-b279-689ddea5591c', 'GET', 'User Info', '2021-05-31 13:24:53.598375', 'services/oauth2/userinfo');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"}', '2d107723-d442-4100-ad49-9bb361350290', 'POST', 'OpenID Connect Token Introspection Endpoint', '2021-05-31 13:24:53.598375', 'services/oauth2/introspect');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "redirect_uris": [
        "http://localhost"
    ],
    "response_types": [
        "code",
        "token",
        "id_token"
    ],
    "grant_types": [
        "authorization_code",
        "implicit",
        "refresh_token"
    ],
    "application_type": "web",
    "contacts": [
        "abc@sf.com",
        "ve7jtb@example.org"
    ],
    "client_name": "Example Olivier"
}', '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{"Content-Type":"application/json","Accept":"application/json","Authorization":"Bearer {{init_access_token}}"}', '44482d24-88f4-4b2c-a1f9-98e159e955f3', 'POST', 'OpenID Connect Dynamic Client Registration Endpoint', '2021-05-31 13:24:53.598375', 'services/oauth2/register');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('<?xml version="1.0" encoding="utf-8" ?>
<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body>
    <n1:login xmlns:n1="urn:partner.soap.sforce.com">
      <n1:username><![CDATA[{{username}}]]></n1:username>
      <n1:password><![CDATA[{{password}}{{secretToken}}]]></n1:password>
    </n1:login>
  </env:Body>
</env:Envelope>', '2021-05-31 13:24:53.598375', 'Logs in to the login server and starts a client session.

Make sure to set the `url`, `username`, `password` and `secretToken` environment variables before sending this request.
On success, the request will automatically collect your authentication token for later use.', 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{"Content-Type":"text/xml","SOAPAction":"login","charset":"UTF-8","Accept":"text/xml"}', '39a18693-a9a1-46ff-b3cf-107e8bcf850d', 'POST', 'SOAP Login', '2021-05-31 13:24:53.598375', 'services/Soap/u/{{version}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{}', '7bbc39c5-0891-4a82-a902-28d495b08b43', 'GET', 'Salesforce Keys', '2021-05-31 13:24:53.598375', 'id/keys');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use requests from this folder to obtain an Access Token.

The authentication requests automatically fill the endpoint URL and access token environment variables for subsequent API calls.', 'Auth', '{"Content-Type":"application/json"}', 'e0cd6a91-bd3e-4805-9c3d-266023458685', 'GET', 'ID Token', '2021-05-31 13:24:53.598375', 'id/{{_orgId}}/{{_userId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
  "operation" : "insert",
  "object" : "Account",
  "contentType" : "CSV"
}', '2021-05-31 13:24:53.598375', NULL, 'The Bulk API provides a programmatic option to quickly load your org’s data into Salesforce. To use the API requires basic familiarity with software development, web services, and the Salesforce user interface.

The functionality described is available only if your org has the Bulk API feature enabled. This feature is enabled by default for Performance, Unlimited, Enterprise, and Developer Editions.

📚 [Bulk API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_intro.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v1', '{"X-SFDC-Session":"{{_accessToken}}","Content-Type":"application/json","charset":"UTF-8","Sforce-Disable-Batch-Retry":"FALSE","Sforce-Line-Ending":"CRLF","Sforce-Enable-PKChunking":"FALSE","chunkSize":"10000","Accept-Encoding":"gzip","Content-Encoding":"gzip"}', 'fd96ab6e-674b-4991-a83b-c7e14a00dfb4', 'POST', 'Bulk Create Job', '2021-05-31 13:24:53.598375', 'services/async/{{version}}/job');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('Salesforce Field,Csv Header,Value,Hint
Name,Full Name,,
Title,Job Title,,
LeadSource,Lead Source,Import,
Description,,Imported from XYZ.csv,
Birthdate,Date of Birth,,dd MM yy', '2021-05-31 13:24:53.598375', NULL, 'The Bulk API provides a programmatic option to quickly load your org’s data into Salesforce. To use the API requires basic familiarity with software development, web services, and the Salesforce user interface.

The functionality described is available only if your org has the Bulk API feature enabled. This feature is enabled by default for Performance, Unlimited, Enterprise, and Developer Editions.

📚 [Bulk API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_intro.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v1', '{"X-SFDC-Session":"{{_accessToken}}","Content-Type":"text/csv","charset":"UTF-8","Accept-Encoding":"gzip","Content-Encoding":"gzip"}', '385047dc-ee79-401f-8bc8-41bfbf0d875a', 'POST', 'Bulk Spec', '2021-05-31 13:24:53.598375', 'services/async/{{version}}/job/{{_jobId}}/spec');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'The Bulk API provides a programmatic option to quickly load your org’s data into Salesforce. To use the API requires basic familiarity with software development, web services, and the Salesforce user interface.

The functionality described is available only if your org has the Bulk API feature enabled. This feature is enabled by default for Performance, Unlimited, Enterprise, and Developer Editions.

📚 [Bulk API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_intro.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v1', '{"X-SFDC-Session":"{{_accessToken}}","Content-Type":["text/csv","zip/csv"],"charset":"UTF-8","Accept-Encoding":"gzip","Content-Encoding":"gzip"}', '821d377b-6a6d-4b5c-a000-9c171cd2b92a', 'POST', 'Bulk Create Batch', '2021-05-31 13:24:53.598375', 'services/async/{{version}}/job/{{_jobId}}/batch');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get metadata about page layouts for the specified object type.', NULL, 'Records', '{}', 'ab9776a0-465f-44e9-8e55-41c803bf9c22', 'GET', 'Get Record Layout Metadata', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/layout/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
   "state" : "UploadComplete"
}', '2021-05-31 13:24:53.598375', NULL, 'The Bulk API provides a programmatic option to quickly load your org’s data into Salesforce. To use the API requires basic familiarity with software development, web services, and the Salesforce user interface.

The functionality described is available only if your org has the Bulk API feature enabled. This feature is enabled by default for Performance, Unlimited, Enterprise, and Developer Editions.

📚 [Bulk API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_intro.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v1', '{"X-SFDC-Session":"{{_accessToken}}","Content-Type":"application/json","charset":"UTF-8","Accept-Encoding":"gzip","Content-Encoding":"gzip"}', 'a3649129-4f47-4365-acfd-bc61d66541d2', 'POST', 'Bulk Close Job', '2021-05-31 13:24:53.598375', 'services/async/{{version}}/job/{{_jobId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'The Bulk API provides a programmatic option to quickly load your org’s data into Salesforce. To use the API requires basic familiarity with software development, web services, and the Salesforce user interface.

The functionality described is available only if your org has the Bulk API feature enabled. This feature is enabled by default for Performance, Unlimited, Enterprise, and Developer Editions.

📚 [Bulk API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_intro.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v1', '{"X-SFDC-Session":"{{_accessToken}}","Accept-Encoding":"gzip","Content-Encoding":"gzip"}', 'df43bb2d-982a-44d0-b0e3-87e18c5659ac', 'GET', 'Bulk Check Batch Status', '2021-05-31 13:24:53.598375', 'services/async/{{version}}/job/{{_jobId}}/batch');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'The Bulk API provides a programmatic option to quickly load your org’s data into Salesforce. To use the API requires basic familiarity with software development, web services, and the Salesforce user interface.

The functionality described is available only if your org has the Bulk API feature enabled. This feature is enabled by default for Performance, Unlimited, Enterprise, and Developer Editions.

📚 [Bulk API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/asynch_api_intro.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v1', '{"X-SFDC-Session":"{{_accessToken}}","Accept-Encoding":"gzip","Content-Encoding":"gzip"}', '2d5ddc0b-a81a-4b8a-89e1-86744d1c8368', 'GET', 'Bulk Retrieve Batch Result', '2021-05-31 13:24:53.598375', 'services/async/{{version}}/job/{{_jobId}}/batch/{{_batchId}}/result');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
  "operation" : "query",
  "query" : "SELECT fields FROM object WHERE filter",
  "contentType" : "CSV",
  "columnDelimiter" : "BACKQUOTE | CARET | COMMA | PIPE | SEMICOLON | TAB",
  "lineEnding" : "CRLF | LF"
} ', '2021-05-31 13:24:53.598375', NULL, NULL, 'Query', '{"Content-Type":"application/json"}', '888bda90-1945-4fa9-b448-5825e0b3f497', 'POST', 'Create job Query', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/query');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
	"state":"Aborted"
}', '2021-05-31 13:24:53.598375', NULL, NULL, 'Query', '{"Content-Type":"application/json"}', '034fae59-de09-477b-a2a5-a0f75dc0cd93', 'PATCH', 'Abort a Job Query', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/query/{{_jobId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, NULL, 'Query', '{"Content-Type":"application/json"}', '2ca0e44d-08b5-4ca4-8488-43abceebd468', 'GET', 'Get Job Info Query', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/query/{{_jobId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, NULL, 'Query', '{"Content-Type":"application/json"}', 'a6c4ffba-4b29-4d3a-bfdb-c9fc7e13e979', 'DELETE', 'Delete Job Query', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/query/{{_jobId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, NULL, 'Query', '{"Content-Type":"application/json","Accept":"test/csv"}', 'cbaeaa49-2dcb-4a4c-845c-55917f3cff44', 'GET', 'Get Job Query Result', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/query/{{_jobId}}/results');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, NULL, 'Query', '{"Content-Type":"application/json"}', '08033f67-c75a-423f-a306-deb1cf3ddde9', 'GET', 'Get All Query Jobs', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/query');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
  "operation" : "query",
  "query" : "SELECT fields FROM object WHERE filter",
  "contentType" : "CSV",
  "columnDelimiter" : "BACKQUOTE | CARET | COMMA | PIPE | SEMICOLON | TAB",
  "lineEnding" : "CRLF | LF"
} ', '2021-05-31 13:24:53.598375', NULL, NULL, 'Query', '{"Content-Type":"application/json"}', '0bb80b09-6c1d-4c34-a049-9b1544382130', 'POST', 'Create job Query', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/query');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
	"state":"Aborted"
}', '2021-05-31 13:24:53.598375', NULL, NULL, 'Query', '{"Content-Type":"application/json"}', '9264c8fd-8e12-4d13-a98a-4da6859a2f51', 'PATCH', 'Abort a Job Query', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/query/{{_jobId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, NULL, 'Query', '{"Content-Type":"application/json"}', '0124581d-ea6d-422a-976b-a76315d2f276', 'GET', 'Get Job Info Query', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/query/{{_jobId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, NULL, 'Query', '{"Content-Type":"application/json"}', '4436a838-d7f1-4c41-83ca-2ad19c6db824', 'DELETE', 'Delete Job Query', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/query/{{_jobId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, NULL, 'Query', '{"Content-Type":"application/json","Accept":"test/csv"}', 'd0942cde-3cf8-4db3-91f2-17b622d2ecbf', 'GET', 'Get Job Query Result', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/query/{{_jobId}}/results');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, NULL, 'Query', '{"Content-Type":"application/json"}', '5e6927fb-b95b-4120-b383-e08c72eae0fc', 'GET', 'Get All Query Jobs', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/query');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "object": "Asset",
    "operation": "update"
}', '2021-05-31 13:24:53.598375', NULL, 'Bulk API 2.0 provides a simple interface to quickly load large amounts of data into your Salesforce org and to perform bulk queries on your org data.

Bulk API 2.0 is available in API version 41.0 and later. Query jobs in Bulk API 2.0 are available in API version 47.0 and later.

📚 [Bulk API 2.0 Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_bulk_v2.meta/api_bulk_v2/introduction_bulk_api_2.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v2', '{"Content-Type":"application/json"}', 'd8dfcb21-5fc0-459a-9086-9727f3c6e812', 'POST', 'Create job', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/ingest');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Bulk API 2.0 provides a simple interface to quickly load large amounts of data into your Salesforce org and to perform bulk queries on your org data.

Bulk API 2.0 is available in API version 41.0 and later. Query jobs in Bulk API 2.0 are available in API version 47.0 and later.

📚 [Bulk API 2.0 Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_bulk_v2.meta/api_bulk_v2/introduction_bulk_api_2.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v2', '{"Content-Type":"text/csv"}', 'b0e45bd7-3269-49f9-97fa-a7cc5f76f487', 'PUT', 'Upload Job Data', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/ingest/{{_jobId}}/batches');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
	"state":"UploadComplete"
}', '2021-05-31 13:24:53.598375', NULL, 'Bulk API 2.0 provides a simple interface to quickly load large amounts of data into your Salesforce org and to perform bulk queries on your org data.

Bulk API 2.0 is available in API version 41.0 and later. Query jobs in Bulk API 2.0 are available in API version 47.0 and later.

📚 [Bulk API 2.0 Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_bulk_v2.meta/api_bulk_v2/introduction_bulk_api_2.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v2', '{"Content-Type":"application/json"}', '101fb5d6-4f52-4285-b0d8-eaf522adcaf3', 'PATCH', 'Close or Abort a Job', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/ingest/{{_jobId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Bulk API 2.0 provides a simple interface to quickly load large amounts of data into your Salesforce org and to perform bulk queries on your org data.

Bulk API 2.0 is available in API version 41.0 and later. Query jobs in Bulk API 2.0 are available in API version 47.0 and later.

📚 [Bulk API 2.0 Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_bulk_v2.meta/api_bulk_v2/introduction_bulk_api_2.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v2', '{"Content-Type":"application/json"}', '07e2d2a0-3c07-4b80-82a6-58b4c5ec9217', 'DELETE', 'Delete Job', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/ingest/{{_jobId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Bulk API 2.0 provides a simple interface to quickly load large amounts of data into your Salesforce org and to perform bulk queries on your org data.

Bulk API 2.0 is available in API version 41.0 and later. Query jobs in Bulk API 2.0 are available in API version 47.0 and later.

📚 [Bulk API 2.0 Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_bulk_v2.meta/api_bulk_v2/introduction_bulk_api_2.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v2', '{"Content-Type":"application/json"}', '2dc37950-4f64-4d4e-805a-d31a8c6ea369', 'GET', 'Get Job Info', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/ingest/{{_jobId}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Bulk API 2.0 provides a simple interface to quickly load large amounts of data into your Salesforce org and to perform bulk queries on your org data.

Bulk API 2.0 is available in API version 41.0 and later. Query jobs in Bulk API 2.0 are available in API version 47.0 and later.

📚 [Bulk API 2.0 Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_bulk_v2.meta/api_bulk_v2/introduction_bulk_api_2.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v2', '{"Content-Type":"application/json"}', '7541b211-5ffd-45f7-91ca-6e923f3a29d1', 'GET', 'Get All Jobs', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/ingest');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Bulk API 2.0 provides a simple interface to quickly load large amounts of data into your Salesforce org and to perform bulk queries on your org data.

Bulk API 2.0 is available in API version 41.0 and later. Query jobs in Bulk API 2.0 are available in API version 47.0 and later.

📚 [Bulk API 2.0 Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_bulk_v2.meta/api_bulk_v2/introduction_bulk_api_2.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v2', '{"Content-Type":"application/json"}', 'cfcaa5ba-33e7-4bdc-b80b-a80a8ca10eff', 'GET', 'Get Job Successful Record Results', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/ingest/{{_jobId}}/successfulResults');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Bulk API 2.0 provides a simple interface to quickly load large amounts of data into your Salesforce org and to perform bulk queries on your org data.

Bulk API 2.0 is available in API version 41.0 and later. Query jobs in Bulk API 2.0 are available in API version 47.0 and later.

📚 [Bulk API 2.0 Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_bulk_v2.meta/api_bulk_v2/introduction_bulk_api_2.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v2', '{"Content-Type":"application/json"}', 'c0b2df37-9495-4b75-96c7-c899ad895827', 'GET', 'Get Job Failed Record Results', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/ingest/{{_jobId}}/failedResults');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Bulk API 2.0 provides a simple interface to quickly load large amounts of data into your Salesforce org and to perform bulk queries on your org data.

Bulk API 2.0 is available in API version 41.0 and later. Query jobs in Bulk API 2.0 are available in API version 47.0 and later.

📚 [Bulk API 2.0 Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_bulk_v2.meta/api_bulk_v2/introduction_bulk_api_2.htm)

**Note:** All Bulk API requests except "Create Job" require a `_jobId` variable. This variable is automatically set by the "Create Job" request.', 'Bulk v2', '{"Content-Type":"application/json"}', '64255ff3-97a3-4419-958e-6a0a835dee3a', 'GET', 'Get Job Unprocessed Record Results', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/jobs/ingest/{{_jobId}}/unprocessedrecords');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "allOrNone": "Boolean",
    "collateSubrequests": "Boolean",
    "compositeRequest": "Composite Subrequest[]"
}', '2021-05-31 13:24:53.598375', 'Executes a series of REST API requests in a single call. You can use the output of one request as the input to a subsequent request. The response bodies and HTTP statuses of the requests are returned in a single response body. The entire request counts as a single call toward your API limits.
The requests in a composite call are called subrequests. All subrequests are executed in the context of the same user. In a subrequest’s body, you specify a reference ID that maps to the subrequest’s response. You can then refer to the ID in the url or body fields of later subrequests by using a JavaScript-like reference notation.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_composite.htm', NULL, 'Composite', '{"Content-Type":"application/json"}', '1fc98c1b-84d9-48ba-bfd1-3c18f8baa42f', 'POST', 'Composite', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/composite/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "graphs": [
        {
            "graphId": "graph1",
            "compositeRequest": [
                {
                    "method": "POST",
                    "url": "/services/data/v{{version}}/sobjects/Account/",
                    "referenceId": "newAccount",
                    "body": {
                        "Name": "ACME Inc."
                    }
                },
                {
                    "method": "POST",
                    "url": "/services/data/v{{version}}/sobjects/Contact/",
                    "referenceId": "newContact",
                    "body": {
                        "FirstName": "John",
                        "LastName": "Doe",
                        "AccountId": "@{newAccount.id}"
                    }
                }
            ]
        }
    ]
}', '2021-05-31 13:24:53.598375', 'Composite graphs provide an enhanced way to perform composite requests, which execute a series of REST API requests in a single call.
Regular composite requests allow you to execute a series of REST API requests in a single call. And you can use the output of one request as the input to a subsequent request.

Composite graphs extend this by allowing you to assemble a more complicated and complete series of related objects and records.

Composite graphs also enable you to ensure that the steps in a given set of operations are either all completed or all not completed. This avoids requiring you to check for a mix of successful and unsuccessful results.

Regular composite requests have a limit of 25 subrequests. Composite graphs increase this limit to 500. This gives a single API call much greater power.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_graph_introduction.htm', NULL, 'Composite', '{"Content-Type":"application/json"}', '3fdf1b58-e060-420b-a3fa-c91f20cc27ac', 'POST', 'Composite Graph', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/composite/graph');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_quote_model_9.htm#cpq_api_quote_model_9', '2021-05-31 13:24:53.598375', 'Validate a CPQ quote and return any validation errors.
Available in: Salesforce CPQ Winter ’19 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_validate_quote.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', 'fb816cce-0d31-41e8-94c7-af38c21893de', 'PATCH', 'Validate Quote API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "haltOnError": "Boolean",
    "batchRequests": "Subrequest[]"
}', '2021-05-31 13:24:53.598375', 'Executes up to 25 subrequests in a single request. The response bodies and HTTP statuses of the subrequests in the batch are returned in a single response body. Each subrequest counts against rate limits.
The requests in a batch are called subrequests. All subrequests are executed in the context of the same user. Subrequests are independent, and you can’t pass information between them. Subrequests execute serially in their order in the request body. When a subrequest executes successfully, it commits its data. Commits are reflected in the output of later subrequests. If a subrequest fails, commits made by previous subrequests are not rolled back. If a batch request doesn’t complete within 10 minutes, the batch times out and the remaining subrequests aren’t executed.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_batch.htm', NULL, 'Composite', '{"Content-Type":"application/json"}', 'db721b95-2731-455e-82d5-614013dcc101', 'POST', 'Batch', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/composite/batch');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "records":"SObject Tree Input[]"
}', '2021-05-31 13:24:53.598375', 'Creates one or more sObject trees with root records of the specified type. An sObject tree is a collection of nested, parent-child records with a single root record.
In the request data, you supply the record hierarchies, required and optional field values, each record’s type, and a reference ID for each record. Upon success, the response contains the IDs of the created records. If an error occurs while creating a record, the entire request fails. In this case, the response contains only the reference ID of the record that caused the error and the error information.

The request can contain the following:
Up to a total of 200 records across all trees
Up to five records of different types
SObject trees up to five levels deep
Because an sObject tree can contain a single record, you can use this resource to create up to 200 unrelated records of the same type.

When the request is processed and records are created, triggers, processes, and workflow rules fire separately for each of the following groups of records.
Root records across all sObject trees in the request
All second-level records of the same type—for example, second-level Contacts across all sObject trees in the request
All third-level records of the same type
All fourth-level records of the same type
All fifth-level records of the same type

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobject_tree.htm', NULL, 'Composite', '{"Content-Type":"application/json"}', 'bd07b363-bee9-4f07-a310-fd0c465ad15b', 'POST', 'SObject Tree', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/composite/tree/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "allOrNone": "Boolean",
    "records":"SObject[]"
}', '2021-05-31 13:24:53.598375', 'Executes actions on multiple records in one request. Use SObject Collections to reduce the number of round-trips between the client and server. This resource is available in API version 42.0 and later.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobjects_collections.htm', NULL, 'Composite', '{"Content-Type":"application/json"}', 'b6ac448c-411a-4586-a650-9df3d30a1a36', 'POST', 'SObject Collections Create', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/composite/sobjects');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Executes actions on multiple records in one request. Use SObject Collections to reduce the number of round-trips between the client and server. This resource is available in API version 42.0 and later.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobjects_collections.htm', NULL, 'Composite', '{"Content-Type":"application/json"}', '30e9cf6e-b9af-490d-9b42-a670c0349e3c', 'GET', 'SObject Collections Retrieve', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/composite/sobjects/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "allOrNone": "Boolean",
    "records":"SObject[]"
}', '2021-05-31 13:24:53.598375', 'Executes actions on multiple records in one request. Use SObject Collections to reduce the number of round-trips between the client and server. This resource is available in API version 42.0 and later.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobjects_collections.htm', NULL, 'Composite', '{"Content-Type":"application/json"}', 'cf9492d2-ba4f-42eb-a8fa-7da98387ffcf', 'PATCH', 'SObject Collections Update', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/composite/sobjects/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Executes actions on multiple records in one request. Use SObject Collections to reduce the number of round-trips between the client and server. This resource is available in API version 42.0 and later.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobjects_collections.htm', NULL, 'Composite', '{"Content-Type":"application/json"}', '19979ba5-d157-4bfb-b4cc-2ceeae363588', 'DELETE', 'SObject Collections Delete', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/composite/sobjects/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get, post, and crop a user photo.
To use an image from the Files page as a user photo, pass the file ID in the fileId property of the request body or in the fileId request parameter. Images uploaded on the User page don’t have a file ID and can’t be used as the fileId.

To upload a binary file as the user photo, you must send it in a multipart/form-data message. For information about how to create the multipart/form-data message, see Uploading Binary Files.

To display user profile photos in a feed, cache the user photos. Then use the photoVersionId property of the Photo response body to determine when you need to update a photo. This technique helps you avoid running over limits and may improve mobile client performance.', 'Change the status of a conversation. Get, post, and crop a user photo. Get the most recent user status feed item. Update or delete user status.', 'User Resources', E'{"Content-Type":["multipart/form-data","application/json; charset=UTF-8"],"Content-Disposition":"form-data; name=\\"photo\\""}', 'b3b55ebc-328f-4deb-a2fa-e68f827644b6', 'POST', 'User Photo', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/user-profiles/me/photo');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns all the messages for all the private conversations for the context user. Also used to search across all messages and post a message.
To return all private conversations for the context user, see User Conversations, General.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_users_messages_general.htm', 'Change the status of a conversation. Get, post, and crop a user photo. Get the most recent user status feed item. Update or delete user status.', 'User Resources', '{}', '47afc979-36fe-4cbc-be3b-fc59ddef6d19', 'POST', 'User Messages, General', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/users/me/messages');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of people, groups, records, topics, and files that the specified user is following. Also used to follow records.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_users_FollowingUsers.htm?search_text=following', 'Change the status of a conversation. Get, post, and crop a user photo. Get the most recent user status feed item. Update or delete user status.', 'User Resources', '{}', '87170126-f69b-4868-aa3a-b521da633cbb', 'GET', 'Following', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/users/:USER_ID/following');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of people, groups, records, topics, and files that the specified user is following. Also used to follow records.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_users_FollowingUsers.htm?search_text=following', 'Change the status of a conversation. Get, post, and crop a user photo. Get the most recent user status feed item. Update or delete user status.', 'User Resources', '{}', 'bbd9f464-753f-4582-9d9a-9d7fc826d679', 'POST', 'Following - POST', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/users/:USER_ID/following');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Upload a file, including references to external files, to the Files home or get information about files a user owns. These files don’t include files shared with a user, files a user follows, or general organization files.
When you upload a file to the Files home, it is private and available only to the file owner.

To upload a file, send it in a multipart/form-data request. You can include the description and title of the file in the multipart/form-data request as a JSON or XML request body. You can also send the information as request parameters. For information about how to create the multipart/form-data message, see Uploading Binary Files.
https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_users_files_general.htm', 'A Files Connect repository is an external content repository that’s connected to Salesforce. Use these resources to get a list of repositories, to get information about a repository or a repository file, and to get the content of a repository file. Also use these resources to get information about the files and folders in a repository folder. Use these resources to get a repository’s directory entries, permissions, and permission types. Also use these resources to update a repository’s permissions.', 'Files Connect Repository Resources', '{}', '478ba4aa-1a64-4a53-beb0-381a2a166735', 'POST', 'Users Files, General', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/files/users/me');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get information about a specified file, including references to external files. Upload a new version of an existing file, including references to external files. Rename a file, move a file to a different folder, and delete a file.
To upload a new version of an existing file, make a POST request. Upload the new version as a binary part in a multipart/form-data request. See Uploading Binary Files. To upload a new file to the Files home, use /connect/files/users/me.Get information about a specified file, including references to external files.
https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_files_information.htm', 'A Files Connect repository is an external content repository that’s connected to Salesforce. Use these resources to get a list of repositories, to get information about a repository or a repository file, and to get the content of a repository file. Also use these resources to get information about the files and folders in a repository folder. Use these resources to get a repository’s directory entries, permissions, and permission types. Also use these resources to update a repository’s permissions.', 'Files Connect Repository Resources', '{}', 'cea8c9af-c28f-435e-8b67-4e66bfee363c', 'GET', 'File Information', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/files/:FILE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns the binary content of the file, including references to external files. The content is streamed as the body of the response.
https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_files_content.htm', 'A Files Connect repository is an external content repository that’s connected to Salesforce. Use these resources to get a list of repositories, to get information about a repository or a repository file, and to get the content of a repository file. Also use these resources to get information about the files and folders in a repository folder. Use these resources to get a repository’s directory entries, permissions, and permission types. Also use these resources to update a repository’s permissions.', 'Files Connect Repository Resources', '{}', '9b1d4210-1e71-40ad-bd26-5ca3682f9534', 'GET', 'File Content', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/files/:FILE_ID/content');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get information about a specified file, including references to external files. Upload a new version of an existing file, including references to external files. Rename a file, move a file to a different folder, and delete a file.
To upload a new version of an existing file, make a POST request. Upload the new version as a binary part in a multipart/form-data request. See Uploading Binary Files. To upload a new file to the Files home, use /connect/files/users/me.Get information about a specified file, including references to external files.
https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_files_information.htm', 'A Files Connect repository is an external content repository that’s connected to Salesforce. Use these resources to get a list of repositories, to get information about a repository or a repository file, and to get the content of a repository file. Also use these resources to get information about the files and folders in a repository folder. Use these resources to get a repository’s directory entries, permissions, and permission types. Also use these resources to update a repository’s permissions.', 'Files Connect Repository Resources', '{}', '8235d720-ad8f-4272-9520-42cd97396616', 'DELETE', 'File Information - Delete', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/files/:FILE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns information about the objects with which the specified file has been shared. Objects can be users, groups, or records.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_files_shares.htm', 'Information about files, including content, rendered version, and sharing. Information about asset files, including content and rendition.', 'File Resources', '{}', 'c3ff29b3-70b9-4d78-8d6f-b029a5c755e5', 'GET', 'File Shares', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/files/:FILE_ID/file-shares');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'A description of a file shared as a link. Create, access, and delete a file’s share link.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_files_shares_link.htm', 'Information about files, including content, rendered version, and sharing. Information about asset files, including content and rendition.', 'File Resources', '{}', 'c846247e-94f2-4004-96d0-bd8077d3ec96', 'PUT', 'Files Shares Link', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/files/:FILE_ID/file-shares/link');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'All feed elements from all groups the context user either owns or is a member of, as well as all files, records, and users the context user follows. Use this resource to get information about feed elements and to post feed elements.

For information about posting a feed element, see Feed Elements, Post and Search.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resource_feeds_news.htm#cc_news_feed_elements', 'Feeds are made up of feed items. There are many feed types. Each feed type has an algorithm that determines which feed items it contains.', 'Feeds Resources', '{}', '920cd6af-c34b-4d0a-9962-e4af7f871c4b', 'GET', 'News Feed Elements', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feeds/news/me/feed-elements');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns feed elements created when a user changes records that can be tracked in a feed, feed elements whose parent is the user, and feed elements that mention the user. This feed is different than the news feed, which returns more feed items, including group updates. You can post feed items to the user-profile feed. You can get another user’s user profile feed.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resource_feeds_user_profile.htm', 'Feeds are made up of feed items. There are many feed types. Each feed type has an algorithm that determines which feed items it contains.', 'Feeds Resources', '{}', '0dafaa24-4fff-47c2-99bb-5b5b32eb2cbf', 'GET', 'User Profile Feed Elements', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feeds/user-profile/:USER_ID/feed-elements');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns record data for a list view.', NULL, 'List Views', '{}', 'c1baebc8-85fa-4f5e-8bbe-95b490918255', 'GET', 'Get List View Records per Id', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-records/:LIST_VIEW_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns the feed elements for all the records the context user is following, or all the feed elements of the specified recordId. Use this resource to search a feed or to get the feed elements for a specific feed, including another user’s feed. To use this resource to get the feed elements for a group, specify the group ID as the recordId.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resource_feeds_record.htm', 'Feeds are made up of feed items. There are many feed types. Each feed type has an algorithm that determines which feed items it contains.', 'Feeds Resources', '{}', '8b5bd68b-5089-45a0-998e-e656181e2f53', 'GET', 'Record Feed Elements', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feeds/record/:RECORD_GROUP_ID/feed-elements');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Feed item and comment bodies have a 10,000 character limit. Because this limit can change, we recommend that clients make a describeSObjects() call on the FeedItem or FeedComment object. To determine the maximum number of allowed characters, look at the length of the Body or CommentBody field.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_feed_element.htm', 'Information about feed elements. Access, edit, post, search, and delete feed elements. Access a feed element’s capabilities, including bundles and their feed elements.
', 'Feed Elements Resource', '{}', '06d07741-d40d-4c0d-b0ab-7eadeb05a81d', 'POST', 'Feed Elements, Post and Search', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feed-elements');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (E'{
   "body": {
      "messageSegments": [
         {
            "type": "Text",
            "text": "Chatter Feed Item Created via API: "
         },
         {
            "markupType" : "Paragraph",
            "type" : "MarkupBegin"
         },
         {
            "markupType" : "Bold",
            "type" : "MarkupBegin"
         },
         {
             "text" : "First line of text.",
             "type" : "Text"
         },
         {
            "markupType" : "Bold",
            "type" : "MarkupEnd"
         },
         {
            "markupType" : "Paragraph",
            "type" : "MarkupEnd"
         },
         {
            "markupType" : "Paragraph",
            "type" : "MarkupBegin"
         },
         {
            "text" : "&nbsp;",
            "type" : "Text"
         },
         {
            "markupType" : "Paragraph",
            "type" : "MarkupEnd"
         },
         {
            "markupType" : "Paragraph",
            "type" : "MarkupBegin"
         },
         {
            "text" : "Second line of text.",
            "type" : "Text"
         },
         {
            "markupType" : "Paragraph",
            "type" : "MarkupEnd"
         },
         {
            "markupType" : "Code",
            "type" : "MarkupBegin"
         },
         {
             "text" : "<script>\\nvar i, t = 0;\\nfor (i = 0; i < 5; i++) {\\n   t += i;\\n}\\n</script>",
             "type" : "Text"
         },
         {
            "markupType" : "Code",
            "type" : "MarkupEnd"
         },
         {
            "type": "Mention",
            "id": "<USER_GROUP_ID>"
         }
      ]
   },
   "capabilities": {
      "files": {
         "items": [
            {
               "id": "<FILE_ID>"
            }
         ]
      }
   },
   "subjectId": "<USER_RECORD_GROUP_ID>",
   "feedElementType": "FeedItem"
}', '2021-05-31 13:24:53.598375', 'https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_feed_element.htm

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_feed_element.htm', 'Information about feed elements. Access, edit, post, search, and delete feed elements. Access a feed element’s capabilities, including bundles and their feed elements.
', 'Feed Elements Resource', '{"Content-Type":"application/json"}', 'ed88daab-c26f-4bcd-a230-2d62434e5be6', 'POST', 'Feed Elements, Post and Search', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feed-elements');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "inputs": [
        {
            "richInput": {
                "subjectId": "<USER_GROUP_RECORD_ID>",
                "body": {
                    "messageSegments": [
                        {
                            "type": "Text",
                            "text": "Post Number 1"
                        }
                    ]
                },
                "capabilities": {
                    "files": {
                        "items": [
                            {
                                "id": "<FILE_ID>"
                            }
                        ]
                    }
                },
                "feedElementType": "FeedItem"
            }
        },
        {
            "richInput": {
                "subjectId": "<USER_GROUP_RECORD_ID>",
                "body": {
                    "messageSegments": [
                        {
                            "type": "Text",
                            "text": "Post Number 2"
                        }
                    ]
                },
                "feedElementType": "FeedItem"
            }
        },
        {
            "richInput": {
                "subjectId": "me",
                "body": {
                    "messageSegments": [
                        {
                            "type": "Text",
                            "text": "Post Number 3 with Inline"
                        },
                        {
                            "type": "InlineImage",
                            "fileId": "<FILE_ID>",
                            "altText": "Test Inline"
                        }
                    ]
                },
                "feedElementType": "FeedItem"
            }
        }
    ]
}', '2021-05-31 13:24:53.598375', 'Post a batch of up to 500 feed elements.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_feed_element_batch_post.htm', 'Information about feed elements. Access, edit, post, search, and delete feed elements. Access a feed element’s capabilities, including bundles and their feed elements.
', 'Feed Elements Resource', '{"Content-Type":"application/json"}', 'afa9a3bb-fcdd-47ca-8520-c2148a5e9304', 'POST', 'Feed Elements, Batch Post', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feed-elements/batch');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Access, edit, or delete a feed element. Feed items are the only type of feed element that can be edited.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_feed_element_specific.htm', 'Information about feed elements. Access, edit, post, search, and delete feed elements. Access a feed element’s capabilities, including bundles and their feed elements.
', 'Feed Elements Resource', '{}', '4dfbed0b-1aaa-496c-85f5-ed5b795e7b9c', 'DELETE', 'Feed Element - Delete', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feed-elements/:FEED_ELEMENT_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Access comments for a feed element, or add a comment to a feed element.
To upload a binary file to attach to a comment, you must send it in a multipart/form-data request. To send the text of the comment, you can choose to include a JSON or XML rich input body part in the multipart/form-data request. Alternately, you can choose to pass the information in request parameter parts. For information about how to create the multipart/form-data message, see Uploading Binary Files.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_feed_element_capability_comments_items.htm#connect_resources_feed_element_capability_comments_items', 'Information about feed elements. Access, edit, post, search, and delete feed elements. Access a feed element’s capabilities, including bundles and their feed elements.
', 'Feed Elements Resource', '{}', '57f65559-12d8-4a9e-bba0-6ce4d8b04e47', 'POST', 'Feed Elements Capability, Comments Items', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feed-elements/:FEED_ELEMENT_ID/capabilities/comments/items');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "body": {
        "messageSegments": [
            {
                "type": "Text",
                "text": "Editing a comment"
            }
        ]
    }
}', '2021-05-31 13:24:53.598375', 'Get information about, edit, or delete a comment.
To post a comment, use Feed Elements Capability, Comments Items.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_comments_specific.htm#connect_resources_comments_specific', 'Get information about, edit, like, upvote, verify, or delete a comment. Determine whether the context user can edit a comment.', 'Comments Resource', '{"Content-Type":"application/json"}', 'e19f4724-6daf-46b7-86dc-50fa5de510b4', 'PATCH', 'Comment', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/comments/:COMMENT_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get information about, edit, or delete a comment.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_comments_specific.htm#connect_resources_comments_specific', 'Get information about, edit, like, upvote, verify, or delete a comment. Determine whether the context user can edit a comment.', 'Comments Resource', '{}', '5406660d-aae8-46fe-bf52-912350045493', 'DELETE', 'Comment - Delete', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/comments/:COMMENT_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'A list of all the groups in the organization. Get information about groups or create a group.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_groups_ListOfGroups.htm', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{}', '3f36871b-51dc-4a25-95d3-b8286fab4c79', 'GET', 'List of Groups', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/groups');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Request membership in a private group or get the status of requests to a join a private group.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_groups_GroupMembersRequests.htm', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{}', 'd759fdad-0451-4df2-9bd8-00a5c569ce4c', 'GET', 'Group Members—Private', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/groups/:GROUP_ID/members/requests');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get a Salesforce org’s active theme. A theme uses colors, images, and banners to change the overall appearance of Salesforce. Administrators can define themes and switch themes to provide a different look. The User Interface API response matches the Admin’s selection.', NULL, 'Records', '{}', '15e22514-1311-40d7-a18a-62a5a5814617', 'GET', 'Get a Directory of Supported Objects', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/object-info');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'A list of all the groups in the organization. Get information about groups or create a group.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_groups_ListOfGroups.htm', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{}', '8c11853c-35a7-43a9-9dea-bab73dc1f474', 'POST', 'List of Groups - POST', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/groups');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
   "invitees" : {
      "emails": [
         "testemail1@sfdcpostman.com",
         "testemail2@sfdcpostman.com"
      ]
   },
   "message" : "Join this group to participate in the discussion about your favorite feature."
}', '2021-05-31 13:24:53.598375', 'Invite internal and external users to join a group.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_groups_invites.htm#connect_resources_groups_invites', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{"Content-Type":"application/json"}', 'f5bfc26a-e3d5-4f06-b698-d8bab7f90e0d', 'POST', 'Group Invites', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/groups/group/:GROUP_ID/invite');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Members of a specified group. Get the members and add a member to a group. To add a member, the context user must be the group owner or moderator.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_groups_GroupMembers.htm', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{}', 'a1c83b31-5c94-44c5-a4e0-6c937e9539e0', 'POST', 'Group Members', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/groups/:GROUP_ID/members');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Request membership in a private group or get the status of requests to a join a private group.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_groups_GroupMembersRequests.htm', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{}', 'a232ff43-3ea2-4e53-9e90-d0437d818b98', 'POST', 'Group Members—Private - POST', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/groups/:GROUP_ID/members/requests');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Update the status of a request by a user to join a private group or get information about a request to join a private group.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_group_membership_requests.htm?search_text=group-membership-requests', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{}', '3f35f6b2-8b82-4d52-9b17-737f6d1901ba', 'PATCH', 'Group Membership Requests—Private', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/group-membership-requests/:CHATTER_GROUP_REQUEST_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get, post, and crop a user photo.
To use an image from the Files page as a user photo, pass the file ID in the fileId property of the request body or in the fileId request parameter. Images uploaded on the User page don’t have a file ID and can’t be used as the fileId.

To upload a binary file as the user photo, you must send it in a multipart/form-data message. For information about how to create the multipart/form-data message, see Uploading Binary Files.

To display user profile photos in a feed, cache the user photos. Then use the photoVersionId property of the Photo response body to determine when you need to update a photo. This technique helps you avoid running over limits and may improve mobile client performance.', 'Change the status of a conversation. Get, post, and crop a user photo. Get the most recent user status feed item. Update or delete user status.', 'User Resources', E'{"Content-Type":["multipart/form-data","application/json; charset=UTF-8"],"Content-Disposition":"form-data; name=\\"photo\\""}', '6d5c778f-3789-4782-9dd6-86539439991e', 'POST', 'User Photo', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/user-profiles/me/photo');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns all the messages for all the private conversations for the context user. Also used to search across all messages and post a message.
To return all private conversations for the context user, see User Conversations, General.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_users_messages_general.htm', 'Change the status of a conversation. Get, post, and crop a user photo. Get the most recent user status feed item. Update or delete user status.', 'User Resources', '{}', 'db926436-e5b7-4646-9f0b-d324e5236e8f', 'POST', 'User Messages, General', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/users/me/messages');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of people, groups, records, topics, and files that the specified user is following. Also used to follow records.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_users_FollowingUsers.htm?search_text=following', 'Change the status of a conversation. Get, post, and crop a user photo. Get the most recent user status feed item. Update or delete user status.', 'User Resources', '{}', 'fddece06-4f14-46d3-bce5-1bcc61849e55', 'GET', 'Following', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/users/:USER_ID/following');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of people, groups, records, topics, and files that the specified user is following. Also used to follow records.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_users_FollowingUsers.htm?search_text=following', 'Change the status of a conversation. Get, post, and crop a user photo. Get the most recent user status feed item. Update or delete user status.', 'User Resources', '{}', 'd04614f9-3877-41b9-852c-15fd102942ce', 'POST', 'Following - POST', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/users/:USER_ID/following');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Upload a file, including references to external files, to the Files home or get information about files a user owns. These files don’t include files shared with a user, files a user follows, or general organization files.
When you upload a file to the Files home, it is private and available only to the file owner.

To upload a file, send it in a multipart/form-data request. You can include the description and title of the file in the multipart/form-data request as a JSON or XML request body. You can also send the information as request parameters. For information about how to create the multipart/form-data message, see Uploading Binary Files.
https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_users_files_general.htm', 'A Files Connect repository is an external content repository that’s connected to Salesforce. Use these resources to get a list of repositories, to get information about a repository or a repository file, and to get the content of a repository file. Also use these resources to get information about the files and folders in a repository folder. Use these resources to get a repository’s directory entries, permissions, and permission types. Also use these resources to update a repository’s permissions.', 'Files Connect Repository Resources', '{}', '47fc9a55-5d80-41dd-8386-92cfc0a5b8d4', 'POST', 'Users Files, General', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/files/users/me');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get metadata about a specific object. The response includes metadata describing fields, child relationships, record type, and theme.', NULL, 'Records', '{}', 'c10a0cdd-ba1f-480e-8dc7-719b7b40405e', 'GET', 'Get Object Metadata', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/object-info/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get information about a specified file, including references to external files. Upload a new version of an existing file, including references to external files. Rename a file, move a file to a different folder, and delete a file.
To upload a new version of an existing file, make a POST request. Upload the new version as a binary part in a multipart/form-data request. See Uploading Binary Files. To upload a new file to the Files home, use /connect/files/users/me.Get information about a specified file, including references to external files.
https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_files_information.htm', 'A Files Connect repository is an external content repository that’s connected to Salesforce. Use these resources to get a list of repositories, to get information about a repository or a repository file, and to get the content of a repository file. Also use these resources to get information about the files and folders in a repository folder. Use these resources to get a repository’s directory entries, permissions, and permission types. Also use these resources to update a repository’s permissions.', 'Files Connect Repository Resources', '{}', '4564f40d-2ab3-4db9-9c55-b226531c62e9', 'GET', 'File Information', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/files/:FILE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns the binary content of the file, including references to external files. The content is streamed as the body of the response.
https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_files_content.htm', 'A Files Connect repository is an external content repository that’s connected to Salesforce. Use these resources to get a list of repositories, to get information about a repository or a repository file, and to get the content of a repository file. Also use these resources to get information about the files and folders in a repository folder. Use these resources to get a repository’s directory entries, permissions, and permission types. Also use these resources to update a repository’s permissions.', 'Files Connect Repository Resources', '{}', '95d0ade7-0a80-44db-8c26-96076ae678fd', 'GET', 'File Content', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/files/:FILE_ID/content');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get information about a specified file, including references to external files. Upload a new version of an existing file, including references to external files. Rename a file, move a file to a different folder, and delete a file.
To upload a new version of an existing file, make a POST request. Upload the new version as a binary part in a multipart/form-data request. See Uploading Binary Files. To upload a new file to the Files home, use /connect/files/users/me.Get information about a specified file, including references to external files.
https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_files_information.htm', 'A Files Connect repository is an external content repository that’s connected to Salesforce. Use these resources to get a list of repositories, to get information about a repository or a repository file, and to get the content of a repository file. Also use these resources to get information about the files and folders in a repository folder. Use these resources to get a repository’s directory entries, permissions, and permission types. Also use these resources to update a repository’s permissions.', 'Files Connect Repository Resources', '{}', '2b02765c-7ed1-4f18-9cd0-d83f1fd6f548', 'DELETE', 'File Information - Delete', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/files/:FILE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns information about the objects with which the specified file has been shared. Objects can be users, groups, or records.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_files_shares.htm', 'Information about files, including content, rendered version, and sharing. Information about asset files, including content and rendition.', 'File Resources', '{}', '0b87c9f0-82ca-4999-907e-c694625bf27b', 'GET', 'File Shares', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/files/:FILE_ID/file-shares');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'A description of a file shared as a link. Create, access, and delete a file’s share link.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_files_shares_link.htm', 'Information about files, including content, rendered version, and sharing. Information about asset files, including content and rendition.', 'File Resources', '{}', '96c5ba42-2f3e-471f-a754-f8859fb5dab3', 'PUT', 'Files Shares Link', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/connect/files/:FILE_ID/file-shares/link');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'All feed elements from all groups the context user either owns or is a member of, as well as all files, records, and users the context user follows. Use this resource to get information about feed elements and to post feed elements.

For information about posting a feed element, see Feed Elements, Post and Search.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resource_feeds_news.htm#cc_news_feed_elements', 'Feeds are made up of feed items. There are many feed types. Each feed type has an algorithm that determines which feed items it contains.', 'Feeds Resources', '{}', 'decd4a47-ba33-49dd-86ac-135768aae838', 'GET', 'News Feed Elements', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feeds/news/me/feed-elements');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns feed elements created when a user changes records that can be tracked in a feed, feed elements whose parent is the user, and feed elements that mention the user. This feed is different than the news feed, which returns more feed items, including group updates. You can post feed items to the user-profile feed. You can get another user’s user profile feed.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resource_feeds_user_profile.htm', 'Feeds are made up of feed items. There are many feed types. Each feed type has an algorithm that determines which feed items it contains.', 'Feeds Resources', '{}', '67a282b6-8332-459a-80ac-de0584a8b476', 'GET', 'User Profile Feed Elements', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feeds/user-profile/:USER_ID/feed-elements');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns the feed elements for all the records the context user is following, or all the feed elements of the specified recordId. Use this resource to search a feed or to get the feed elements for a specific feed, including another user’s feed. To use this resource to get the feed elements for a group, specify the group ID as the recordId.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resource_feeds_record.htm', 'Feeds are made up of feed items. There are many feed types. Each feed type has an algorithm that determines which feed items it contains.', 'Feeds Resources', '{}', '4642c407-e901-48b2-8fc0-1dbb749d0a11', 'GET', 'Record Feed Elements', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feeds/record/:RECORD_GROUP_ID/feed-elements');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Feed item and comment bodies have a 10,000 character limit. Because this limit can change, we recommend that clients make a describeSObjects() call on the FeedItem or FeedComment object. To determine the maximum number of allowed characters, look at the length of the Body or CommentBody field.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_feed_element.htm', 'Information about feed elements. Access, edit, post, search, and delete feed elements. Access a feed element’s capabilities, including bundles and their feed elements.
', 'Feed Elements Resource', '{}', 'f793555e-dfa4-4723-833e-608586cbbfdc', 'POST', 'Feed Elements, Post and Search', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feed-elements');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get a favorite.', NULL, 'Favorites', '{}', 'c230f6e0-dde9-418f-90a3-a44c4ba41d92', 'GET', 'Get a Favorite', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites/:FAVORITE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (E'{
   "body": {
      "messageSegments": [
         {
            "type": "Text",
            "text": "Chatter Feed Item Created via API: "
         },
         {
            "markupType" : "Paragraph",
            "type" : "MarkupBegin"
         },
         {
            "markupType" : "Bold",
            "type" : "MarkupBegin"
         },
         {
             "text" : "First line of text.",
             "type" : "Text"
         },
         {
            "markupType" : "Bold",
            "type" : "MarkupEnd"
         },
         {
            "markupType" : "Paragraph",
            "type" : "MarkupEnd"
         },
         {
            "markupType" : "Paragraph",
            "type" : "MarkupBegin"
         },
         {
            "text" : "&nbsp;",
            "type" : "Text"
         },
         {
            "markupType" : "Paragraph",
            "type" : "MarkupEnd"
         },
         {
            "markupType" : "Paragraph",
            "type" : "MarkupBegin"
         },
         {
            "text" : "Second line of text.",
            "type" : "Text"
         },
         {
            "markupType" : "Paragraph",
            "type" : "MarkupEnd"
         },
         {
            "markupType" : "Code",
            "type" : "MarkupBegin"
         },
         {
             "text" : "<script>\\nvar i, t = 0;\\nfor (i = 0; i < 5; i++) {\\n   t += i;\\n}\\n</script>",
             "type" : "Text"
         },
         {
            "markupType" : "Code",
            "type" : "MarkupEnd"
         },
         {
            "type": "Mention",
            "id": "<USER_GROUP_ID>"
         }
      ]
   },
   "capabilities": {
      "files": {
         "items": [
            {
               "id": "<FILE_ID>"
            }
         ]
      }
   },
   "subjectId": "<USER_RECORD_GROUP_ID>",
   "feedElementType": "FeedItem"
}', '2021-05-31 13:24:53.598375', 'https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_feed_element.htm

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_feed_element.htm', 'Information about feed elements. Access, edit, post, search, and delete feed elements. Access a feed element’s capabilities, including bundles and their feed elements.
', 'Feed Elements Resource', '{"Content-Type":"application/json"}', '2d0a8b8e-8fd7-4d54-834a-e34675aa517d', 'POST', 'Feed Elements, Post and Search', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feed-elements');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "inputs": [
        {
            "richInput": {
                "subjectId": "<USER_GROUP_RECORD_ID>",
                "body": {
                    "messageSegments": [
                        {
                            "type": "Text",
                            "text": "Post Number 1"
                        }
                    ]
                },
                "capabilities": {
                    "files": {
                        "items": [
                            {
                                "id": "<FILE_ID>"
                            }
                        ]
                    }
                },
                "feedElementType": "FeedItem"
            }
        },
        {
            "richInput": {
                "subjectId": "<USER_GROUP_RECORD_ID>",
                "body": {
                    "messageSegments": [
                        {
                            "type": "Text",
                            "text": "Post Number 2"
                        }
                    ]
                },
                "feedElementType": "FeedItem"
            }
        },
        {
            "richInput": {
                "subjectId": "me",
                "body": {
                    "messageSegments": [
                        {
                            "type": "Text",
                            "text": "Post Number 3 with Inline"
                        },
                        {
                            "type": "InlineImage",
                            "fileId": "<FILE_ID>",
                            "altText": "Test Inline"
                        }
                    ]
                },
                "feedElementType": "FeedItem"
            }
        }
    ]
}', '2021-05-31 13:24:53.598375', 'Post a batch of up to 500 feed elements.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_feed_element_batch_post.htm', 'Information about feed elements. Access, edit, post, search, and delete feed elements. Access a feed element’s capabilities, including bundles and their feed elements.
', 'Feed Elements Resource', '{"Content-Type":"application/json"}', '92b364a2-b40e-463d-8db9-a03dd811af1e', 'POST', 'Feed Elements, Batch Post', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feed-elements/batch');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Access, edit, or delete a feed element. Feed items are the only type of feed element that can be edited.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_feed_element_specific.htm', 'Information about feed elements. Access, edit, post, search, and delete feed elements. Access a feed element’s capabilities, including bundles and their feed elements.
', 'Feed Elements Resource', '{}', '2bccf11c-1823-468b-ac24-e710ed5427f1', 'DELETE', 'Feed Element - Delete', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feed-elements/:FEED_ELEMENT_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Access comments for a feed element, or add a comment to a feed element.
To upload a binary file to attach to a comment, you must send it in a multipart/form-data request. To send the text of the comment, you can choose to include a JSON or XML rich input body part in the multipart/form-data request. Alternately, you can choose to pass the information in request parameter parts. For information about how to create the multipart/form-data message, see Uploading Binary Files.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_feed_element_capability_comments_items.htm#connect_resources_feed_element_capability_comments_items', 'Information about feed elements. Access, edit, post, search, and delete feed elements. Access a feed element’s capabilities, including bundles and their feed elements.
', 'Feed Elements Resource', '{}', 'a350d1c2-19e6-4863-9b28-c20fa29b316b', 'POST', 'Feed Elements Capability, Comments Items', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/feed-elements/:FEED_ELEMENT_ID/capabilities/comments/items');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "body": {
        "messageSegments": [
            {
                "type": "Text",
                "text": "Editing a comment"
            }
        ]
    }
}', '2021-05-31 13:24:53.598375', 'Get information about, edit, or delete a comment.
To post a comment, use Feed Elements Capability, Comments Items.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_comments_specific.htm#connect_resources_comments_specific', 'Get information about, edit, like, upvote, verify, or delete a comment. Determine whether the context user can edit a comment.', 'Comments Resource', '{"Content-Type":"application/json"}', 'adea8b7e-fa5a-49f2-be57-ae5bfd47912d', 'PATCH', 'Comment', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/comments/:COMMENT_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get information about, edit, or delete a comment.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_comments_specific.htm#connect_resources_comments_specific', 'Get information about, edit, like, upvote, verify, or delete a comment. Determine whether the context user can edit a comment.', 'Comments Resource', '{}', '6c5ef525-45d7-41df-aa18-ec89f2e631e7', 'DELETE', 'Comment - Delete', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/comments/:COMMENT_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'A list of all the groups in the organization. Get information about groups or create a group.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_groups_ListOfGroups.htm', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{}', '6551e644-80db-4bd4-b01c-809860f7e8ff', 'GET', 'List of Groups', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/groups');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Request membership in a private group or get the status of requests to a join a private group.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_groups_GroupMembersRequests.htm', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{}', 'b718a165-bd53-46d3-bef8-0c3e4a37a8cd', 'GET', 'Group Members—Private', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/groups/:GROUP_ID/members/requests');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'A list of all the groups in the organization. Get information about groups or create a group.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_groups_ListOfGroups.htm', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{}', '02471708-4d8b-4217-bb62-c16b4ee58e96', 'POST', 'List of Groups - POST', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/groups');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
   "invitees" : {
      "emails": [
         "testemail1@sfdcpostman.com",
         "testemail2@sfdcpostman.com"
      ]
   },
   "message" : "Join this group to participate in the discussion about your favorite feature."
}', '2021-05-31 13:24:53.598375', 'Invite internal and external users to join a group.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_groups_invites.htm#connect_resources_groups_invites', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{"Content-Type":"application/json"}', '76b63352-00e4-4b9f-94ec-df9232c4817f', 'POST', 'Group Invites', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/groups/group/:GROUP_ID/invite');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Members of a specified group. Get the members and add a member to a group. To add a member, the context user must be the group owner or moderator.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_groups_GroupMembers.htm', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{}', '1bd3d8c7-60bb-4d0f-b7c7-3bd6f59019be', 'POST', 'Group Members', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/groups/:GROUP_ID/members');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Request membership in a private group or get the status of requests to a join a private group.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_groups_GroupMembersRequests.htm', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{}', '03ffe520-3e00-4a64-b149-0d0af5c6c1c8', 'POST', 'Group Members—Private - POST', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/groups/:GROUP_ID/members/requests');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Update the status of a request by a user to join a private group or get information about a request to join a private group.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_group_membership_requests.htm?search_text=group-membership-requests', 'Information about groups, such as the group''s members, photo, and the groups in the organization. Create and delete a group, add members to a group, and change the group photo.', 'Groups Resources', '{}', '60444c2f-0921-4c9e-8675-2aeeba3496c4', 'PATCH', 'Group Membership Requests—Private', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/group-membership-requests/:CHATTER_GROUP_REQUEST_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Information about the specified subscription. Also used to delete a subscription, for example, to unfollow a record or a topic.
A subscription ID is returned as part of the response body for follower and following resources, for example, /records/recordId/followers. In addition, subscriptions IDs are also returned in many summary response bodies, such as group summary or user summary.

https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/connect_resources_subscriptions.htm', 'Integrate mobile apps, intranet sites, and third-party web applications with Salesforce using Connect REST API. Responses are localized, structured for presentation, and can be filtered to contain only what the app needs.

Connect REST API provides programmatic access to B2B Commerce on Lightning, CMS managed content, communities, files, notifications, topics, and more. Use Connect REST API to display Chatter feeds, users, and groups, especially in mobile applications.

📚 [Connect REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.chatterapi.meta/chatterapi/intro_what_is_chatter_connect.htm)', 'Connect (Chatter)', '{}', '93b101a5-3058-4909-94c9-3e7411f6f779', 'DELETE', 'Subscriptions Resource - DELETE', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/chatter/subscriptions/:SUBSCRIPTION_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'The Configuration Loader API returns all the data for the product, including its product options and configuration model. When configuring a nested bundle, set the parentProductproperty to the parent product to inherit configuration attributes on the nested bundle.
Available in: Salesforce CPQ Spring ’17 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_config_loader.htm', NULL, 'Configuration API', '{"Content-Type":"application/json"}', 'ac6e6b4c-61dd-4004-85e4-5cde7a16c7e9', 'PATCH', 'Configuration Loader API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'The Configuration Load Rule Executor API invokes all the load event product rules for the specified product. When configuring a nested bundle, set the parentProduct property to the parent product to inherit configuration attributes on the nested bundle.
Available in: Salesforce CPQ Spring ’17 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_config_loadruleexecutor.htm', NULL, 'Configuration API', '{"Content-Type":"application/json"}', 'ac9131e4-b754-4bdc-8eb8-2b3fe39d7723', 'PATCH', 'Configuration Load Rule Executor API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'The Configuration Validator API runs selection, validation, and alert product rules and configurator-scoped price rules against the input configuration model and returns an updated configuration model.
Available in: Salesforce CPQ Spring ’17 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_config_validator.htm', NULL, 'Configuration API', '{"Content-Type":"application/json"}', '5005981d-e5ae-4ff0-83b5-617d28d213f9', 'PATCH', 'Configuration Validator API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Receive a CPQ contract ID in a request, and return quote data for an amendment quote.
Available in: Salesforce CPQ Summer ’16 and later
Special Access Rules: All of these user permissions are required.
Insert and update on quote and opportunity objects
Read on quote, opportunity, and product2 objects
Delete on quote object

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_contract_amender.htm', NULL, 'Contract API', '{"Content-Type":"application/json"}', 'be60e420-4d13-4f4f-9dcf-b280602f2655', 'PATCH', 'Contract Amender API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "context": {
        "masterContractId": null,
        "renewedContracts": [
            {
                "attributes": {
                    "type": "Contract"
                },
                "Id": "800540000006LLVAA2"
            }
        ]
    }
}', '2021-05-31 13:24:53.598375', 'Receive a CPQ contract in a request, and return quote data for one or more renewal quotes.
Available in: Salesforce CPQ Summer ’16 and later
Special Access Rules: All of these user permissions are required.
Insert and update on quote and opportunity objects
Read on quote, opportunity, and product2 objects
Delete on quote object

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_contract_renewer.htm', NULL, 'Contract API', '{"Content-Type":"application/json"}', '7c92ac7f-4808-44ef-99e5-f4b1979d6c89', 'PATCH', 'Contract Renewer API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_quote_model_9.htm', '2021-05-31 13:24:53.598375', 'The Save Quote API saves a CPQ quote.
Available in: Salesforce CPQ Summer ’16 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_quote_api_save_final.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', '79d061ab-9b17-45c5-bc8a-6a1e39f7e9f1', 'POST', 'Save Quote API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_quote_model_9.htm#cpq_api_quote_model_9', '2021-05-31 13:24:53.598375', 'The Calculate Quote API calculates the prices of a CPQ quote.

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_quote_api_calculate_final.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', '7b301fd5-2147-4d6d-9e6c-4b7c4fbcf5cf', 'PATCH', 'Calculate Quote API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_quote_model_9.htm#cpq_api_quote_model_9', '2021-05-31 13:24:53.598375', 'The Read Quote API reads a quote from a CPQ quote ID.
Available in: Salesforce CPQ Summer ’16 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_read_quote.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', 'a14d1e7d-9c3f-41b4-ba82-9ec16830957a', 'GET', 'Read Quote API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_quote_model_9.htm#cpq_api_quote_model_9', '2021-05-31 13:24:53.598375', 'Validate a CPQ quote and return any validation errors.
Available in: Salesforce CPQ Winter ’19 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_validate_quote.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', 'd2e4648c-92fd-4fc7-a731-88b2a15848d5', 'PATCH', 'Validate Quote API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_quote_model_9.htm#cpq_api_quote_model_9', '2021-05-31 13:24:53.598375', 'Receive a CPQ quote, product collection, and quote group key in a request, and return a Quote model with all provided products added as quote lines.
Available in: Salesforce CPQ Summer ’16 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_add_products.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', '472c9fd0-da95-4191-88ae-4f46d58ca746', 'PATCH', 'Add Products API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{"context" : {"pricebookId": "01sA0000000wuhg", "currencyCode":"USD"}}', '2021-05-31 13:24:53.598375', 'The Read Product API takes the request’s product ID, pricebook ID, and currency code and returns a Product model. The Product model loads the product from your catalog when the user requests it.
Available in: Salesforce CPQ Summer ’16 and later
Special Access Rules: Users must have read access to the product2 object.

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_read_product.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', 'b37eaa67-0a1e-4dd3-a9ed-45365be5f866', 'PATCH', 'Read Product API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "saver": "SBQQ.QuoteDocumentAPI.Save",
    "model": {
        "name": "test",
        "quoteId": "<SFDC_ID>",
        "templateId": "<SFDC_ID>",
        "outputFormat": "PDF",
        "language": "en_US",
        "paperSize": "Default"
    }
}', '2021-05-31 13:24:53.598375', 'The Read Product API takes the request’s product ID, pricebook ID, and currency code and returns a Product model. The Product model loads the product from your catalog when the user requests it.
Available in: Salesforce CPQ Summer ’16 and later
Special Access Rules: Users must have read access to the product2 object.

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_read_product.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', 'cd43751d-2bea-46a4-9bbd-fcf597a588c4', 'POST', 'Create and Save Quote Proposal API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "context": {
        "templateId": "a0v5C000000jTgr",
        "language": "es"
    }
}', '2021-05-31 13:24:53.598375', 'The Read Product API takes the request’s product ID, pricebook ID, and currency code and returns a Product model. The Product model loads the product from your catalog when the user requests it.
Available in: Salesforce CPQ Summer ’16 and later
Special Access Rules: Users must have read access to the product2 object.

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_read_product.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', 'f98c7b5c-9849-47ce-bd4a-b03aacfbea63', 'PATCH', 'Quote Term Reader API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'The Configuration Loader API returns all the data for the product, including its product options and configuration model. When configuring a nested bundle, set the parentProductproperty to the parent product to inherit configuration attributes on the nested bundle.
Available in: Salesforce CPQ Spring ’17 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_config_loader.htm', NULL, 'Configuration API', '{"Content-Type":"application/json"}', 'a3ca45ac-b6a1-4a0b-9417-da3e90528a71', 'PATCH', 'Configuration Loader API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'The Configuration Load Rule Executor API invokes all the load event product rules for the specified product. When configuring a nested bundle, set the parentProduct property to the parent product to inherit configuration attributes on the nested bundle.
Available in: Salesforce CPQ Spring ’17 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_config_loadruleexecutor.htm', NULL, 'Configuration API', '{"Content-Type":"application/json"}', 'e38dccbd-1428-40aa-8d22-d46451a9ebc4', 'PATCH', 'Configuration Load Rule Executor API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'The Configuration Validator API runs selection, validation, and alert product rules and configurator-scoped price rules against the input configuration model and returns an updated configuration model.
Available in: Salesforce CPQ Spring ’17 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_config_validator.htm', NULL, 'Configuration API', '{"Content-Type":"application/json"}', '26a1ff71-539f-417c-8439-f3ee6e96c88d', 'PATCH', 'Configuration Validator API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Receive a CPQ contract ID in a request, and return quote data for an amendment quote.
Available in: Salesforce CPQ Summer ’16 and later
Special Access Rules: All of these user permissions are required.
Insert and update on quote and opportunity objects
Read on quote, opportunity, and product2 objects
Delete on quote object

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_contract_amender.htm', NULL, 'Contract API', '{"Content-Type":"application/json"}', 'e2d8d71a-b349-4089-a6c7-47ff61702bc8', 'PATCH', 'Contract Amender API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "context": {
        "masterContractId": null,
        "renewedContracts": [
            {
                "attributes": {
                    "type": "Contract"
                },
                "Id": "800540000006LLVAA2"
            }
        ]
    }
}', '2021-05-31 13:24:53.598375', 'Receive a CPQ contract in a request, and return quote data for one or more renewal quotes.
Available in: Salesforce CPQ Summer ’16 and later
Special Access Rules: All of these user permissions are required.
Insert and update on quote and opportunity objects
Read on quote, opportunity, and product2 objects
Delete on quote object

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_contract_renewer.htm', NULL, 'Contract API', '{"Content-Type":"application/json"}', '118d8f84-3e2b-4944-8754-d1b40c5e217b', 'PATCH', 'Contract Renewer API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_quote_model_9.htm', '2021-05-31 13:24:53.598375', 'The Save Quote API saves a CPQ quote.
Available in: Salesforce CPQ Summer ’16 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_quote_api_save_final.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', 'aa79dfed-112b-470b-ae91-9dec55a276a4', 'POST', 'Save Quote API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_quote_model_9.htm#cpq_api_quote_model_9', '2021-05-31 13:24:53.598375', 'The Calculate Quote API calculates the prices of a CPQ quote.

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_quote_api_calculate_final.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', '8d8a2a70-ed05-4b49-a644-3ed944904c71', 'PATCH', 'Calculate Quote API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_quote_model_9.htm#cpq_api_quote_model_9', '2021-05-31 13:24:53.598375', 'The Read Quote API reads a quote from a CPQ quote ID.
Available in: Salesforce CPQ Summer ’16 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_read_quote.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', '09f4facc-441e-4837-b675-f96e06dfe480', 'GET', 'Read Quote API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get metadata about a specific object. The response includes metadata describing fields, child relationships, record type, and theme.', NULL, 'Records', '{}', 'a5b9d3e1-27d1-483d-8771-9b1081c8567f', 'GET', 'Get Values for a Picklist Field', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/object-info/:SOBJECT_API_NAME/picklist-values/:RECORD_TYPE_ID/:FIELD_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_quote_model_9.htm#cpq_api_quote_model_9', '2021-05-31 13:24:53.598375', 'Receive a CPQ quote, product collection, and quote group key in a request, and return a Quote model with all provided products added as quote lines.
Available in: Salesforce CPQ Summer ’16 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_add_products.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', 'f04764e1-fac6-4e51-8d98-2d6e31c05a9d', 'PATCH', 'Add Products API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{"context" : {"pricebookId": "01sA0000000wuhg", "currencyCode":"USD"}}', '2021-05-31 13:24:53.598375', 'The Read Product API takes the request’s product ID, pricebook ID, and currency code and returns a Product model. The Product model loads the product from your catalog when the user requests it.
Available in: Salesforce CPQ Summer ’16 and later
Special Access Rules: Users must have read access to the product2 object.

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_read_product.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', '487e47f6-f2bb-4d86-bfe9-4623e9869771', 'PATCH', 'Read Product API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "saver": "SBQQ.QuoteDocumentAPI.Save",
    "model": {
        "name": "test",
        "quoteId": "<SFDC_ID>",
        "templateId": "<SFDC_ID>",
        "outputFormat": "PDF",
        "language": "en_US",
        "paperSize": "Default"
    }
}', '2021-05-31 13:24:53.598375', 'The Read Product API takes the request’s product ID, pricebook ID, and currency code and returns a Product model. The Product model loads the product from your catalog when the user requests it.
Available in: Salesforce CPQ Summer ’16 and later
Special Access Rules: Users must have read access to the product2 object.

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_read_product.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', 'd5572826-147e-4a66-97ba-ef777ab51308', 'POST', 'Create and Save Quote Proposal API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "context": {
        "templateId": "a0v5C000000jTgr",
        "language": "es"
    }
}', '2021-05-31 13:24:53.598375', 'The Read Product API takes the request’s product ID, pricebook ID, and currency code and returns a Product model. The Product model loads the product from your catalog when the user requests it.
Available in: Salesforce CPQ Summer ’16 and later
Special Access Rules: Users must have read access to the product2 object.

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_read_product.htm', NULL, 'Quote API', '{"Content-Type":"application/json"}', 'd98c7c25-3213-4b34-9485-e5c7c0433b98', 'PATCH', 'Quote Term Reader API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "saver": "SBQQ.QuoteDocumentAPI.Save",
    "model": {
        "name": "test",
        "quoteId": "<SFDC_ID>",
        "templateId": "<SFDC_ID>",
        "outputFormat": "PDF",
        "language": "en_US",
        "paperSize": "Default"
    }
}', '2021-05-31 13:24:53.598375', 'Creates and saves a CPQ quote document.
Available in: Salesforce CPQ Winter ’19 and later

https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_api_generate_proposal.htm', 'Start working with Salesforce CPQ APIs.

📚 [Salesforce CPQ Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_api.meta/cpq_dev_api/cpq_developer_guide_intro.htm)', 'CPQ', '{"Content-Type":"application/json"}', '3a8f4894-749d-4ec3-b882-d56c506ba2b4', 'POST', 'Generate Quote Document API', '2021-05-31 13:24:53.598375', 'services/apexrest/SBQQ/ServiceRouter');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, NULL, 'Metadata REST', '{}', '81a2b7e8-2cab-460a-bcb2-6cb53b0cb62a', 'GET', 'Deploy Request Status', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/metadata/deployRequest/<deployRequestId>');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{ 
    "deployResult":
    {
        "status" : "Canceling"
    }
}
', '2021-05-31 13:24:53.598375', NULL, NULL, 'Metadata REST', '{}', '178a35ae-2186-4ccd-95bb-d67006abf67f', 'PATCH', 'Deploy Request Cancellation', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/metadata/deployRequest/<deployRequestId>');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, NULL, 'Metadata REST', '{}', '3d8b4d48-bbbd-4fdf-a8a2-faa7de282956', 'POST', 'Deploy Request', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/metadata/deployRequest');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{ 
    "validatedDeployRequestId" : "<validatedDeployRequestId>"
}', '2021-05-31 13:24:53.598375', NULL, NULL, 'Metadata REST', '{}', '53a48a16-97db-4054-8ae2-df69eb8cea3a', 'POST', 'Deploy Request Previously Validated (Quick Deploy)', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/metadata/deployRequest/<validatedDeployRequestId>');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, NULL, 'Metadata REST', '{}', '006bc6c0-40c2-4aac-83c1-fb2baa34c151', 'GET', 'Deploy Request Status', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/metadata/deployRequest/<deployRequestId>');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{ 
    "deployResult":
    {
        "status" : "Canceling"
    }
}
', '2021-05-31 13:24:53.598375', NULL, NULL, 'Metadata REST', '{}', '9ef609c2-180d-4739-9aa3-72cdfbac3db9', 'PATCH', 'Deploy Request Cancellation', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/metadata/deployRequest/<deployRequestId>');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, NULL, 'Metadata REST', '{}', 'ef0d6098-954f-4f4d-b159-08d2890e524d', 'POST', 'Deploy Request', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/metadata/deployRequest');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{ 
    "validatedDeployRequestId" : "<validatedDeployRequestId>"
}', '2021-05-31 13:24:53.598375', NULL, NULL, 'Metadata REST', '{}', '44b92ec9-4434-4b7d-99c7-5addf1ad47cb', 'POST', 'Deploy Request Previously Validated (Quick Deploy)', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/metadata/deployRequest/<validatedDeployRequestId>');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://soap.sforce.com/2006/04/metadata">
	<soapenv:Header>
	<tns:SessionHeader>
		<tns:sessionId>{{_accessToken}}</tns:sessionId>
	</tns:SessionHeader>
	</soapenv:Header>
	<soapenv:Body>
		<tns:describeMetadata>
			<asOfVersion>{{version}}</asOfVersion>
		</tns:describeMetadata>
	</soapenv:Body>
</soapenv:Envelope>', '2021-05-31 13:24:53.598375', NULL, 'Use Metadata API to retrieve, deploy, create, update or delete customization information, such as custom object definitions and page layouts, for your organization. This API is intended for managing customizations and for building tools that can manage the metadata model, not the data itself. To create, retrieve, update or delete records, such as accounts or leads, use data SOAP API or REST API.

📚 [Metadata API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_intro.htm)', 'Metadata', '{"Content-Type":"text/xml","charset":"UTF-8","SOAPAction":"login","Accept":"text/xml"}', '9ef07a2d-520a-44ac-90b5-10851e4342f5', 'POST', 'SOAP DescribeMetadata', '2021-05-31 13:24:53.598375', 'services/Soap/m/{{version}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://soap.sforce.com/2006/04/metadata">
	<soapenv:Header>
	<tns:SessionHeader>
		<tns:sessionId>{{_accessToken}}</tns:sessionId>
	</tns:SessionHeader>
	</soapenv:Header>
	<soapenv:Body>
		<tns:describeValueType>
			<type>{http://soap.sforce.com/2006/04/metadata}INSERT_METADATA_TYPE_NAME</type>
		</tns:describeValueType>
	</soapenv:Body>
</soapenv:Envelope>', '2021-05-31 13:24:53.598375', NULL, 'Use Metadata API to retrieve, deploy, create, update or delete customization information, such as custom object definitions and page layouts, for your organization. This API is intended for managing customizations and for building tools that can manage the metadata model, not the data itself. To create, retrieve, update or delete records, such as accounts or leads, use data SOAP API or REST API.

📚 [Metadata API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_intro.htm)', 'Metadata', '{"Content-Type":"text/xml","charset":"UTF-8","SOAPAction":"login","Accept":"text/xml"}', 'f59cb413-3967-4289-ac69-8901968c8c0d', 'POST', 'SOAP DescribeValueType', '2021-05-31 13:24:53.598375', 'services/Soap/m/{{version}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get all of a user’s favorites.', NULL, 'Favorites', '{}', 'bfd95f13-e096-4cad-8ba4-2d64f834078a', 'GET', 'Get Favorites', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://soap.sforce.com/2006/04/metadata">
    <soapenv:Header>
        <tns:SessionHeader>
            <tns:sessionId>{{_accessToken}}</tns:sessionId>
        </tns:SessionHeader>
    </soapenv:Header>
    <soapenv:Body>
        <tns:listMetadata>
            <listMetadataQuery>
                <type>CustomObject</type>
                <folder></folder>
            </listMetadataQuery>
            <asOfVersion>{{version}}</asOfVersion>
        </tns:listMetadata>
    </soapenv:Body>
</soapenv:Envelope>', '2021-05-31 13:24:53.598375', '`type`: Replace the value of `type` with the metadata type you''re interested in

`folder`: If your type requires a folder add it here. Null values are ignored

e.g. 

```<type>CustomObject</type>
<folder></folder>```

or

```<type>Dashboard</type>
<folder>Service_Dashboards</folder>```', 'Use Metadata API to retrieve, deploy, create, update or delete customization information, such as custom object definitions and page layouts, for your organization. This API is intended for managing customizations and for building tools that can manage the metadata model, not the data itself. To create, retrieve, update or delete records, such as accounts or leads, use data SOAP API or REST API.

📚 [Metadata API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_intro.htm)', 'Metadata', '{"Content-Type":"text/xml","charset":"UTF-8","SOAPAction":"login","Accept":"text/xml"}', '70e04d03-1045-41b1-a57f-3c2894b63fcc', 'POST', 'SOAP List Metadata', '2021-05-31 13:24:53.598375', 'services/Soap/m/{{version}}');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
"FirstName":"Test",
"LastName":"API"
}
', '2021-05-31 13:24:53.598375', 'Lists summary information about each Salesforce version currently available, including the version, label, and a link to each version''s root.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'e280a51b-e867-4916-bff4-6ad9027158c8', 'GET', 'Versions', '2021-05-31 13:24:53.598375', 'services/data');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Lists available resources for the specified API version, including resource name and URI.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '2c6c1da7-c695-46e1-9835-81f2475a273e', 'GET', 'Resources by Version', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Lists information about limits in your org. For each limit, this resource returns the maximum allocation and the remaining allocation based on usage. This resource is available in REST API version 29.0 and later for API users with the View Setup and Configuration permission', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{}', '88ac7893-8570-4301-9dbd-edce5773100e', 'GET', 'Limits', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/limits');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Lists the available objects and their metadata for your organization’s data. In addition, it provides the organization encoding, as well as the maximum batch size permitted in queries.

You can use the If-Modified-Since header with this resource, with the date format EEE, dd MMM yyyy HH:mm:ss z. When using this header, if no available object’s metadata has changed since the provided date, a 304 Not Modified status code is returned with no response body.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'fda472e8-9ee8-4426-9582-bbfd43f5a63a', 'GET', 'Describe Global', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Describes the individual metadata for the specified object. Can also be used to create a new record for a given object. For example, this can be used to retrieve the metadata for the Account object using the GET method, or create a new Account object using the POST method.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'e3b6c895-a42c-43f0-bd22-ce701c325a64', 'GET', 'SObject Basic Information', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "Name": "test"
}', '2021-05-31 13:24:53.598375', NULL, 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '92990fb6-6ac5-4dfb-83e0-ab97f1e7a4d0', 'POST', 'SObject Create', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Set, reset, or get information about a user password. This resource is available in REST API version 24.0 and later.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'b1fda616-14e0-44b4-91a7-e99abbcad727', 'GET', 'Platform Event Schema by Event Name', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:EVENT_NAME/eventSchema');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Describes the individual metadata for the specified object. Can also be used to create a new record for a given object. For example, this can be used to retrieve the metadata for the Account object using the GET method, or create a new Account object using the POST method.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'd6af5e69-2a1f-4096-9910-030c76a00385', 'GET', 'SObject Describe', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/describe');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Retrieves the list of individual records that have been deleted within the given timespan for the specified object. SObject Get Deleted is available in API version 29.0 and later.

This resource is commonly used in data replication applications. Note the following considerations:
Deleted records are written to a delete log which this resource accesses. A background process that runs every two hours purges records that have been in an organization''s delete log for more than two hours if the number of records is above a certain limit. Starting with the oldest records, the process purges delete log entries until the delete log is back below the limit. This is done to protect Salesforce from performance issues related to massive delete logs
Information on deleted records are returned only if the current session user has access to them.
Results are returned for no more than 15 days previous to the day the call is executed (or earlier if an administrator has purged the Recycle Bin).', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '0d3e678a-9a25-4b46-908a-6e209d2d0582', 'GET', 'SObject Get Deleted', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/deleted/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Retrieves the list of individual records that have been updated (added or changed) within the given timespan for the specified object. SObject Get Updated is available in API version 29.0 and later.

This resource is commonly used in data replication applications. Note the following considerations:
Results are returned for no more than 30 days previous to the day the call is executed.
Your client application can replicate any objects to which it has sufficient permissions. For example, to replicate all data for your organization, your client application must be logged in with “View All Data” access rights to the specified object. Similarly, the objects must be within your sharing rules.
There is a limit of 600,000 IDs returned from this resource. If more than 600,000 IDs would be returned, EXCEEDED_ID_LIMIT is returned. You can correct the error by choosing start and end dates that are closer together.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'd9befc03-6bf6-47a9-a786-965bbce89881', 'GET', 'SObject Get Updated', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/updated/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Retrieves information about alternate named layouts for a given object.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '15f8c627-7a15-4d42-bf8c-5a38311d11b5', 'GET', 'SObject Named Layouts', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/describe/namedLayouts/:LAYOUT_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Accesses records based on the specified object ID. Retrieves, updates, or deletes records. This resource can also be used to retrieve field values. Use the GET method to retrieve records or fields, the DELETE method to delete records, and the PATCH method to update records.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'b0f4de24-50ec-4183-a5f2-9267eaa5016f', 'GET', 'SObject Rows', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
	"field API name": "value"
}', '2021-05-31 13:24:53.598375', 'Accesses records based on the specified object ID. Retrieves, updates, or deletes records. This resource can also be used to retrieve field values. Use the GET method to retrieve records or fields, the DELETE method to delete records, and the PATCH method to update records.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '8cc3174a-74b6-4e66-8b99-a1771af15966', 'PATCH', 'SObject Rows Update', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get metadata about a specific object. The response includes metadata describing fields, child relationships, record type, and theme.', NULL, 'Records', '{}', '3143de5b-0fde-4d3b-89f9-947eb5e6bef3', 'GET', 'Get Values for All Picklist Fields of a Record Type', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/object-info/:SOBJECT_API_NAME/picklist-values/:RECORD_TYPE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get child records for a specified record and child relationship name. Relationships are connections between records. On a record detail page, each record in a related list has a child relationship to the parent record.', NULL, 'Records', '{}', '04a5fc61-7182-4466-b860-3914c7106966', 'GET', 'Get Child Records', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/records/:RECORD_ID/child-relationships/:RELATIONSHIP_NAME
');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Accesses records based on the specified object ID. Retrieves, updates, or deletes records. This resource can also be used to retrieve field values. Use the GET method to retrieve records or fields, the DELETE method to delete records, and the PATCH method to update records.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '951071b5-8553-420a-98dd-81473086560e', 'DELETE', 'SObject Rows Delete', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Creates new records or updates existing records (upserts records) based on the value of a specified external ID field.

If the specified value doesn''t exist, a new record is created.
If a record does exist with that value, the field values specified in the request body are updated.
If the value is not unique, the REST API returns a 300 response with the list of matching records.

HEAD, GET, PATCH, DELETE, POST', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '3f5f1cb9-173f-47a1-b1f2-917ca0e83399', 'GET', 'SObject Rows by External ID', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/:FIELD_NAME/:FIELD_VALUE');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Retrieves the specified blob field from an individual record.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '81b9a182-d494-4372-bb55-7db7d1217a3f', 'GET', 'SObject Blob Retrieve', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/:RECORD_ID/:BLOB_FIELD');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of approval layouts for a specified object. Specify a particular approval process name to limit the return value to one specific approval layout. This resource is available in REST API version 30.0 and later.

approvalProcessName parameter is optional', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'b9a19e51-3fc5-42ca-8496-5815ce591257', 'GET', 'SObject ApprovalLayouts', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/describe/approvalLayouts/:APPROVAL_PROCESS_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of compact layouts for a specific object. This resource is available in REST API version 29.0 and later.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '2e134fc5-d264-45a7-8508-098036db0973', 'GET', 'SObject CompactLayouts', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/describe/describe/compactLayouts');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of layouts and descriptions. The list of fields and the layout name are returned.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'ebb8735c-6fa2-4b5d-a8b6-b3c896cd5a0d', 'GET', 'Describe Global Layouts', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/Global/describe/layouts/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of layouts and descriptions. The list of fields and the layout name are returned.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '97cecb95-d693-4be3-9aab-d90585711b64', 'GET', 'Describe SObject Layouts', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/describe/layouts/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of layouts and descriptions. The list of fields and the layout name are returned.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '85b319ee-c783-4b18-a347-0f1b06ccc434', 'GET', 'Describe SObject Layouts Per Record Type', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/describe/layouts/:RECORD_TYPE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get a record’s data.', NULL, 'Records', '{}', '9aa92d3a-dcb3-4a9f-a3d0-6fb8d6951e60', 'GET', 'Get a Record', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/records/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get data for a batch of records.', NULL, 'Records', '{}', 'dde3b6f8-7fb3-4fc3-8cc4-1d1aeed6b7cb', 'GET', 'Get a Batch of Records', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/records/batch/:RECORD_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'PlatformAction is a virtual read-only object. It enables you to query for actions displayed in the UI, given a user, a context, device format, and a record ID. Examples include standard and custom buttons, quick actions, and productivity actions.
Returns the description of the PlatformAction.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '900fa9ce-e1e2-4e3d-8306-5f6e68cf0e15', 'GET', 'SObject PlatformAction', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/PlatformAction');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of actions and their details. This resource is available in REST API version 28.0 and later. When working with actions, also refer to Quick Actions.

To return a specific object’s actions as well as global actions, use: /vXX.X/sobjects/object/quickActions/
To return a specific action, use /vXX.X/sobjects/object/quickActions/{action name}
To return a specific action’s descriptive detail, use /vXX.X/sobjects/object/quickActions/{action name}/describe/
To return a specific action’s default values, including default field values, use services/data/vXX.X/sobjects/object/quickActions/{action name}/defaultValues/
In API version 28.0, to evaluate the default values for an action, use vXX.X/sobjects/object/quickActions/{action name}/defaultValues/{parent id}
In API version 29.0 and greater, to evaluate the default values for an action, use vXX.X/sobjects/object/quickActions/{action name}/defaultValues/{context id}
This returns the default values specific to the {context id} object.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '82b7a5b8-3be1-4a5f-8f3a-71d92e84e98e', 'GET', 'SObject Quick Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/quickActions/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Retrieves the specified image data from a specific rich text area field in a given record.
contentReferenceId	The reference ID that uniquely identifies an image within a rich text area field.
You can obtain the reference by retrieving information for the object. The description will show the contents of the rich text area field', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'c53b1070-cca9-4319-a7c9-07cfdcb021a4', 'GET', 'SObject Rich Text Image Retrieve', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/:RECORD_ID/richTextImageFields/:FIELD_NAME/:CONTENT_REFERENCE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Accesses records by traversing object relationships via friendly URLs. You can retrieve, update, or delete the record associated with the traversed relationship field. If there are multiple related records, you can retrieve the complete set of associated records. This resource is available in REST API version 36.0 and later.

GET, PATCH, DELETE', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'e6808432-29b7-4dae-b38b-762f67e647cc', 'GET', 'SObject Relationships', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/:RECORD_ID/:RELATIONSHIP_FIELD_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of suggested Salesforce Knowledge articles for a case, work order, or work order line item.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'f21694e2-9d8e-4514-bdfb-21be496fab6c', 'GET', 'SObject Suggested Articles', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/suggestedArticles');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Set, reset, or get information about a user password. This resource is available in REST API version 24.0 and later.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '3794c8a8-f335-48a9-a2b9-fa38e9bb7738', 'GET', 'SObject User Password', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/User/:USER_ID/password');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Set, reset, or get information about a user password. This resource is available in REST API version 24.0 and later.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '42b5218b-a4e5-482f-9013-a1117287ceae', 'GET', 'SObject Self Service User Password', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/SelfServiceUser/:USER_ID/password');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "favorites": [
        {
            "id": "0MVR00000004DhnOAE",
            "name": "Q4 Perf"
        }
    ]
}', '2021-05-31 13:24:53.598375', 'Update all favorites at once. The sort order is updated to the given relative ordering. Any favorites missing from the request body are deleted.', NULL, 'Favorites', '{}', 'd9725d78-d0c7-4bde-8092-c714d8302bac', 'PUT', 'Update a Batch of Favorites', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites/batch');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Set, reset, or get information about a user password. This resource is available in REST API version 24.0 and later.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'c2bfa677-972a-444a-a224-e2be034afe8b', 'GET', 'Platform Event Schema by Schema ID', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/event/eventSchema/:SCHEMA_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of items in either the Salesforce app drop-down menu or the Salesforce for Android, iOS, and mobile web navigation menu.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '42d910e1-91ae-4c48-894f-21c9df56669a', 'GET', 'AppMenu', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/appMenu/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of compact layouts for multiple objects. This resource is available in REST API version 31.0 and later.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '9fe3b668-60ad-4c81-959a-62e428b0f973', 'GET', 'Compact Layouts', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/compactLayouts');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Your users can store consent preferences in different locations and possibly inconsistently. You can locate your customers’ preferences for consent across multiple records when using API version 44.0 and later. Tracking consent preferences helps you and your users respect the most restrictive requests.
Consent API aggregates consent settings across the Contact, Contact Point Type Consent, Data Use Purpose, Individual, Lead, Person Account, and User objects when the records have a lookup relationship. The Consent API can''t locate records in which the email address field is protected by Platform Encryption.

The API returns consent details based on a single action, like email or track, or—starting with API version 45.0—the multiaction endpoint allows you to request multiple actions in a single API call.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '5be3ec05-ade6-469c-8d27-169ecc522f72', 'GET', 'Consent', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/consent/action/action');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Retrieves the values for your Embedded Service deployment configuration, including the branding colors, font, and site URL.

You must be logged in to the account that owns the EmbeddedServiceConfigDeveloperName you are querying.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'c3963c4b-1715-4f5c-88ca-4d1eb86ed785', 'GET', 'Embedded Service Configuration Describe', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/support/embeddedservice/configuration/:EMBEDDED_SERVICE_CONFIG_DEVELOPERNAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns the list of actions that can be statically invoked. You can also get basic information for each type of action.
This resource is available in REST API version 32.0 and later.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '5c339b30-07ba-4d68-9eff-691d02ca4ea7', 'GET', 'Standard Invocable Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/actions/standard');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns the list of all custom actions. You can also get basic information for each type of action.
This resource is available in REST API version 32.0 and later.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '5e6657eb-6bd4-47a7-823b-655e7e2ee280', 'GET', 'Custom Invocable Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/actions/custom');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns detailed information about a list view, including the ID, the columns, and the SOQL query.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '19f38759-e383-4e77-9b46-5ab723c41251', 'GET', 'List View Describe', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/listviews/:QUERY_LOCATOR/describe');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get a favorite.', NULL, 'Favorites', '{}', 'f5c02caf-433d-4cc4-b748-06bc90f43fa9', 'DELETE', 'Delete a Favorite', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites/:FAVORITE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns detailed information about a list view, including the ID, the columns, and the SOQL query.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '5f9e17ab-05ca-4c9a-baa7-58fd0476df87', 'GET', 'List View Results', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/listviews/:LIST_VIEW_ID/results');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns the list of list views for the specified sObject, including the ID and other basic information about each list view. You can also get basic information for a specific list view by ID.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '155d413f-d6bb-4f24-ac90-8ab564e71291', 'GET', 'List Views', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/listviews/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns the list of list views for the specified sObject, including the ID and other basic information about each list view. You can also get basic information for a specific list view by ID.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'c30712ea-96a0-4ef9-96ea-5060ec12ff30', 'GET', 'Data Category Groups', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/support/dataCategoryGroups');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get data category details and the child categories by a given category.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '7a84de27-d576-419b-bd57-c5f939ed245c', 'GET', 'Data Category Detail', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/support/dataCategoryGroups/:GROUP/dataCategories/:CATEGORY');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get a page of online articles for the given language and category through either search or query.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '8737d82d-1aad-4f85-915e-4d84abbdbcce', 'GET', 'Articles List', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/support/knowledgeArticles');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get all online article fields, accessible to the user.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '781b3314-6fbf-437b-829f-f10634615af4', 'GET', 'Articles Details', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/support/knowledgeArticles/:ARTICLE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Executes a simple RESTful search using parameters instead of a SOSL clause. Indicate parameters in a URL in the GET method. Or, use POST for more complex JSON searches.', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '0dd6eb12-2d9d-45bf-84d7-2ca3b0932826', 'GET', 'Parameterized Search', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/parameterizedSearch/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of all approval processes. Can also be used to submit a particular record if that entity supports an approval process and one has already been defined. Records can be approved and rejected if the current user is an assigned approver. When using a POST request to do bulk approvals, the requests that succeed are committed and the requests that don’t succeed send back an error.
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_process_approvals.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'cb201614-8843-4c16-a7c9-f4f7adaf6719', 'GET', 'Process Approvals', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/process/approvals');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "allowSaveOnDuplicate": false,
    "apiName": "Object",
    "fields": {
        "FieldAPIName": "FieldValue"
    }
}', '2021-05-31 13:24:53.598375', 'Create a record. First, make a request to the Clone Record Default or Create Record Default resources to get the default metadata and data for the record.
As of API version 43.0, if you pass read-only fields in a request body, the response is an Error with Output.', NULL, 'Records', '{"Content-Type":"application/json"}', '5143b275-9164-49fa-bc62-40303ab6df9a', 'POST', 'Create a Record', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/records');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
  "name": "Red Accounts",
  "sortOrder": 1
}
', '2021-05-31 13:24:53.598375', 'Update a Favorite', NULL, 'Favorites', '{}', 'f9319cd8-3bc6-48ea-8151-e57dbc2943a6', 'PATCH', 'Update a Favorite', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites/:FAVORITE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
	"actionType":"string",
	"contextActorId":"ID",
	"contextId":"ID",
	"comments":"string",
	"nextApproverIds":"ID[]",
	"processDefinitionNameOrId":"string",
	"skipEntryCriteria":"boolean",
}', '2021-05-31 13:24:53.598375', 'Returns a list of all approval processes. Can also be used to submit a particular record if that entity supports an approval process and one has already been defined. Records can be approved and rejected if the current user is an assigned approver. When using a POST request to do bulk approvals, the requests that succeed are committed and the requests that don’t succeed send back an error.
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_process_approvals.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '2b2774bc-5f73-426e-b62f-e9c88ec85143', 'POST', 'Process Approvals Submit', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/process/approvals');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of all active workflow rules. If a rule has actions, the actions will be listed under the rule. Can also be used to trigger all workflow rules that are associated with a specified record. The actions for a rule are only fired if the rule’s criteria is met. When using a POST request, if anything fails, the whole transaction is rolled back.

Cross-object workflow rules cannot be invoked using the REST API.

To get a list of the workflow rules or to trigger one or more workflow rules, the URI is: /vXX.X/process/rules/
To get the rules for a particular object: /vXX.X/process/rules/SObjectName
To get the metadata for a particular rule: /vXX.X/process/rules/SObjectName/workflowRuleId
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_process_rules.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'bb715d22-62e0-42db-ae76-282e90862d49', 'GET', 'Process Rules', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/process/rules');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Work with revenue and quantity schedules for opportunity products. Establish or reestablish a product schedule with multiple installments for an opportunity product. Delete all installments in a schedule.
This resource is available in REST API version 43.0 and later.

In API version 46.0 and later, established and re-established schedules support custom fields, validation rules, and Apex triggers. Deleting all schedules now also fires delete triggers.
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_opportunitylineitemschedules.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '0f058482-903d-4771-abc7-d0ce5897b67b', 'GET', 'Product Schedules', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/OpportunityLineItem/:OPPORTUNITY_LINE_ITEM_ID/OpportunityLineItemSchedules');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Executes the specified SOQL query.

If the query results are too large, the response contains the first batch of results and a query identifier in the nextRecordsUrl field of the response. The identifier can be used in an additional request to retrieve the next batch.
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_query.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '0db9e48a-020b-4c42-a26e-cdfe08164402', 'GET', 'Query', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/query/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Executes the specified SOQL query. Unlike the Query resource, QueryAll will return records that have been deleted because of a merge or delete. QueryAll will also return information about archived Task and Event records. QueryAll is available in API version 29.0 and later.

If the query results are too large, the response contains the first batch of results and a query identifier in the nextRecordsUrl field of the response. The identifier can be used in an additional request to retrieve the next batch. Note that even though nextRecordsUrl has query in the URL, it will still provide remaining results from the initial QueryAll request. The remaining results will include deleted records that matched the initial query.
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_queryall.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'ebe339b5-1750-4df2-a0f8-bb5498502cf8', 'GET', 'QueryAll', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/queryAll/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of global actions and object-specific actions. This resource is available in REST API version 28.0 and later. When working with actions, also refer to SObject Quick Actions.
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_quickactions.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '6020831d-f59c-4a53-98c0-728cb9a396b3', 'GET', 'Quick Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/quickActions');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get a favorite.', NULL, 'Favorites', '{}', 'c2f8ed6c-2f02-4ee8-95d6-1a7218ac4e80', 'GET', 'Get a Favorite', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites/:FAVORITE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns the list of recently used list views for the given sObject type.
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_recentlistviews.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '7d033ab8-19ac-42e3-9bb2-df699c137aa2', 'GET', 'Recent List Views', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/listviews/recent');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Gets the most recently accessed items that were viewed or referenced by the current user. Salesforce stores information about record views in the interface and uses it to generate a list of recently viewed and referenced records, such as in the sidebar and for the auto-complete options in search.

This resource only accesses most recently used item information. If you want to modify the list of recently viewed items, you’ll need to update recently viewed information directly by using a SOQL Query with a FOR VIEW or FOR REFERENCE clause.
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_recent_items.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'f0d1c2f5-e7ec-4892-874f-ec4a9a12715b', 'GET', 'Recently Viewed Items', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/:SOBJECT_API_NAME/listviews/recent');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Lists information about object record counts in your organization.
This resource is available in REST API version 40.0 and later for API users with the “View Setup and Configuration” permission. The returned record count is approximate, and does not include the following types of records:

Deleted records in the recycle bin.
Archived records.
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_record_count.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'dd441fea-8111-4e44-be46-c6bc537b5de0', 'GET', 'Record Count', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/limits/recordCount');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Gets the current user’s most relevant items. Relevant items include records for objects in the user’s global search scope and also most recently used (MRU) objects.
Relevant items include up to 50 of the most recently viewed or updated records for each object in the user’s global search scope.
Note
The user’s global search scope includes the objects the user interacted with most in the last 30 days, including objects the user pinned from the search results page in the Salesforce Classic.

Then, the resource finds more recent records for each most recently used (MRU) object until the maximum number of records, which is 2,000, is returned.
This resource only accesses the relevant item information. Modifying the list of relevant items is not currently supported
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_relevant_items.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '21c03bab-0faf-4d7d-affb-d2925576c3c9', 'GET', 'Relevant Items', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/relevantItems');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns the existing Knowledge language settings, including the default knowledge language and a list of supported Knowledge language information.
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_knowledge_retrieve_language.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'fc48f0b6-53be-41e0-ab7d-8e197bac274e', 'GET', 'Retrieve Knowledge Language Settings', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/knowledgeManagement/settings');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Executes the specified SOSL search. The search string must be URL-encoded.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_search.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '415f8c5a-16f8-492d-89d9-c6e950b2a366', 'GET', 'Search', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/search');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Return frequency metrics about the standard pages within which users switched from Lightning Experience to Salesforce Classic.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_lightning_exitbypagemetrics.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'b1d3ed6c-c090-4399-85cc-978a083c8807', 'GET', 'Lightning Exit by Page Metrics', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/LightningExitByPageMetrics');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns an ordered list of objects in the default global search scope of a logged-in user. Global search keeps track of which objects the user interacts with and how often and arranges the search results accordingly. Objects used most frequently appear at the top of the list.
The returned list reflects the object order in the user’s default search scope, including any pinned objects on the user’s search results page. This call is useful if you want to implement a custom search results page using the optimized global search scope. The search string must be URL-encoded.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_search_scope_order.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'c97df85a-5a2f-462b-804e-2560a3d5b361', 'GET', 'Search Scope and Order', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/search/scopeOrder');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns search result layout information for the objects in the query string. For each object, this call returns the list of fields displayed on the search results page as columns, the number of rows displayed on the first page, and the label used on the search results page.
This call supports bulk fetch for up to 100 objects in a query.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_search_layouts.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '09ec21d1-912d-46aa-b032-4aef0d7efcea', 'GET', 'Search Result Layouts', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/search/layout/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Return details about users who switched between Salesforce Classic and Lightning Experience.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_lightning_togglemetrics.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '35b2d844-601e-4b0a-b381-7c7136e6b307', 'GET', 'Lightning Toggle Metrics', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/LightningToggleMetrics');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Return the total number of Lightning Experience and Salesforce Mobile users.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_lightning_usagebyapptypemetrics.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '0edf6b80-6bb1-4948-9179-6c4d70135287', 'GET', 'Lightning Usage by App Type', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/LightningUsageByAppTypeMetrics');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Return Lightning Experience usage results grouped by browser instance.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_lightning_usagebybrowsermetrics.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'c7b485ae-c7ce-4ad6-97d6-5f5d189dc46d', 'GET', 'Lightning Usage by Browser', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/LightningUsageByBrowserMetrics');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Represents standard pages users viewed most frequently in Lightning Experience.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_lightning_usagebypagemetrics.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'ae8611df-09e3-40e7-9b3e-0eb651fdcfce', 'GET', 'Lightning Usage by Page', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/LightningUsageByBrowserMetrics');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Return details about the custom pages viewed most frequently in Lightning Experience.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_lightning_usagebyflexipagemetrics.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '997023d1-0965-4114-a4cc-44c958f903c5', 'GET', 'Lightning Usage by FlexiPage', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/sobjects/LightningUsageByFlexiPageMetrics');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get all of a user’s favorites.', NULL, 'Favorites', '{}', 'dbf2bdb4-e601-408b-a2da-14676c85964d', 'GET', 'Get Favorites', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
  "name": "Red Accounts",
  "sortOrder": 1
}
', '2021-05-31 13:24:53.598375', 'Update a Favorite', NULL, 'Favorites', '{}', 'a51f851e-2e98-4f91-9c7a-5bdb9fcbe39e', 'PATCH', 'Update a Favorite', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites/:FAVORITE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Update the usage of an individual favorite, for example, the last time and number of times the favorite was clicked.', NULL, 'Favorites', '{}', '09f9110f-1b82-4031-91f8-07df6a3369f9', 'PATCH', 'Update Usage of a Favorite', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites/:FAVORITE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Return frequency metrics about the standard pages within which users switched from Lightning Experience to Salesforce Classic.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_lightning_exitbypagemetrics.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'e0a0996f-553b-4819-bc57-75cf3704c56c', 'GET', 'Scheduling', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/scheduling');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
	"startTime": "string",
	"endTime": "string",
	"workTypeGroupId": "string",
	"workType": "Work Type",
	"accountId": "string",
	"territoryIds": "string[]",
	"requiredResourceIds": "string[]",
	"schedulingPolicyId": "string",
	"allowConcurrentScheduling": "boolean",
}', '2021-05-31 13:24:53.598375', 'Returns a list of available appointment time slots for a resource based on given work type group and territories.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/requests_ls_getappointmentslots.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '350d87fe-55f4-49b9-a1a7-68cb79a88114', 'POST', 'Get Appointment Slots', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/scheduling/getAppointmentSlots');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
	"startTime": "string",
	"endTime": "string",
	"workTypeGroupId": "string",
	"workType": "Work Type",
	"accountId": "string",
	"territoryIds": "string[]",
	"requiredResourceIds": "string[]",
	"schedulingPolicyId": "string",
	"allowConcurrentScheduling": "boolean",
}', '2021-05-31 13:24:53.598375', 'Returns a list of available service resources (appointment candidates) based on work type group and service territories.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/requests_ls_getappointmentcandidates.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '7ece01e9-1fcb-4e7e-8568-c34f36d54418', 'POST', 'Get Appointment Candidates', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/scheduling/getAppointmentCandidates');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of suggested records whose names match the user’s search string. The suggestions resource provides autocomplete results and instant results for users to navigate directly to likely relevant records, before performing a full search.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_search_suggest_records.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'fa1c6021-5147-4f37-aada-f09559cc1e09', 'GET', 'Search for Records Suggested by Autocomplete and Instant Results', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/search/suggestions');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of Salesforce Knowledge article titles that match the user’s search query string. Provides a shortcut to navigate directly to likely relevant articles before the user performs a search.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_search_suggest_title_matches.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'db99daf3-848a-4486-9fd9-194186f0aca3', 'GET', 'Search Suggested Article Title Matches', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/search/suggestions');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a list of suggested searches based on the user’s query string text matching searches that other users have performed in Salesforce Knowledge. Provides a way to improve search effectiveness, before the user performs a search.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_search_suggest_queries.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'fbdef18d-48e5-4b2a-8880-34831b596f59', 'GET', 'Search Suggested Queries', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/search/suggestSearchQueries');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'f a survey field can be translated or is already translated into a particular language, you can add or change the translated value of the survey field.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/request_survey_translate_add_change.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', 'a1bd4f27-7483-4cad-99c6-b873cd544c63', 'GET', 'Tabs', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tabs');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a collection of list views associated with an object.', NULL, 'List Views', '{}', 'c25309a3-d422-4925-9fd5-8423d6801c0b', 'GET', 'Get List View for an Object', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-ui/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Gets the list of icons and colors used by themes in the Salesforce application. Theme information is provided for objects in your organization that use icons and colors in the Salesforce UI.

The If-Modified-Since header can be used with this resource, with a date format of EEE, dd MMM yyyy HH:mm:ss z. When this header is used, if the object metadata has not changed since the provided date, a 304 Not Modified status code is returned, with no response body.

https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_themes.htm', 'REST API provides a powerful, convenient, and simple Web services API for interacting with Lightning Platform. Its advantages include ease of integration and development, and it’s an excellent choice of technology for use with mobile applications and Web 2.0 projects. If you have many records to process, consider using Bulk API, which is based on REST principles and optimized for large sets of data.

📚 [REST API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_what_is_rest_api.htm)', 'REST', '{"Content-Type":"application/json"}', '173b89dc-6a44-4557-83e4-678a5c1d7c1d', 'GET', 'Themes', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/theme');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Lists all sandboxes.', 'Manage sandboxes', 'Sandbox', '{"Content-Type":"application/json"}', '2e627895-53a8-4b33-be28-1010075ed87d', 'GET', 'List Sandboxes', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/query/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "SandboxName": "devSandbox",
    "LicenseType": "DEVELOPER",
    "TemplateId": null,
    "HistoryDays": 0,
    "CopyChatter": false,
    "AutoActivate": false,
    "ApexClassId": null,
    "Description": null,
    "SourceId": null
}', '2021-05-31 13:24:53.598375', 'Creates or clones a sandbox. If you wish to clone, fill the SourceId body field with the org Id of the source sandbox.', 'Manage sandboxes', 'Sandbox', '{"Content-Type":"application/json"}', '3cb17a2f-4cfd-4713-ae1e-462b9ba9a7c4', 'POST', 'Create/Clone Sandbox', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/SandboxInfo');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Retrieves a sandbox record.', 'Manage sandboxes', 'Sandbox', '{}', '3fae7f1b-b5da-4637-8ce4-3913b930dd9b', 'GET', 'Get Sandbox', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/SandboxInfo/:SANDBOX_INFO_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "LicenseType": "DEVELOPER",
    "AutoActivate": true
}', '2021-05-31 13:24:53.598375', 'Refreshes a sandbox.', 'Manage sandboxes', 'Sandbox', '{"Content-Type":"application/json"}', '804849c5-0c4d-446b-826f-a5eae64aedf6', 'PATCH', 'Refresh Sandbox', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/SandboxInfo/:SANDBOX_INFO_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Deletes a sandbox.', 'Manage sandboxes', 'Sandbox', '{}', '0e3f14ed-1e4f-4765-9462-aa0ad25d5fe9', 'DELETE', 'Delete Sandbox', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/SandboxInfo/:SANDBOX_INFO_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Lists all sandboxes.', 'Manage sandboxes', 'Sandbox', '{"Content-Type":"application/json"}', '6c2c325c-067f-46dc-a494-b8c761ea854f', 'GET', 'List Sandboxes', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/query/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "SandboxName": "devSandbox",
    "LicenseType": "DEVELOPER",
    "TemplateId": null,
    "HistoryDays": 0,
    "CopyChatter": false,
    "AutoActivate": false,
    "ApexClassId": null,
    "Description": null,
    "SourceId": null
}', '2021-05-31 13:24:53.598375', 'Creates or clones a sandbox. If you wish to clone, fill the SourceId body field with the org Id of the source sandbox.', 'Manage sandboxes', 'Sandbox', '{"Content-Type":"application/json"}', '52c98c19-533d-4891-a228-97ec30480be8', 'POST', 'Create/Clone Sandbox', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/SandboxInfo');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Retrieves a sandbox record.', 'Manage sandboxes', 'Sandbox', '{}', 'd6f41920-83df-408b-8550-fa66ccc40df6', 'GET', 'Get Sandbox', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/SandboxInfo/:SANDBOX_INFO_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "LicenseType": "DEVELOPER",
    "AutoActivate": true
}', '2021-05-31 13:24:53.598375', 'Refreshes a sandbox.', 'Manage sandboxes', 'Sandbox', '{"Content-Type":"application/json"}', '5bb0a42a-54d3-4a5c-ba5c-2bcf8d4fd76e', 'PATCH', 'Refresh Sandbox', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/SandboxInfo/:SANDBOX_INFO_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Deletes a sandbox.', 'Manage sandboxes', 'Sandbox', '{}', 'a5eb2803-ef13-4d65-a52f-18ac13e29658', 'DELETE', 'Delete Sandbox', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/SandboxInfo/:SANDBOX_INFO_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Retrieves available code completions of the referenced type for Apex system method symbols (type=apex). Available from API version 28.0 or later.', 'Use Tooling API to build custom development tools or apps for Lightning Platform applications. Tooling API’s SOQL capabilities for many metadata types allow you to retrieve smaller pieces of metadata. Smaller retrieves improve performance, which makes Tooling API a better fit for developing interactive applications. Tooling API provides SOAP and REST interfaces.

📚 [Tooling API Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_api_tooling.htm)', 'Tooling', '{"Accept":"application/json"}', '0fb882b9-a908-4d99-bab8-275d4fc77c96', 'GET', 'Tooling Completion', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/completions');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Executes Apex code anonymously. Available from API version 29.0 or later.', 'Use Tooling API to build custom development tools or apps for Lightning Platform applications. Tooling API’s SOQL capabilities for many metadata types allow you to retrieve smaller pieces of metadata. Smaller retrieves improve performance, which makes Tooling API a better fit for developing interactive applications. Tooling API provides SOAP and REST interfaces.

📚 [Tooling API Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_api_tooling.htm)', 'Tooling', '{"Content-Type":"application/json"}', 'e8efd815-e92f-4b09-b4ee-0a4cde078576', 'GET', 'Tooling ExecuteAnonymous', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/executeAnonymous/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Executes a query against an object and returns data that matches the specified criteria. Tooling API exposes objects like EntityDefinition and FieldDefinition that use the external object framework. That is, they don’t exist in the database but are constructed dynamically. Special query rules apply to virtual entities.
If the query result is too large, it’s broken up into batches. The response contains the first batch of results and a query identifier. The identifier can be used in a request to retrieve the next batch.', 'Use Tooling API to build custom development tools or apps for Lightning Platform applications. Tooling API’s SOQL capabilities for many metadata types allow you to retrieve smaller pieces of metadata. Smaller retrieves improve performance, which makes Tooling API a better fit for developing interactive applications. Tooling API provides SOAP and REST interfaces.

📚 [Tooling API Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_api_tooling.htm)', 'Tooling', '{"Content-Type":"application/json"}', '47b635b8-2904-4362-ad08-daf59f0188d1', 'GET', 'Tooling Query', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/query/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get layout information, metadata, and data to build UI for a single record or for a collection of records.
The response contains layout information for whichever layout types are specified in the layoutTypes parameter.

It contains data for the records specified in the recordIds parameter.

The response contains object metadata for the object types of the records specified in the recordIds parameter, and for any nested objects. For example, a request to /ui-api/record-ui/001RM000003RsOHYA0, which is an Account, returns object metadata for Account and User, because the OwnerId field on the Account object contains a reference to the User object.', NULL, 'Records', '{}', 'a0da1479-f550-4f4b-af9e-fc0e05fa4d22', 'GET', 'Get Record Data and Object Metadata', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/record-ui/:RECORD_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "classNames": "comma-separated list of class names",
    "classids": "comma-separated list of class IDs",
    "suiteNames": "comma-separated list of test suite names",
    "suiteids": "comma-separated list of test suite IDs",
    "maxFailedTests": "integer value",
    "testLevel": "TestLevel enum value",
    "skipCodeCoverage": "boolean value"
}

or 

[
    {
        "className": "YourClassName",
        "testMethods": [
            "testMethod1",
            "testMethod2",
            "testMethod3"
        ]
    },
    {
        "className": "ManagedPackageNamespace.ManagedClassName",
        "testMethods": [
            "testMethod1",
            "testMethod2",
            "testMethod3"
        ]
    },
    {
        "classId": "01pD0000000FhyEIAS",
        "testMethods": [
            "testMethod1",
            "testMethod2",
            "testMethod3"
        ]
    },
    {
        "maxFailedTests": "2"
    },
    {
        "testLevel": "RunSpecifiedTests"
    }
]', '2021-05-31 13:24:53.598375', 'Runs one or more methods within one or more Apex classes, using the asynchronous test execution mechanism. In the request body, you can specify test class names and IDs, suite names and IDs, the maximum number of failed tests to allow, and the test level, as comma-separated lists or as an array. You can also indicate whether to opt out of collecting code coverage information during the test run (available in API version 43.0 and later).', 'Use Tooling API to build custom development tools or apps for Lightning Platform applications. Tooling API’s SOQL capabilities for many metadata types allow you to retrieve smaller pieces of metadata. Smaller retrieves improve performance, which makes Tooling API a better fit for developing interactive applications. Tooling API provides SOAP and REST interfaces.

📚 [Tooling API Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_api_tooling.htm)', 'Tooling', '{"Content-Type":"application/json"}', '5ea8d055-9c8a-4542-a2ab-dc86b7ebbf9b', 'POST', 'Tooling Run Tests Async', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/runTestsAsynchronous');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('[
    {
        "className": "YourClassName",
        "testMethods": [
            "testMethod1",
            "testMethod2",
            "testMethod3"
        ]
    },
    {
        "maxFailedTests": "2"
    }
]

or

[
    {
        "classId": "01pD0000000Fhy9IAC",
        "testMethods": [
            "testMethod1",
            "testMethod2",
            "testMethod3"
        ]
    },
    {
        "maxFailedTests": "2"
    }
]', '2021-05-31 13:24:53.598375', 'Runs one or more methods within one or more Apex classes, using the asynchronous test execution mechanism. In the request body, you can specify test class names and IDs, suite names and IDs, the maximum number of failed tests to allow, and the test level, as comma-separated lists or as an array. You can also indicate whether to opt out of collecting code coverage information during the test run (available in API version 43.0 and later).', 'Use Tooling API to build custom development tools or apps for Lightning Platform applications. Tooling API’s SOQL capabilities for many metadata types allow you to retrieve smaller pieces of metadata. Smaller retrieves improve performance, which makes Tooling API a better fit for developing interactive applications. Tooling API provides SOAP and REST interfaces.

📚 [Tooling API Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_api_tooling.htm)', 'Tooling', '{"Content-Type":"application/json"}', 'c96c89f0-60c6-4f6e-b2b5-42080557d1e4', 'POST', 'Tooling Run Tests Sync', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/runTestsSynchronous');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('[
    {
        "className": "YourClassName",
        "testMethods": [
            "testMethod1",
            "testMethod2",
            "testMethod3"
        ]
    },
    {
        "maxFailedTests": "2"
    }
]

or

[
    {
        "classId": "01pD0000000Fhy9IAC",
        "testMethods": [
            "testMethod1",
            "testMethod2",
            "testMethod3"
        ]
    },
    {
        "maxFailedTests": "2"
    }
]', '2021-05-31 13:24:53.598375', 'Runs one or more methods within one or more Apex classes, using the asynchronous test execution mechanism. In the request body, you can specify test class names and IDs, suite names and IDs, the maximum number of failed tests to allow, and the test level, as comma-separated lists or as an array. You can also indicate whether to opt out of collecting code coverage information during the test run (available in API version 43.0 and later).', 'Use Tooling API to build custom development tools or apps for Lightning Platform applications. Tooling API’s SOQL capabilities for many metadata types allow you to retrieve smaller pieces of metadata. Smaller retrieves improve performance, which makes Tooling API a better fit for developing interactive applications. Tooling API provides SOAP and REST interfaces.

📚 [Tooling API Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_api_tooling.htm)', 'Tooling', '{"Content-Type":"application/json"}', '8740c31c-d017-407c-9108-3a1bda2a0c10', 'GET', 'Tooling Search', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/search');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Lists the available Tooling API objects and their metadata.', 'Use Tooling API to build custom development tools or apps for Lightning Platform applications. Tooling API’s SOQL capabilities for many metadata types allow you to retrieve smaller pieces of metadata. Smaller retrieves improve performance, which makes Tooling API a better fit for developing interactive applications. Tooling API provides SOAP and REST interfaces.

📚 [Tooling API Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_api_tooling.htm)', 'Tooling', '{}', '28c061f4-3205-45d4-84e2-a8b07b9e30cc', 'GET', 'Get Tooling Describe', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use Tooling API to build custom development tools or apps for Lightning Platform applications. Tooling API’s SOQL capabilities for many metadata types allow you to retrieve smaller pieces of metadata. Smaller retrieves improve performance, which makes Tooling API a better fit for developing interactive applications. Tooling API provides SOAP and REST interfaces.

📚 [Tooling API Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_api_tooling.htm)', 'Tooling', '{}', '44d4690c-b5b2-4a12-9b9d-b7ad40412849', 'GET', 'Get Tooling Metadata SObject', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use Tooling API to build custom development tools or apps for Lightning Platform applications. Tooling API’s SOQL capabilities for many metadata types allow you to retrieve smaller pieces of metadata. Smaller retrieves improve performance, which makes Tooling API a better fit for developing interactive applications. Tooling API provides SOAP and REST interfaces.

📚 [Tooling API Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_api_tooling.htm)', 'Tooling', '{}', '4f68bca5-2e76-4764-9d5a-e5d3e083e2c0', 'GET', 'Get Tooling Describe SObject', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/:SOBJECT_API_NAME/describe');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
	"Name":"test"
}', '2021-05-31 13:24:53.598375', NULL, 'Use Tooling API to build custom development tools or apps for Lightning Platform applications. Tooling API’s SOQL capabilities for many metadata types allow you to retrieve smaller pieces of metadata. Smaller retrieves improve performance, which makes Tooling API a better fit for developing interactive applications. Tooling API provides SOAP and REST interfaces.

📚 [Tooling API Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_api_tooling.htm)', 'Tooling', '{"Content-Type":"application/json"}', 'f58ed6cb-31ae-4d5e-8e1e-bafd711a6eb1', 'POST', 'Post Tooling SObject', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', NULL, 'Use Tooling API to build custom development tools or apps for Lightning Platform applications. Tooling API’s SOQL capabilities for many metadata types allow you to retrieve smaller pieces of metadata. Smaller retrieves improve performance, which makes Tooling API a better fit for developing interactive applications. Tooling API provides SOAP and REST interfaces.

📚 [Tooling API Documentation](https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/intro_api_tooling.htm)', 'Tooling', '{}', '85508789-2dad-406a-838c-89f63c357d93', 'GET', 'Access Records', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/tooling/sobjects/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the default layout information, object information, and data for cloning a record. After getting the default values, make a request to POST /ui-api/records to create the record.
The response contains the default field values for a record cloned from the record specified in <RECORD_ID>, optionally of the specified recordTypeId.

It also contains the corresponding layout information for edit mode. In the Salesforce user interface, an admin with “Customize Application” permission can mark a field as required in a layout. When you’re building UI, to determine which fields to mark as required in a layout for edit mode, use the RecordLayoutItem.required property.

The response contains object metadata for the object type of the record specified in <RECORD_ID> and for any nested objects. For example, /ui-api/record-defaults/clone/001d000000AtfRIAAZ is a request to clone an Account record. It returns object metadata for Account and User, because the OwnerId field on the Account object contains a reference to the User object.', NULL, 'Records', '{}', '5451b817-de23-42b5-956c-9455a12e3e67', 'GET', 'Get Default Values to Clone a Record', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/record-defaults/clone/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the default values for fields for a new record of a specified object and optional record type. After getting the default values, make a request to POST /ui-api/records to create the record.
The response contains the default field values for the Full layout type for a new record of the object type specified in <SOBJECT_API_NAME>.

It also contains the corresponding layout for create mode. In the Salesforce user interface, an admin with “Customize Application” permission can mark a field as required in a layout. When you’re building UI, to determine which fields to mark as required in a layout for create mode, use the RecordLayoutItem.required property.

The response contains object metadata for the object specified in <SOBJECT_API_NAME> and for any nested objects. For example, a request to /ui-api/record-defaults/create/Account returns object metadata for Account and User, because the OwnerId field on the Account object contains a reference to the User object.', NULL, 'Records', '{}', '1d7fdb31-b4b7-453c-96c3-4864f737a7d2', 'GET', 'Get Default Values to Create a Record', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/record-defaults/create/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "allowSaveOnDuplicate": false,
    "apiName": "Object",
    "fields": {
        "FieldAPIName": "FieldValue"
    }
}', '2021-05-31 13:24:53.598375', 'Update a record''s data.
User Interface API enforces Salesforce validation rules. If a validation rule fails, the response is an Error with Output.

When you make a PATCH request to update a record, make sure that the record hasn’t changed since the user started editing it. To find out whether it’s safe to save a record, pass the If-Modified-Since HTTP header in the request.

As of API version 43.0, if you pass read-only fields in a request body, the response is an Error with Output.', NULL, 'Records', '{"Content-Type":"application/json"}', '219cda2e-a758-49dd-883b-437b1cf73d9f', 'PATCH', 'Update a Record', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/records/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Update a record''s data.
User Interface API enforces Salesforce validation rules. If a validation rule fails, the response is an Error with Output.

When you make a PATCH request to update a record, make sure that the record hasn’t changed since the user started editing it. To find out whether it’s safe to save a record, pass the If-Modified-Since HTTP header in the request.

As of API version 43.0, if you pass read-only fields in a request body, the response is an Error with Output.', NULL, 'Records', '{}', 'c9434660-f49f-417d-84c2-56d3b079e424', 'DELETE', 'Delete a Record', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/records/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'When a user edits a lookup field, use this resource to search for and display suggestions. You can search for most recently used matches, for matching names, or for any match in a searchable field. You can also specify lookup filter bindings for dependent lookups.', NULL, 'Records', '{}', '02cbd765-216f-4f75-a4be-08dc89ee7f29', 'GET', 'Get Lookup Field Suggestions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/lookups/:SOBJECT_API_NAME/:FIELD_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'When a user edits a lookup field, use this resource to search for and display suggestions for a specified object. You can search for most recently used matches, for matching names, or for any match in a searchable field. You can also specify lookup filter bindings for dependent lookups.', NULL, 'Records', '{}', '0d0e8205-894f-4afc-97be-e75c7c476b27', 'GET', 'Get Lookup Field Suggestions for a Specified Object', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/lookups/:SOBJECT_API_NAME/:FIELD_API_NAME/:TARGET_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on record detail pages.', NULL, 'Actions', '{}', '0705b4ae-edf5-4ea6-b21f-6f0d4c13801e', 'GET', 'Get Global Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/global');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on record detail pages.', NULL, 'Actions', '{}', '281a0479-09fc-42cb-b8ee-b048ae97d1bc', 'GET', 'Get Record Detail Page Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/record/:RECORD_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on record detail pages.', NULL, 'Actions', '{}', 'c64ff04a-8c04-4bd0-984d-b8e409e65567', 'GET', 'Get Record Edit Page Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/record/:RECORD_IDS/record-edit');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on record detail pages.', NULL, 'Actions', '{}', '23bb8e6a-4ac7-4fa6-bd51-83ac07f29015', 'GET', 'Get Related List Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/record/:RECORD_IDS/related-list/:RELATED_LIST_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on records in related lists.', NULL, 'Actions', '{}', '40531f38-d7cf-4a31-8273-8fc965e2f7ec', 'GET', 'Get Related List Record Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/record/:RECORD_ID/related-list-record/:RELATED_LIST_RECORD_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on records in related lists.', NULL, 'Actions', '{}', 'b25e7883-d3b7-4f03-8222-4e9d333bd937', 'GET', 'Get List View Header Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/list-view/:LIST_VIEW_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the record actions on list views.', NULL, 'Actions', '{}', 'cbd8c437-0dd1-4dd6-990e-2a19003cf3f8', 'GET', 'Get List View Record Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/list-view-record/:RECORD_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the record actions on list views.', NULL, 'Actions', '{}', 'cca10d5d-8c2b-4522-9b10-934089f6fe8f', 'GET', 'Get List View Chart Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/list-view-chart/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on Lightning pages (FlexiPages).', NULL, 'Actions', '{}', 'a233b8eb-4f7a-4d44-85f5-1781cdb54b35', 'GET', 'Get Lightning Page Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/flexipage/:FLEXIPAGE_NAMES');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on Lightning pages (FlexiPages).', NULL, 'Actions', '{}', 'd4f0dd38-5562-444e-b6b2-77771e12c7db', 'GET', 'Get Lookup Field Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/lookup/:SOBJECT_API_NAMES');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the header actions on the most recently used (MRU) list view for objects.', NULL, 'Actions', '{}', '0fd63ccc-70f7-48a8-9a91-4089ba1b0759', 'GET', 'Get MRU List View Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/mru-list/:SOBJECT_API_NAMES');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the photo actions for pages. Currently, only group and user pages support photo actions.', NULL, 'Actions', '{}', 'e99abe7a-055c-484d-a0e6-07b52e579406', 'GET', 'Get Photo Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/photo/:RECORD_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "name": "Favorite Name",
    "sortOrder": "integer",
    "target": "API Name or ID",
    "targetType": "ListView | ObjectHome | Record | Tab"
}', '2021-05-31 13:24:53.598375', 'Create a Favorite', NULL, 'Favorites', '{"Content-Type":"application/json"}', 'f5db897b-dc05-4373-9aad-7ff7d02d30c3', 'POST', 'Create a Favorite', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a collection of list views associated with an object.', NULL, 'List Views', '{}', '75064b83-97a6-484b-868f-a77b648006e5', 'GET', 'Get List View Records per API Name', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-records/:SOBJECT_API_NAME/:LIST_VIEW_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns list view metadata.', NULL, 'List Views', '{}', '1d8fd10c-807f-484f-8b6f-81404a2cebf3', 'GET', 'Get List View Metadata per Id', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-info/:LIST_VIEW_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns list view metadata.', NULL, 'List Views', '{}', '41501755-607f-42da-8bd6-97a2bb93d0f4', 'GET', 'Get List View Metadata per API Name', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-info/:SOBJECT_API_NAME/:LIST_VIEW_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns record data and metadata for a list view.', NULL, 'List Views', '{}', '7f812f26-ba3a-46da-b9b6-808fff870b64', 'GET', 'Get List View Records and Metadata per Id', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-ui/:LIST_VIEW_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns record data and metadata for a list view.', NULL, 'List Views', '{}', '99331df1-4b56-4e12-bbd8-42b0aecb0195', 'GET', 'Get List View Records and Metadata API Name', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-info/:SOBJECT_API_NAME/:LIST_VIEW_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns record data for an object’s most recently used (MRU) list view.', NULL, 'List Views', '{}', '30e551d2-b1a6-4888-8a33-84adaf0de54c', 'GET', 'Get Most Recently Used List View Records', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/mru-list-records/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns metadata for an object’s most recently viewed (MRU) list view.', NULL, 'List Views', '{}', '8fd28baa-df23-4e2f-87e2-367bc1f06702', 'GET', 'Get Most Recently Used List View Metadata', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/mru-list-info/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns record data and metadata for an object’s most recently used (MRU) list view.', NULL, 'List Views', '{}', '953a9764-d42b-48b3-9e7c-e735cbd51aad', 'GET', 'Get Most Recently Used List View Records and Metadata', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/mru-list-ui/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get metadata for all the apps a user has access to. Metadata for the selected app includes tabs on the app’s navigation bar. Metadata for other apps doesn’t include tabs on the navigation bar.', NULL, 'Apps', '{}', 'b00e9cd5-b6b8-4d5a-a11b-c417141e21a6', 'GET', 'Get Apps', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/apps');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get metadata about an app.', NULL, 'Apps', '{}', '06f7d1dc-546f-4721-9c28-f2e45338fdbd', 'GET', 'Get an App', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/apps/:APP_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns metadata for an app, and saves an app as the last selected for a user.', NULL, 'Apps', '{}', '984cbd0a-b02d-4c90-a884-1e8b8ebc336c', 'PATCH', 'Update Last Selected App', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/apps/:APP_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Retrieves the app the current user last selected or the app the user sees by default.', NULL, 'Apps', '{}', 'b287f40d-5d40-4028-a879-76696d15e88d', 'GET', 'Get Last Selected App', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/apps/selected');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get a user’s personalized navigation items (tabs).', NULL, 'Apps', '{}', 'c47bde77-d050-496b-96fa-85491a18949c', 'GET', 'Get Personalized Navigation Items', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/apps/:APP_ID/user-nav-items');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Gets all navigation items (tabs) that the user has access to.', NULL, 'Apps', '{}', 'b983289a-2847-4188-ac8f-2c8fc4b04a8e', 'GET', 'Get All Navigation Items', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/nav-items');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Updates the order of a user’s personalized navigation items (tabs) and adds a navigation item to the list in the order specified.', NULL, 'Apps', '{}', '0c13d525-0f2d-4892-90ae-fac7c2cf219a', 'PUT', 'Update Personalized Navigation Items', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/apps/:APP_ID/user-nav-items');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get layout information, metadata, and data to build UI for a single record or for a collection of records.
The response contains layout information for whichever layout types are specified in the layoutTypes parameter.

It contains data for the records specified in the recordIds parameter.

The response contains object metadata for the object types of the records specified in the recordIds parameter, and for any nested objects. For example, a request to /ui-api/record-ui/001RM000003RsOHYA0, which is an Account, returns object metadata for Account and User, because the OwnerId field on the Account object contains a reference to the User object.', NULL, 'Records', '{}', '23bb9e7b-67fd-4997-8dad-b8bd1f8ff28a', 'GET', 'Get Record Data and Object Metadata', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/record-ui/:RECORD_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get metadata about page layouts for the specified object type.', NULL, 'Records', '{}', '31f8e58d-9abf-4d0d-b444-78783712a895', 'GET', 'Get Record Layout Metadata', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/layout/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get a Salesforce org’s active theme. A theme uses colors, images, and banners to change the overall appearance of Salesforce. Administrators can define themes and switch themes to provide a different look. The User Interface API response matches the Admin’s selection.', NULL, 'Records', '{}', '602baf87-bcd9-4ee1-b811-c205f10b6768', 'GET', 'Get a Directory of Supported Objects', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/object-info');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get metadata about a specific object. The response includes metadata describing fields, child relationships, record type, and theme.', NULL, 'Records', '{}', 'efe89ffa-a6b2-4f04-b83a-59bc7561baa6', 'GET', 'Get Object Metadata', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/object-info/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get metadata about a specific object. The response includes metadata describing fields, child relationships, record type, and theme.', NULL, 'Records', '{}', 'e1b5e88c-20f0-4195-a171-ffac1259902d', 'GET', 'Get Values for a Picklist Field', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/object-info/:SOBJECT_API_NAME/picklist-values/:RECORD_TYPE_ID/:FIELD_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get metadata about a specific object. The response includes metadata describing fields, child relationships, record type, and theme.', NULL, 'Records', '{}', '9a9fdfed-7aa3-4b2e-909d-b751290174e5', 'GET', 'Get Values for All Picklist Fields of a Record Type', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/object-info/:SOBJECT_API_NAME/picklist-values/:RECORD_TYPE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get child records for a specified record and child relationship name. Relationships are connections between records. On a record detail page, each record in a related list has a child relationship to the parent record.', NULL, 'Records', '{}', '2f8e6165-414a-4f6d-b1fe-59cb5b519e6c', 'GET', 'Get Child Records', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/records/:RECORD_ID/child-relationships/:RELATIONSHIP_NAME
');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get a record’s data.', NULL, 'Records', '{}', '85349973-41c4-412f-bac9-090fd3bfbda2', 'GET', 'Get a Record', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/records/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get data for a batch of records.', NULL, 'Records', '{}', '4f31c103-ed7f-4448-8616-8cf493d7a979', 'GET', 'Get a Batch of Records', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/records/batch/:RECORD_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "allowSaveOnDuplicate": false,
    "apiName": "Object",
    "fields": {
        "FieldAPIName": "FieldValue"
    }
}', '2021-05-31 13:24:53.598375', 'Create a record. First, make a request to the Clone Record Default or Create Record Default resources to get the default metadata and data for the record.
As of API version 43.0, if you pass read-only fields in a request body, the response is an Error with Output.', NULL, 'Records', '{"Content-Type":"application/json"}', 'e60446ad-97ce-466c-a839-170b5d2ce13e', 'POST', 'Create a Record', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/records');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the default layout information, object information, and data for cloning a record. After getting the default values, make a request to POST /ui-api/records to create the record.
The response contains the default field values for a record cloned from the record specified in <RECORD_ID>, optionally of the specified recordTypeId.

It also contains the corresponding layout information for edit mode. In the Salesforce user interface, an admin with “Customize Application” permission can mark a field as required in a layout. When you’re building UI, to determine which fields to mark as required in a layout for edit mode, use the RecordLayoutItem.required property.

The response contains object metadata for the object type of the record specified in <RECORD_ID> and for any nested objects. For example, /ui-api/record-defaults/clone/001d000000AtfRIAAZ is a request to clone an Account record. It returns object metadata for Account and User, because the OwnerId field on the Account object contains a reference to the User object.', NULL, 'Records', '{}', 'd935e6a3-3f17-4059-9550-b6bd4e0f1b89', 'GET', 'Get Default Values to Clone a Record', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/record-defaults/clone/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the default values for fields for a new record of a specified object and optional record type. After getting the default values, make a request to POST /ui-api/records to create the record.
The response contains the default field values for the Full layout type for a new record of the object type specified in <SOBJECT_API_NAME>.

It also contains the corresponding layout for create mode. In the Salesforce user interface, an admin with “Customize Application” permission can mark a field as required in a layout. When you’re building UI, to determine which fields to mark as required in a layout for create mode, use the RecordLayoutItem.required property.

The response contains object metadata for the object specified in <SOBJECT_API_NAME> and for any nested objects. For example, a request to /ui-api/record-defaults/create/Account returns object metadata for Account and User, because the OwnerId field on the Account object contains a reference to the User object.', NULL, 'Records', '{}', 'f46d819f-21b1-44ae-8c94-a65391360b9d', 'GET', 'Get Default Values to Create a Record', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/record-defaults/create/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "allowSaveOnDuplicate": false,
    "apiName": "Object",
    "fields": {
        "FieldAPIName": "FieldValue"
    }
}', '2021-05-31 13:24:53.598375', 'Update a record''s data.
User Interface API enforces Salesforce validation rules. If a validation rule fails, the response is an Error with Output.

When you make a PATCH request to update a record, make sure that the record hasn’t changed since the user started editing it. To find out whether it’s safe to save a record, pass the If-Modified-Since HTTP header in the request.

As of API version 43.0, if you pass read-only fields in a request body, the response is an Error with Output.', NULL, 'Records', '{"Content-Type":"application/json"}', 'af9f2edf-aae8-45c9-932f-385bad1c5eaa', 'PATCH', 'Update a Record', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/records/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Update a record''s data.
User Interface API enforces Salesforce validation rules. If a validation rule fails, the response is an Error with Output.

When you make a PATCH request to update a record, make sure that the record hasn’t changed since the user started editing it. To find out whether it’s safe to save a record, pass the If-Modified-Since HTTP header in the request.

As of API version 43.0, if you pass read-only fields in a request body, the response is an Error with Output.', NULL, 'Records', '{}', '3425cb17-cd72-4f17-bb21-d4d4a258321c', 'DELETE', 'Delete a Record', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/records/:RECORD_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'When a user edits a lookup field, use this resource to search for and display suggestions. You can search for most recently used matches, for matching names, or for any match in a searchable field. You can also specify lookup filter bindings for dependent lookups.', NULL, 'Records', '{}', 'e1d10a8c-2b07-4bed-90a9-d30ca37251a7', 'GET', 'Get Lookup Field Suggestions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/lookups/:SOBJECT_API_NAME/:FIELD_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'When a user edits a lookup field, use this resource to search for and display suggestions for a specified object. You can search for most recently used matches, for matching names, or for any match in a searchable field. You can also specify lookup filter bindings for dependent lookups.', NULL, 'Records', '{}', '146ac38d-fb4c-4cdf-ab56-c525793d67f3', 'GET', 'Get Lookup Field Suggestions for a Specified Object', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/lookups/:SOBJECT_API_NAME/:FIELD_API_NAME/:TARGET_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on record detail pages.', NULL, 'Actions', '{}', '3162ff28-447a-4c1e-a7ca-1c2a37c44759', 'GET', 'Get Global Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/global');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on record detail pages.', NULL, 'Actions', '{}', '705abbb6-250c-45fb-a9cc-bb8a82e72a85', 'GET', 'Get Record Detail Page Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/record/:RECORD_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on record detail pages.', NULL, 'Actions', '{}', '4debd712-6014-4762-b8f6-8b6296b9ea95', 'GET', 'Get Record Edit Page Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/record/:RECORD_IDS/record-edit');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on record detail pages.', NULL, 'Actions', '{}', '47b3e0e4-7c66-4a4b-b1ce-24d631a4feb5', 'GET', 'Get Related List Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/record/:RECORD_IDS/related-list/:RELATED_LIST_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on records in related lists.', NULL, 'Actions', '{}', '1e019131-6426-4447-92e1-85100688c378', 'GET', 'Get Related List Record Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/record/:RECORD_ID/related-list-record/:RELATED_LIST_RECORD_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on records in related lists.', NULL, 'Actions', '{}', 'd910f4d0-fbf0-41bd-8224-c8f776f0183d', 'GET', 'Get List View Header Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/list-view/:LIST_VIEW_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the record actions on list views.', NULL, 'Actions', '{}', '45882d92-550c-4c07-a87a-68e646f577f5', 'GET', 'Get List View Record Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/list-view-record/:RECORD_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the record actions on list views.', NULL, 'Actions', '{}', '9c391113-e200-4a8a-a46f-4e4262eda413', 'GET', 'Get List View Chart Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/list-view-chart/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on Lightning pages (FlexiPages).', NULL, 'Actions', '{}', '8fd6c73e-e282-4678-941e-6e3f76b33db9', 'GET', 'Get Lightning Page Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/flexipage/:FLEXIPAGE_NAMES');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the actions on Lightning pages (FlexiPages).', NULL, 'Actions', '{}', '9e38aa15-2ea7-4188-8d6c-77c447509632', 'GET', 'Get Lookup Field Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/lookup/:SOBJECT_API_NAMES');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the header actions on the most recently used (MRU) list view for objects.', NULL, 'Actions', '{}', '03ce775a-4144-42ca-9311-fbea349491d1', 'GET', 'Get MRU List View Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/mru-list/:SOBJECT_API_NAMES');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get the photo actions for pages. Currently, only group and user pages support photo actions.', NULL, 'Actions', '{}', '0535c9c5-95f2-4896-9347-ac23af3542c0', 'GET', 'Get Photo Actions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/actions/photo/:RECORD_IDS');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "name": "Favorite Name",
    "sortOrder": "integer",
    "target": "API Name or ID",
    "targetType": "ListView | ObjectHome | Record | Tab"
}', '2021-05-31 13:24:53.598375', 'Create a Favorite', NULL, 'Favorites', '{"Content-Type":"application/json"}', 'd1e39a46-14d3-4fde-8977-41812b20cde6', 'POST', 'Create a Favorite', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "favorites": [
        {
            "id": "0MVR00000004DhnOAE",
            "name": "Q4 Perf"
        }
    ]
}', '2021-05-31 13:24:53.598375', 'Update all favorites at once. The sort order is updated to the given relative ordering. Any favorites missing from the request body are deleted.', NULL, 'Favorites', '{}', '3aac656b-9a9f-4503-8f0b-3834a7fb3645', 'PUT', 'Update a Batch of Favorites', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites/batch');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get a favorite.', NULL, 'Favorites', '{}', '70e9979f-3bee-46a2-801c-099efd6f5287', 'DELETE', 'Delete a Favorite', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites/:FAVORITE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Update the usage of an individual favorite, for example, the last time and number of times the favorite was clicked.', NULL, 'Favorites', '{}', '410e1712-cf76-48e7-8f5e-36792c8dcef2', 'PATCH', 'Update Usage of a Favorite', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/favorites/:FAVORITE_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a collection of list views associated with an object.', NULL, 'List Views', '{}', '9fd9b276-e279-4727-8172-b60da6e76797', 'GET', 'Get List View for an Object', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-ui/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns record data for a list view.', NULL, 'List Views', '{}', 'e8c5662a-2021-44ee-b670-370d675fa2cc', 'GET', 'Get List View Records per Id', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-records/:LIST_VIEW_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns a collection of list views associated with an object.', NULL, 'List Views', '{}', '0ffdbc15-08a3-4361-b7b4-6bf7974680b8', 'GET', 'Get List View Records per API Name', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-records/:SOBJECT_API_NAME/:LIST_VIEW_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns list view metadata.', NULL, 'List Views', '{}', '952d9330-ac17-4374-b0e3-5b9fd866ef9b', 'GET', 'Get List View Metadata per Id', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-info/:LIST_VIEW_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns list view metadata.', NULL, 'List Views', '{}', '56249142-b258-49b3-90e6-40f5628ac1e7', 'GET', 'Get List View Metadata per API Name', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-info/:SOBJECT_API_NAME/:LIST_VIEW_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns record data and metadata for a list view.', NULL, 'List Views', '{}', 'f0ae43b0-d3c1-47ac-b6b4-023bea69bcec', 'GET', 'Get List View Records and Metadata per Id', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-ui/:LIST_VIEW_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns record data and metadata for a list view.', NULL, 'List Views', '{}', '3f2f3e5f-8c02-4820-b752-45f6cf23386a', 'GET', 'Get List View Records and Metadata API Name', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/list-info/:SOBJECT_API_NAME/:LIST_VIEW_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns record data for an object’s most recently used (MRU) list view.', NULL, 'List Views', '{}', 'eb09f5e5-8dfb-4ee7-b436-9306d0ba36a5', 'GET', 'Get Most Recently Used List View Records', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/mru-list-records/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns metadata for an object’s most recently viewed (MRU) list view.', NULL, 'List Views', '{}', '49f947dd-da48-49b7-85f5-2b3462630d4e', 'GET', 'Get Most Recently Used List View Metadata', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/mru-list-info/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns record data and metadata for an object’s most recently used (MRU) list view.', NULL, 'List Views', '{}', '64969783-48a9-44df-b737-4b273e4da5ac', 'GET', 'Get Most Recently Used List View Records and Metadata', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/mru-list-ui/:SOBJECT_API_NAME');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get metadata for all the apps a user has access to. Metadata for the selected app includes tabs on the app’s navigation bar. Metadata for other apps doesn’t include tabs on the navigation bar.', NULL, 'Apps', '{}', '78bc7fc1-0ea4-401c-8a61-5fd9596af767', 'GET', 'Get Apps', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/apps');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get metadata about an app.', NULL, 'Apps', '{}', 'a1120d5b-5a42-46eb-bbd9-23d4edeca80d', 'GET', 'Get an App', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/apps/:APP_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Returns metadata for an app, and saves an app as the last selected for a user.', NULL, 'Apps', '{}', '73975735-6463-43a6-bf64-e7812acd4254', 'PATCH', 'Update Last Selected App', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/apps/:APP_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Retrieves the app the current user last selected or the app the user sees by default.', NULL, 'Apps', '{}', '508c830b-86f9-48e9-8a87-e728c148b66f', 'GET', 'Get Last Selected App', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/apps/selected');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get a user’s personalized navigation items (tabs).', NULL, 'Apps', '{}', '0e706a70-a64d-4ac8-b5eb-bb557fe1d716', 'GET', 'Get Personalized Navigation Items', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/apps/:APP_ID/user-nav-items');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Gets all navigation items (tabs) that the user has access to.', NULL, 'Apps', '{}', '36b652e9-df57-4482-b6d4-bacbe97d7607', 'GET', 'Get All Navigation Items', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/nav-items');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Updates the order of a user’s personalized navigation items (tabs) and adds a navigation item to the list in the order specified.', NULL, 'Apps', '{}', '4c572cbb-95a4-43bf-8c70-4ab4826c5a9a', 'PUT', 'Update Personalized Navigation Items', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/apps/:APP_ID/user-nav-items');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get a Salesforce org’s active theme. A theme uses colors, images, and banners to change the overall appearance of Salesforce. Administrators can define themes and switch themes to provide a different look. The User Interface API response matches the Admin’s selection.', 'Build Salesforce UI for native mobile apps and custom web apps using the same API that Salesforce uses to build Lightning Experience and Salesforce for Android, iOS, and mobile web. Build user interfaces that let users work with records, list views, actions, favorites, and more. Not only do you get data and metadata in a single response, but the response matches metadata changes made to the org by Salesforce admins. You don’t have to worry about layouts, picklists, field-level security, or sharing—all you have to do is build an app that users love.

📚 [User Interface API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_get_started.htm)', 'UI', '{}', '78013b48-c6d6-43aa-a8ae-a1db69bedd68', 'GET', 'Get Active Theme', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/ui-api/themes/active');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values ('{
    "predictionDefinition": "<PREDICTION_DEFINITION_ID>",
    "type": "RawData",
    "columnNames": [
        "Quantity",
        "Category",
        "Sub_Category",
        "Sales",
        "Profit_per_Order"
    ],
    "rows": [
        [
            "2",
            "Furniture",
            "Chairs",
            "300",
            "10"
        ]
    ]
}', '2021-05-31 13:24:53.598375', 'Get available prediction definitions.', 'After deploying models with Einstein Discovery, use the Einstein Prediction Service API to embed your predictions into any website or application.

⚠️ Einstein Discovery requires either the Einstein Analytics Plus license or the Einstein Predictions license, both of which are available for an extra cost.

📚 [Einstein Prediction Service documentation](https://help.salesforce.com/articleView?id=sf.bi_edd_prediction_service.htm&type=5).', 'Einstein Prediction Service', '{}', '44bd96ff-d738-4e2d-b07a-b54796f81413', 'POST', 'Predict', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/smartdatadiscovery/predict');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get available prediction definitions.', 'After deploying models with Einstein Discovery, use the Einstein Prediction Service API to embed your predictions into any website or application.

⚠️ Einstein Discovery requires either the Einstein Analytics Plus license or the Einstein Predictions license, both of which are available for an extra cost.

📚 [Einstein Prediction Service documentation](https://help.salesforce.com/articleView?id=sf.bi_edd_prediction_service.htm&type=5).', 'Einstein Prediction Service', '{}', 'ff60afed-62f1-4a75-aed1-c9418d754ecd', 'GET', 'Prediction definitions', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/smartdatadiscovery/predictionDefinitions');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get available prediction definitions.', 'After deploying models with Einstein Discovery, use the Einstein Prediction Service API to embed your predictions into any website or application.

⚠️ Einstein Discovery requires either the Einstein Analytics Plus license or the Einstein Predictions license, both of which are available for an extra cost.

📚 [Einstein Prediction Service documentation](https://help.salesforce.com/articleView?id=sf.bi_edd_prediction_service.htm&type=5).', 'Einstein Prediction Service', '{}', '8c56b6df-78aa-4a3f-b38b-1e4c2657a8b9', 'GET', 'Prediction definition metadata', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/smartdatadiscovery/predictionDefinitions/:PREDICTION_DEFINITION_ID');
insert into "salesforce_api" ("body", "createdAt", "description", "groupDescription", "groupName", "header", "id", "method", "name", "updatedAt", "url") values (NULL, '2021-05-31 13:24:53.598375', 'Get available prediction definitions.', 'After deploying models with Einstein Discovery, use the Einstein Prediction Service API to embed your predictions into any website or application.

⚠️ Einstein Discovery requires either the Einstein Analytics Plus license or the Einstein Predictions license, both of which are available for an extra cost.

📚 [Einstein Prediction Service documentation](https://help.salesforce.com/articleView?id=sf.bi_edd_prediction_service.htm&type=5).', 'Einstein Prediction Service', '{}', 'b695ddc8-6b73-4bd5-b6e9-d8c0080a18d3', 'GET', 'Prediction models', '2021-05-31 13:24:53.598375', 'services/data/v{{version}}/smartdatadiscovery/predictionDefinitions/:PREDICTION_DEFINITION_ID/models');
;
