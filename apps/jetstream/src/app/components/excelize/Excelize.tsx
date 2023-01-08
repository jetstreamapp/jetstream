import { logger } from '@jetstream/shared/client-logger';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { query } from '@jetstream/shared/data';
import { generateExcelWorksheet, saveFile } from '@jetstream/shared/ui-utils';
import { AutoFullHeightContainer } from '@jetstream/ui';
import { FunctionComponent, useCallback } from 'react';
import { useTitle } from 'react-use';
import { useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../app-state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ExcelizeProps {}

export const Excelize: FunctionComponent<ExcelizeProps> = () => {
  useTitle('~~TEST~~');

  const selectedOrg = useRecoilValue(selectedOrgState);

  const createSpreadsheet = useCallback(async () => {
    try {
      const { queryResults } = await query(
        //     selectedOrg,
        //     `SELECT Id, Name, AccountNumber, AccountSource, Active__c, AnnualRevenue,
        //   api_name_mismatch__c, autonum__c, BillingAddress, BillingCity, BillingCountry,
        //   BillingGeocodeAccuracy, BillingLatitude, BillingLongitude, BillingPostalCode, BillingState,
        //   BillingStreet, ChannelProgramLevelName, ChannelProgramName, checkbox__c, CleanStatus,
        //   CreatedById, CreatedDate, Currency_Field__c, CurrencyIsoCode, CustomerPriority__c,
        //   DandbCompanyId, date__c, Description, DunsNumber, email__c, encrypted_text__c, Fax,
        //   formula_number__c, Geolocation__c, Geolocation__Latitude__s, Geolocation__Longitude__s, Industry,
        //   IsCustomerPortal, IsDeleted, IsPartner, Jigsaw, JigsawCompanyId, LastActivityDate,
        //   LastModifiedById, LastModifiedDate, LastReferencedDate, LastViewedDate, MasterRecordId,
        //   My_Ext_Id__c, my_perm_test_export_2__c, NaicsCode, NaicsDesc, number__c, NumberOfEmployees,
        //   NumberofLocations__c, OperatingHoursId, OwnerId, Ownership, ParentId, percent__c, Phone, phone__c,
        //   PhotoUrl, Rating, rich_text__c, roll_up__c, SBQQ__AssetQuantitiesCombined__c,
        //   SBQQ__ContractCoTermination__c, SBQQ__CoTermedContractsCombined__c, SBQQ__CoTerminationEvent__c,
        //   SBQQ__DefaultOpportunity__c, SBQQ__IgnoreParentContractedPrices__c, SBQQ__PreserveBundle__c,
        //   SBQQ__PriceHoldEnd__c, SBQQ__RenewalModel__c, SBQQ__RenewalPricingMethod__c, SBQQ__TaxExempt__c,
        //   ShippingAddress, ShippingCity, ShippingCountry, ShippingGeocodeAccuracy, ShippingLatitude,
        //   ShippingLongitude, ShippingPostalCode, ShippingState, ShippingStreet, Sic, SicDesc, Site, SLA__c,
        //   SLAExpirationDate__c, SLASerialNumber__c, SystemModstamp, Test123__c, Test_Field__c, textarea__c,
        //   textarea_long__c, TickerSymbol, time__c, Tradestyle, Type, UpsellOpportunity__c, url__c, Website,
        //   YearStarted
        // FROM Account`
        //   );
        selectedOrg,
        `SELECT Id, Name, BillingAddress FROM Account LIMIT 1 OFFSET 3`
      );

      const results = await generateExcelWorksheet(queryResults.records, {
        header: Object.keys(queryResults.records[0]).filter((key) => key !== 'attributes'),
      });
      await saveFile(results, 'test.xlsx', MIME_TYPES.XLSX_OPEN_OFFICE);
    } catch (ex) {
      logger.warn(ex);
    }
  }, []);

  return (
    <AutoFullHeightContainer fillHeight bottomBuffer={10} setHeightAttr className="slds-p-horizontal_x-small slds-scrollable_none">
      <button onClick={createSpreadsheet}>Create Spreadsheet</button>
    </AutoFullHeightContainer>
  );
};
