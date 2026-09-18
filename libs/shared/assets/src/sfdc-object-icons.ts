/**
 * Icons available for the `Tab Style` of a custom object (the 32px PNGs Salesforce offers in Setup).
 * The id is the Salesforce `Custom<N>: <Name>` tab style value, written verbatim into the `<motif>`
 * element of the CustomTab metadata deploy, so it has to match Salesforce exactly. The authoritative
 * list is the `MotifName` picklist on the Tooling API `CustomTab` describe, where the metadata form is
 * the picklist label with spaces removed (`Radar dish` -> `Custom30: Radardish`).
 *
 * `?no-inline` keeps Vite from inlining these as base64 data URIs - every file is under the default
 * 4096 byte limit, so without it all 98 land in the browser extension's always-loaded entry chunk.
 */
import alarmClock32Icon from '../public/images/sfdc-object-icons/alarmClock32.png?no-inline';
import apple32Icon from '../public/images/sfdc-object-icons/apple32.png?no-inline';
import balls32Icon from '../public/images/sfdc-object-icons/balls32.png?no-inline';
import bank32Icon from '../public/images/sfdc-object-icons/bank32.png?no-inline';
import bell32Icon from '../public/images/sfdc-object-icons/bell32.png?no-inline';
import bigtop32Icon from '../public/images/sfdc-object-icons/bigtop32.png?no-inline';
import boat32Icon from '../public/images/sfdc-object-icons/boat32.png?no-inline';
import books32Icon from '../public/images/sfdc-object-icons/books32.png?no-inline';
import bottle32Icon from '../public/images/sfdc-object-icons/bottle32.png?no-inline';
import box32Icon from '../public/images/sfdc-object-icons/box32.png?no-inline';
import bridge32Icon from '../public/images/sfdc-object-icons/bridge32.png?no-inline';
import building32Icon from '../public/images/sfdc-object-icons/building32.png?no-inline';
import buildingBlock32Icon from '../public/images/sfdc-object-icons/buildingBlock32.png?no-inline';
import caduceus32Icon from '../public/images/sfdc-object-icons/caduceus32.png?no-inline';
import camera32Icon from '../public/images/sfdc-object-icons/camera32.png?no-inline';
import can32Icon from '../public/images/sfdc-object-icons/can32.png?no-inline';
import car32Icon from '../public/images/sfdc-object-icons/car32.png?no-inline';
import cash32Icon from '../public/images/sfdc-object-icons/cash32.png?no-inline';
import castle32Icon from '../public/images/sfdc-object-icons/castle32.png?no-inline';
import cd32Icon from '../public/images/sfdc-object-icons/cd32.png?no-inline';
import cellPhone32Icon from '../public/images/sfdc-object-icons/cellPhone32.png?no-inline';
import chalkboard32Icon from '../public/images/sfdc-object-icons/chalkboard32.png?no-inline';
import chest32Icon from '../public/images/sfdc-object-icons/chest32.png?no-inline';
import chip32Icon from '../public/images/sfdc-object-icons/chip32.png?no-inline';
import circle32Icon from '../public/images/sfdc-object-icons/circle32.png?no-inline';
import compass32Icon from '../public/images/sfdc-object-icons/compass32.png?no-inline';
import computer32Icon from '../public/images/sfdc-object-icons/computer32.png?no-inline';
import creditCard32Icon from '../public/images/sfdc-object-icons/creditCard32.png?no-inline';
import cup32Icon from '../public/images/sfdc-object-icons/cup32.png?no-inline';
import desk32Icon from '../public/images/sfdc-object-icons/desk32.png?no-inline';
import diamond32Icon from '../public/images/sfdc-object-icons/diamond32.png?no-inline';
import dice32Icon from '../public/images/sfdc-object-icons/dice32.png?no-inline';
import factory32Icon from '../public/images/sfdc-object-icons/factory32.png?no-inline';
import fan32Icon from '../public/images/sfdc-object-icons/fan32.png?no-inline';
import flag32Icon from '../public/images/sfdc-object-icons/flag32.png?no-inline';
import form32Icon from '../public/images/sfdc-object-icons/form32.png?no-inline';
import gears32Icon from '../public/images/sfdc-object-icons/gears32.png?no-inline';
import globe32Icon from '../public/images/sfdc-object-icons/globe32.png?no-inline';
import guitar32Icon from '../public/images/sfdc-object-icons/guitar32.png?no-inline';
import hammer32Icon from '../public/images/sfdc-object-icons/hammer32.png?no-inline';
import hands32Icon from '../public/images/sfdc-object-icons/hands32.png?no-inline';
import handsaw32Icon from '../public/images/sfdc-object-icons/handsaw32.png?no-inline';
import headset32Icon from '../public/images/sfdc-object-icons/headset32.png?no-inline';
import heart32Icon from '../public/images/sfdc-object-icons/heart32.png?no-inline';
import helicopter32Icon from '../public/images/sfdc-object-icons/helicopter32.png?no-inline';
import hexagon32Icon from '../public/images/sfdc-object-icons/hexagon32.png?no-inline';
import highwaySign32Icon from '../public/images/sfdc-object-icons/highwaySign32.png?no-inline';
import hotairBalloon32Icon from '../public/images/sfdc-object-icons/hotairBalloon32.png?no-inline';
import insect32Icon from '../public/images/sfdc-object-icons/insect32.png?no-inline';
import ipPhone32Icon from '../public/images/sfdc-object-icons/ipPhone32.png?no-inline';
import jewel32Icon from '../public/images/sfdc-object-icons/jewel32.png?no-inline';
import keys32Icon from '../public/images/sfdc-object-icons/keys32.png?no-inline';
import knight32Icon from '../public/images/sfdc-object-icons/knight32.png?no-inline';
import leaf32Icon from '../public/images/sfdc-object-icons/leaf32.png?no-inline';
import lightning32Icon from '../public/images/sfdc-object-icons/lightning32.png?no-inline';
import mail32Icon from '../public/images/sfdc-object-icons/mail32.png?no-inline';
import map32Icon from '../public/images/sfdc-object-icons/map32.png?no-inline';
import measuringTape32Icon from '../public/images/sfdc-object-icons/measuringTape32.png?no-inline';
import microphone32Icon from '../public/images/sfdc-object-icons/microphone32.png?no-inline';
import moon32Icon from '../public/images/sfdc-object-icons/moon32.png?no-inline';
import motorcycle32Icon from '../public/images/sfdc-object-icons/motorcycle32.png?no-inline';
import musicalNote32Icon from '../public/images/sfdc-object-icons/musicalNote32.png?no-inline';
import padlock32Icon from '../public/images/sfdc-object-icons/padlock32.png?no-inline';
import pda32Icon from '../public/images/sfdc-object-icons/pda32.png?no-inline';
import pencil32Icon from '../public/images/sfdc-object-icons/pencil32.png?no-inline';
import phone32Icon from '../public/images/sfdc-object-icons/phone32.png?no-inline';
import plane32Icon from '../public/images/sfdc-object-icons/plane32.png?no-inline';
import presenter32Icon from '../public/images/sfdc-object-icons/presenter32.png?no-inline';
import radarDish32Icon from '../public/images/sfdc-object-icons/radarDish32.png?no-inline';
import realEstateSign32Icon from '../public/images/sfdc-object-icons/realEstateSign32.png?no-inline';
import redcross32Icon from '../public/images/sfdc-object-icons/redcross32.png?no-inline';
import sack32Icon from '../public/images/sfdc-object-icons/sack32.png?no-inline';
import safe32Icon from '../public/images/sfdc-object-icons/safe32.png?no-inline';
import sailboat32Icon from '../public/images/sfdc-object-icons/sailboat32.png?no-inline';
import saxophone32Icon from '../public/images/sfdc-object-icons/saxophone32.png?no-inline';
import scales32Icon from '../public/images/sfdc-object-icons/scales32.png?no-inline';
import shield32Icon from '../public/images/sfdc-object-icons/shield32.png?no-inline';
import ship32Icon from '../public/images/sfdc-object-icons/ship32.png?no-inline';
import shoppingCart32Icon from '../public/images/sfdc-object-icons/shoppingCart32.png?no-inline';
import square32Icon from '../public/images/sfdc-object-icons/square32.png?no-inline';
import stamp32Icon from '../public/images/sfdc-object-icons/stamp32.png?no-inline';
import star32Icon from '../public/images/sfdc-object-icons/star32.png?no-inline';
import stethoscope32Icon from '../public/images/sfdc-object-icons/stethoscope32.png?no-inline';
import stopwatch32Icon from '../public/images/sfdc-object-icons/stopwatch32.png?no-inline';
import streetSign32Icon from '../public/images/sfdc-object-icons/streetSign32.png?no-inline';
import sun32Icon from '../public/images/sfdc-object-icons/sun32.png?no-inline';
import telescope32Icon from '../public/images/sfdc-object-icons/telescope32.png?no-inline';
import thermometer32Icon from '../public/images/sfdc-object-icons/thermometer32.png?no-inline';
import ticket32Icon from '../public/images/sfdc-object-icons/ticket32.png?no-inline';
import train32Icon from '../public/images/sfdc-object-icons/train32.png?no-inline';
import triangle32Icon from '../public/images/sfdc-object-icons/triangle32.png?no-inline';
import trophy32Icon from '../public/images/sfdc-object-icons/trophy32.png?no-inline';
import truck32Icon from '../public/images/sfdc-object-icons/truck32.png?no-inline';
import tvCTR32Icon from '../public/images/sfdc-object-icons/tvCTR32.png?no-inline';
import tvWidescreen32Icon from '../public/images/sfdc-object-icons/tvWidescreen32.png?no-inline';
import umbrella32Icon from '../public/images/sfdc-object-icons/umbrella32.png?no-inline';
import whistle32Icon from '../public/images/sfdc-object-icons/whistle32.png?no-inline';
import wrench32Icon from '../public/images/sfdc-object-icons/wrench32.png?no-inline';

