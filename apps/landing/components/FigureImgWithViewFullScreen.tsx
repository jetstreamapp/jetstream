/* eslint-disable @next/next/no-img-element */
import { Fragment, useState } from 'react';
import { FigureImgProps } from './FigureImg';
import Modal from './Modal';

export const FigureImgWithViewFullScreen = ({ src, title, description, width, height }: FigureImgProps) => {
  const [isOpen, setIsOpen] = useState(false);

  function handleClose() {
    setIsOpen(false);
  }
  return (
    <Fragment>
      <Modal
        className="flex items-end justify-center min-h-screen pb-20 text-center sm:block"
        bodyClassName="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:h-full sm:p-6"
        isOpen={isOpen}
        onClose={handleClose}
      >
        <figure>
          <img className="w-full rounded-lg" src={src} alt={title} width={width} height={height} title={title} />
          <figcaption>{description}</figcaption>
        </figure>
      </Modal>
      <figure>
        <img
          className="w-full rounded-lg cursor-pointer"
          src={src}
          alt={title}
          width={width}
          height={height}
          title={title}
          onClick={() => setIsOpen(true)}
        />
        <figcaption>{description}</figcaption>
      </figure>
    </Fragment>
  );
};

export default FigureImgWithViewFullScreen;
