import { css } from '@emotion/react';
import { Maybe } from '@jetstream/types';
import classNames from 'classnames';
import { useState } from 'react';

const BASE_URL = 'https://res.cloudinary.com/getjetstream/image/upload/v1699836265/public/create-object-sfdc-icons';

export interface TabIconListProps {
  selectedItem?: Maybe<string>;
  disabled?: boolean;
  onSelected: (selectedItem: string) => void;
}

export const TabIconList = ({ selectedItem, disabled, onSelected }: TabIconListProps) => {
  const [icons] = useState(() => getIcons(BASE_URL));

  return (
    <>
      {icons.map(({ id, url }) => (
        <button
          key={id}
          type="button"
          className={classNames('slds-button slds-button_icon slds-button_icon-border-filled slds-m-around_xx-small', {
            'slds-is-selected': id === selectedItem,
          })}
          aria-pressed={id === selectedItem ? 'true' : undefined}
          title={id}
          onClick={() => !disabled && onSelected(id)}
          disabled={disabled}
        >
          <img
            className="slds-button__icon"
            css={css`
              width: 32px;
              height: 32px;
              padding: 5px;
            `}
            src={url}
            alt={id}
          />
          <span className="slds-assistive-text">{id}</span>
        </button>
      ))}
    </>
  );
};

export default TabIconList;

