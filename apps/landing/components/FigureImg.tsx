/* eslint-disable @next/next/no-img-element */

export interface FigureImgProps {
  src: string;
  title: string;
  description: string;
  width: number | undefined;
  height: number | undefined;
}

export const FigureImg = ({ src, title, description, width, height }: FigureImgProps) => (
  <figure>
    <img className="w-full rounded-lg" src={src} alt={title} width={width} height={height} title={title} />
    <figcaption>{description}</figcaption>
  </figure>
);

export default FigureImg;
