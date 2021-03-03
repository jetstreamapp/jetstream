import React from 'react';

interface FigureImgProps {
  src: string;
  title: string;
  description: string;
  width: number;
  height: number;
}

export const FigureImg = ({ src, title, description, width, height }: FigureImgProps) => (
  <figure>
    <img className="w-full rounded-lg" src={src} alt={title} width={width} height={height} title={title} />
    {/* <figcaption>{asset.fields.description}</figcaption> */}
  </figure>
);

export default FigureImg;