function getIcons(baseUrl: string) {
  return [
    { id: 'Custom20: Airplane', url: `${baseUrl}/plane32_jgwhgz.png` },
    { id: 'Custom25: Alarmclock', url: `${baseUrl}/alarmClock32_luqnap.png` },
    { id: 'Custom51: Apple', url: `${baseUrl}/apple32_adocjh.png` },
    { id: 'Custom52: Balls', url: `${baseUrl}/balls32_igiu0k.png` },
    { id: 'Custom16: Bank', url: `${baseUrl}/bank32_qgwlqi.png` },
    { id: 'Custom53: Bell', url: `${baseUrl}/bell32_rzleif.png` },
    { id: 'Custom50: Bigtop', url: `${baseUrl}/bigtop32_cq8as8.png` },
    { id: 'Custom54: Boat', url: `${baseUrl}/boat32_efrme5.png` },
    { id: 'Custom55: Books', url: `${baseUrl}/books32_gbpqpo.png` },
    { id: 'Custom56: Bottle', url: `${baseUrl}/bottle32_mroomx.png` },
    { id: 'Custom13: Box', url: `${baseUrl}/box32_vmlonb.png` },
    { id: 'Custom37: Bridge', url: `${baseUrl}/bridge32_xlliou.png` },
    { id: 'Custom24: Building', url: `${baseUrl}/building32_k2jgod.png` },
    { id: 'Custom57: BuildingBlock', url: `${baseUrl}/buildingBlock32_w1btsx.png` },
    { id: 'Custom58: Caduceus', url: `${baseUrl}/caduceus32_akay1i.png` },
    { id: 'Custom38: Camera', url: `${baseUrl}/camera32_yohuwg.png` },
    { id: 'Custom59: Can', url: `${baseUrl}/can32_qdekse.png` },
    { id: 'Custom31: Car', url: `${baseUrl}/car32_d8ywmo.png` },
    { id: 'Custom60: Castle', url: `${baseUrl}/castle32_amf4nn.png` },
    { id: 'Custom49: CD/DVD', url: `${baseUrl}/cd32_ipvw2v.png` },
    { id: 'Custom28: Cellphone', url: `${baseUrl}/cellPhone32_fhyxhx.png` },
    { id: 'Custom62: Chalkboard', url: `${baseUrl}/chalkboard32_uwl26s.png` },
    { id: 'Custom47: Knight', url: `${baseUrl}/knight32_ppgrnd.png` },
    { id: 'Custom63: Chip', url: `${baseUrl}/chip32_ubxutt.png` },
    { id: 'Custom12: Circle', url: `${baseUrl}/circle32_s8hysk.png` },
    { id: 'Custom64: Compass', url: `${baseUrl}/compass32_tafefa.png` },
    { id: 'Custom21: Computer', url: `${baseUrl}/computer32_vihjbx.png` },
    { id: 'Custom40: Creditcard', url: `${baseUrl}/creditCard32_eeyrwb.png` },
    { id: 'Custom30: TVCTR', url: `${baseUrl}/tvCTR32_jxf4s8.png` },
    { id: 'Custom65: Cup', url: `${baseUrl}/cup32_qwnlon.png` },
    { id: 'Custom33: Desk', url: `${baseUrl}/desk32_tvarif.png` },
    { id: 'Custom34: Diamond', url: `${baseUrl}/diamond32_bxljkp.png` },
    { id: 'Custom66: Dice', url: `${baseUrl}/dice32_jxcjei.png` },
    { id: 'Custom32: Factory', url: `${baseUrl}/factory32_p8utxy.png` },
    { id: 'Custom2: Fan', url: `${baseUrl}/fan32_e75llj.png` },
    { id: 'Custom26: Flag', url: `${baseUrl}/flag32_pzlzpn.png` },
    { id: 'Custom18: Form', url: `${baseUrl}/form32_cvlprs.png` },
    { id: 'Custom67: Gears', url: `${baseUrl}/gears32_psx7pb.png` },
    { id: 'Custom68: Globe', url: `${baseUrl}/globe32_coh3kg.png` },
    { id: 'Custom69: Guitar', url: `${baseUrl}/guitar32_gmbjdj.png` },
    { id: 'Custom44: Hammer', url: `${baseUrl}/hammer32_wemifd.png` },
    { id: 'Custom14: Hands', url: `${baseUrl}/hands32_cntvwx.png` },
    { id: 'Custom70: Handsaw', url: `${baseUrl}/handsaw32_p0flbb.png` },
    { id: 'Custom71: Headset', url: `${baseUrl}/headset32_lofu70.png` },
    { id: 'Custom1: Heart', url: `${baseUrl}/heart32_eaa2ir.png` },
    { id: 'Custom72: Helicopter', url: `${baseUrl}/helicopter32_ntxu6r.png` },
    { id: 'Custom4: Hexagon', url: `${baseUrl}/hexagon32_sxrtqp.png` },
    { id: 'Custom73: HighwaySign', url: `${baseUrl}/highwaySign32_tfdaei.png` },
    { id: 'Custom74: HotAirBalloon', url: `${baseUrl}/hotairBalloon32_ayslr8.png` },
    { id: 'Custom34: Insect', url: `${baseUrl}/insect32_wuaysm.png` },
    { id: 'Custom75: IPPhone', url: `${baseUrl}/ipPhone32_c7uegr.png` },
    { id: 'Custom43: Jewel', url: `${baseUrl}/jewel32_xifkav.png` },
    { id: 'Custom76: Keys', url: `${baseUrl}/keys32_aj0x2t.png` },
    { id: 'Custom5: Leaf', url: `${baseUrl}/leaf32_kmijgn.png` },
    { id: 'Custom9: Lightning', url: `${baseUrl}/lightning32_asejtf.png` },
    { id: 'Custom77: Padlock', url: `${baseUrl}/padlock32_kh2ny5.png` },
    { id: 'Custom23: Envelope', url: `${baseUrl}/mail32_up1vzl.png` },
    { id: 'Custom78: Map', url: `${baseUrl}/map32_vtufcx.png` },
    { id: 'Custom79: MeasuringTape', url: `${baseUrl}/measuringTape32_ubklqp.png` },
    { id: 'Custom35: Microphone', url: `${baseUrl}/microphone32_sor1pf.png` },
    { id: 'Custom10: Moon', url: `${baseUrl}/moon32_ycbllx.png` },
    { id: 'Custom80: Motorcycle', url: `${baseUrl}/motorcycle32_drimq0.png` },
    { id: 'Custom81: MusicalNote', url: `${baseUrl}/musicalNote32_kdpqp5.png` },
    { id: 'Custom29: PDA', url: `${baseUrl}/pda32_gwovlc.png` },
    { id: 'Custom82: Pencil', url: `${baseUrl}/pencil32_y7koie.png` },
    { id: 'Custom22: Telephone', url: `${baseUrl}/phone32_in1tay.png` },
    { id: 'Custom46: Stamp', url: `${baseUrl}/stamp32_zsm9mm.png` },
    { id: 'Custom84: Presenter', url: `${baseUrl}/presenter32_ouqgd3.png` },
    { id: 'Custom30: Radardish', url: `${baseUrl}/radarDish32_kd7zyr.png` },
    { id: 'Custom85: RealEstateSign', url: `${baseUrl}/realEstateSign32_smb52n.png` },
    { id: 'Custom86: RedCross', url: `${baseUrl}/redcross32_mcrerf.png` },
    { id: 'Custom17: Sack', url: `${baseUrl}/sack32_iwl90r.png` },
    { id: 'Custom87: Safe', url: `${baseUrl}/safe32_axy3zo.png` },
    { id: 'Custom88: Sailboat', url: `${baseUrl}/sailboat32_ghzuzj.png` },
    { id: 'Custom89: Saxophone', url: `${baseUrl}/saxophone32_ep0jwo.png` },
    { id: 'Custom90: Scales', url: `${baseUrl}/scales32_v7czvl.png` },
    { id: 'Custom91: Shield', url: `${baseUrl}/shield32_vmglfp.png` },
    { id: 'Custom92: Ship', url: `${baseUrl}/ship32_bdrynk.png` },
    { id: 'Custom93: ShoppingCart', url: `${baseUrl}/shoppingCart32_e6a7xy.png` },
    { id: 'Custom7: Square', url: `${baseUrl}/square32_vv2gcs.png` },
    { id: 'Custom42: Cash', url: `${baseUrl}/cash32_twawub.png` },
    { id: 'Custom11: Star', url: `${baseUrl}/star32_ifwc4x.png` },
    { id: 'Custom94: Stethoscope', url: `${baseUrl}/stethoscope32_xjckl9.png` },
    { id: 'Custom95: Stopwatch', url: `${baseUrl}/stopwatch32_uhchy1.png` },
    { id: 'Custom96: StreetSign', url: `${baseUrl}/streetSign32_bawda1.png` },
    { id: 'Custom3: Sun', url: `${baseUrl}/sun32_chgd9j.png` },
    { id: 'Custom97: Telescope', url: `${baseUrl}/telescope32_jkn0xo.png` },
    { id: 'Custom98: Thermometer', url: `${baseUrl}/thermometer32_qccpmv.png` },
    { id: 'Custom45: Ticket', url: `${baseUrl}/ticket32_xqvcvl.png` },
    { id: 'Custom36: Train', url: `${baseUrl}/train32_s9xbvm.png` },
    { id: 'Custom98: Treasurechest', url: `${baseUrl}/chest32_nynsat.png` },
    { id: 'Custom6: Triangle', url: `${baseUrl}/triangle32_vx8rwr.png` },
    { id: 'Custom48: Trophy', url: `${baseUrl}/trophy32_wu9cbh.png` },
    { id: 'Custom98: Truck', url: `${baseUrl}/truck32_xv0urp.png` },
    { id: 'Custom100: TVWidescreen', url: `${baseUrl}/tvWidescreen32_km4t88.png` },
    { id: 'Custom60: Umbrella', url: `${baseUrl}/umbrella32_zcc4je.png` },
    { id: 'Custom82: Whistle', url: `${baseUrl}/whistle32_plnnnw.png` },
    { id: 'Custom19: Wrench', url: `${baseUrl}/wrench32_a7pfwt.png` },
  ];
}
