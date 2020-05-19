export function getFieldDefinitionQuery(sobject: string) {
  return `
    SELECT
      Id,
      QualifiedApiName,
      Label,
      MasterLabel,
      DataType,
      ValueTypeId,
      ReferenceTo,
      ExtraTypeInfo,
      PublisherId,
      RelationshipName,
      LastModifiedBy.Name,
      LastModifiedDate,
      IsCompound,
      IsHighScaleNumber,
      IsHtmlFormatted,
      IsNameField,
      IsNillable,
      IsCalculated,
      IsApiFilterable,
      IsApiGroupable,
      IsApiSortable,
      IsPolymorphicForeignKey
    FROM FieldDefinition
    WHERE EntityDefinitionId = '${sobject}'
  `;
}
