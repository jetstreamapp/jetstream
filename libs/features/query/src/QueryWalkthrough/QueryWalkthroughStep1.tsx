export const QueryWalkthroughStep1 = () => {
  return (
    <div>
      <p className="slds-text-heading_small">
        Jetstream helps you easily create powerful queries (searches) to fetch records from your Salesforce org.
      </p>
      <p className="slds-m-top_small">The main flow is simple:</p>
      <ol className="slds-list_ordered slds-m-vertical_small">
        <li>Search for and select an object from the list on the left.</li>
        <li>Select the fields and Related Objects you'd like to query.</li>
        <li>Set any filters, sorting, or limit the number of results you'd like.</li>
        <li>Click the 'Execute' button.</li>
      </ol>
      <p>From the Query Results page you can then delete or download any of the records that were returned.</p>
      <p className="slds-m-top_small">
        <strong>
          Tip: If you are not seeing objects or fields, make sure you have permission to view them. Click the "refresh" icon above the
          objects to clear the cache.
        </strong>
      </p>
    </div>
  );
};

export default QueryWalkthroughStep1;
