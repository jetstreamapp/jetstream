/**
 * The source asset has a large transparent margin, so Cloudinary's trim transformation is applied
 * to keep the shield flush with surrounding content. Dimensions are those of the trimmed image so the
 * browser reserves the right footprint before the lazy image loads.
 */
const SOC2_BADGE = {
  src: 'https://res.cloudinary.com/getjetstream/image/upload/e_trim/v1788963624/A_LIGN_badge_SOC_2_gu4mu2.png',
  alt: 'SOC 2 Type II, audited by A-LIGN',
  width: 938,
  height: 1200,
};

/** A-LIGN's logo usage terms require every use of their badge to link to their website. */
const A_LIGN_URL = 'https://www.a-lign.com';

export interface Soc2BadgeProps {
  /** Applied to the wrapping link, use for layout (positioning, margins, flex behavior). */
  className?: string;
  /** Applied to the image, use for sizing. */
  imageClassName?: string;
}

/**
 * A-LIGN SOC 2 badge, always wrapped in a link to A-LIGN as their logo terms require.
 * Render this component rather than the image directly so the link is never omitted.
 */
export const Soc2Badge = ({ className, imageClassName }: Soc2BadgeProps) => (
  <a href={A_LIGN_URL} target="_blank" rel="noreferrer" className={className}>
    <img
      className={imageClassName}
      src={SOC2_BADGE.src}
      alt={SOC2_BADGE.alt}
      width={SOC2_BADGE.width}
      height={SOC2_BADGE.height}
      loading="lazy"
    />
  </a>
);

export default Soc2Badge;
