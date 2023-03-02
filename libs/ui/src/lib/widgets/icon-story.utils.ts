import { getIconTypes, IconName, IconType } from '@jetstream/icon-factory';

const doctypeIcons = getIconTypes('doctype');
const standardIcons = getIconTypes('standard');
const utilityIcons = getIconTypes('utility');

const mapFn = (type: IconType) => (iconName: IconName) => `${type}:${iconName}`;

export const iconsWithType = [
  ...doctypeIcons.map(mapFn('doctype')),
  ...standardIcons.map(mapFn('standard')),
  ...utilityIcons.map(mapFn('utility')),
];
/**
 * Export helper for defining a list of all args and map that to an IconOBj
 */
export const iconObjMapping: any = {
  options: iconsWithType,
  mapping: {},
};
iconObjMapping.options.forEach((iconWithType) => {
  const [type, icon] = iconWithType.split(':');
  iconObjMapping.mapping[iconWithType] = { type, icon };
});

export const iconStringMapping: any = {
  options: iconsWithType,
  mapping: {},
};
iconStringMapping.options.forEach((iconWithType) => {
  const [type, icon] = iconWithType.split(':');
  iconStringMapping.mapping[iconWithType] = icon;
});