export interface SfdcObjectTabIcon {
  id: string;
  url: string;
}

export const SFDC_OBJECT_TAB_ICONS: SfdcObjectTabIcon[] = [
  { id: 'Custom20: Airplane', url: plane32Icon },
  { id: 'Custom25: Alarmclock', url: alarmClock32Icon },
  { id: 'Custom51: Apple', url: apple32Icon },
  { id: 'Custom52: Balls', url: balls32Icon },
  { id: 'Custom16: Bank', url: bank32Icon },
  { id: 'Custom53: Bell', url: bell32Icon },
  { id: 'Custom50: Bigtop', url: bigtop32Icon },
  { id: 'Custom54: Boat', url: boat32Icon },
  { id: 'Custom55: Books', url: books32Icon },
  { id: 'Custom56: Bottle', url: bottle32Icon },
  { id: 'Custom13: Box', url: box32Icon },
  { id: 'Custom37: Bridge', url: bridge32Icon },
  { id: 'Custom24: Building', url: building32Icon },
  { id: 'Custom57: BuildingBlock', url: buildingBlock32Icon },
  { id: 'Custom58: Caduceus', url: caduceus32Icon },
  { id: 'Custom38: Camera', url: camera32Icon },
  { id: 'Custom59: Can', url: can32Icon },
  { id: 'Custom31: Car', url: car32Icon },
  { id: 'Custom61: Castle', url: castle32Icon },
  { id: 'Custom49: CD/DVD', url: cd32Icon },
  { id: 'Custom28: Cellphone', url: cellPhone32Icon },
  { id: 'Custom62: Chalkboard', url: chalkboard32Icon },
  { id: 'Custom47: Chesspiece', url: knight32Icon },
  { id: 'Custom63: Chip', url: chip32Icon },
  { id: 'Custom12: Circle', url: circle32Icon },
  { id: 'Custom64: Compass', url: compass32Icon },
  { id: 'Custom21: Computer', url: computer32Icon },
  { id: 'Custom40: Creditcard', url: creditCard32Icon },
  { id: 'Custom99: CRTTV', url: tvCTR32Icon },
  { id: 'Custom65: Cup', url: cup32Icon },
  { id: 'Custom33: Desk', url: desk32Icon },
  { id: 'Custom8: Diamond', url: diamond32Icon },
  { id: 'Custom66: Dice', url: dice32Icon },
  { id: 'Custom32: Factory', url: factory32Icon },
  { id: 'Custom2: Fan', url: fan32Icon },
  { id: 'Custom26: Flag', url: flag32Icon },
  { id: 'Custom18: Form', url: form32Icon },
  { id: 'Custom67: Gears', url: gears32Icon },
  { id: 'Custom68: Globe', url: globe32Icon },
  { id: 'Custom69: Guitar', url: guitar32Icon },
  { id: 'Custom44: Hammer', url: hammer32Icon },
  { id: 'Custom14: Hands', url: hands32Icon },
  { id: 'Custom70: Handsaw', url: handsaw32Icon },
  { id: 'Custom71: Headset', url: headset32Icon },
  { id: 'Custom1: Heart', url: heart32Icon },
  { id: 'Custom72: Helicopter', url: helicopter32Icon },
  { id: 'Custom4: Hexagon', url: hexagon32Icon },
  { id: 'Custom73: HighwaySign', url: highwaySign32Icon },
  { id: 'Custom74: HotAirBalloon', url: hotairBalloon32Icon },
  { id: 'Custom34: Insect', url: insect32Icon },
  { id: 'Custom75: IPPhone', url: ipPhone32Icon },
  { id: 'Custom43: Jewel', url: jewel32Icon },
  { id: 'Custom76: Keys', url: keys32Icon },
  { id: 'Custom5: Leaf', url: leaf32Icon },
  { id: 'Custom9: Lightning', url: lightning32Icon },
  { id: 'Custom77: Locked', url: padlock32Icon },
  { id: 'Custom23: Mail', url: mail32Icon },
  { id: 'Custom78: Map', url: map32Icon },
  { id: 'Custom79: MeasuringTape', url: measuringTape32Icon },
  { id: 'Custom35: Microphone', url: microphone32Icon },
  { id: 'Custom10: Moon', url: moon32Icon },
  { id: 'Custom80: Motorcycle', url: motorcycle32Icon },
  { id: 'Custom81: MusicalNote', url: musicalNote32Icon },
  { id: 'Custom29: PDA', url: pda32Icon },
  { id: 'Custom83: Pencil', url: pencil32Icon },
  { id: 'Custom22: Phone', url: phone32Icon },
  { id: 'Custom46: Postage', url: stamp32Icon },
  { id: 'Custom84: Presenter', url: presenter32Icon },
  { id: 'Custom30: Radardish', url: radarDish32Icon },
  { id: 'Custom85: RealEstateSign', url: realEstateSign32Icon },
  { id: 'Custom86: RedCross', url: redcross32Icon },
  { id: 'Custom17: Sack', url: sack32Icon },
  { id: 'Custom87: Safe', url: safe32Icon },
  { id: 'Custom88: Sailboat', url: sailboat32Icon },
  { id: 'Custom89: Saxophone', url: saxophone32Icon },
  { id: 'Custom90: Scales', url: scales32Icon },
  { id: 'Custom91: Shield', url: shield32Icon },
  { id: 'Custom92: Ship', url: ship32Icon },
  { id: 'Custom93: ShoppingCart', url: shoppingCart32Icon },
  { id: 'Custom7: Square', url: square32Icon },
  { id: 'Custom41: StackofCash', url: cash32Icon },
  { id: 'Custom11: Star', url: star32Icon },
  { id: 'Custom94: Stethoscope', url: stethoscope32Icon },
  { id: 'Custom95: Stopwatch', url: stopwatch32Icon },
  { id: 'Custom96: StreetSign', url: streetSign32Icon },
  { id: 'Custom3: Sun', url: sun32Icon },
  { id: 'Custom39: Telescope', url: telescope32Icon },
  { id: 'Custom97: Thermometer', url: thermometer32Icon },
  { id: 'Custom45: Ticket', url: ticket32Icon },
  { id: 'Custom36: Train', url: train32Icon },
  { id: 'Custom42: Treasurechest', url: chest32Icon },
  { id: 'Custom6: Triangle', url: triangle32Icon },
  { id: 'Custom48: Trophy', url: trophy32Icon },
  { id: 'Custom98: Truck', url: truck32Icon },
  { id: 'Custom100: TVWidescreen', url: tvWidescreen32Icon },
  { id: 'Custom60: Umbrella', url: umbrella32Icon },
  { id: 'Custom82: Whistle', url: whistle32Icon },
  { id: 'Custom19: Wrench', url: wrench32Icon },
];
