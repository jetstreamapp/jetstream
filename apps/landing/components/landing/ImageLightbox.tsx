import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { ArrowsPointingOutIcon, XMarkIcon } from '@heroicons/react/24/outline';
import classNames from 'classnames';
import { useCallback, useState } from 'react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  className?: string;
}

export const ImageLightbox = ({ src, alt, className }: ImageLightboxProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => setIsOpen(false), []);

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) {
        close();
      }
    },
  });

  const dismiss = useDismiss(context, { outsidePress: true });
  const role = useRole(context, { role: 'dialog' });

  const { getFloatingProps, getReferenceProps } = useInteractions([dismiss, role]);

  return (
    <>
      {/* Clickable thumbnail with hover overlay */}
      <button
        ref={refs.setReference}
        type="button"
        aria-label={`Expand image: ${alt}`}
        onClick={() => setIsOpen(true)}
        className={classNames(
          'group relative block w-full cursor-zoom-in overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400',
          className,
        )}
        {...getReferenceProps()}
      >
        <img src={src} alt={alt} className="w-full scale-[1.02]" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/20 group-focus-visible:bg-black/20">
          <span className="flex items-center gap-1.5 rounded-full bg-white/0 px-3 py-1.5 text-sm font-medium text-white opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 group-hover:bg-white/90 group-hover:text-gray-700 group-hover:opacity-100 group-focus-visible:bg-white/90 group-focus-visible:text-gray-700 group-focus-visible:opacity-100">
            <ArrowsPointingOutIcon className="size-4" />
            Click to expand
          </span>
        </div>
      </button>

      {/* Lightbox overlay */}
      {isOpen && (
        <FloatingPortal>
          <FloatingOverlay
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-8"
            lockScroll
          >
            <FloatingFocusManager context={context} modal returnFocus>
              {/* eslint-disable-next-line react-hooks/refs */}
              <div ref={refs.setFloating} className="flex flex-col items-end gap-2" aria-label={alt} {...getFloatingProps()}>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full bg-gray-900/80 p-2 text-white shadow-md ring-1 ring-white/20 transition-colors hover:bg-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                  aria-label="Close lightbox"
                >
                  <XMarkIcon className="size-6" />
                </button>
                <img src={src} alt={alt} className="max-h-[85vh] max-w-[90vw] rounded-xl shadow-2xl" />
              </div>
            </FloatingFocusManager>
          </FloatingOverlay>
        </FloatingPortal>
      )}
    </>
  );
};
