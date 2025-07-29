import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  useTransitionStyles,
} from '@floating-ui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export interface ModalProps {
  isOpen: boolean;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
  onClose: () => void;
}

export const Modal = ({
  className = 'flex items-end justify-center min-h-screen p-6 text-center sm:block sm:p-0',
  bodyClassName = 'relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full sm:p-6',
  isOpen,
  children,
  onClose,
}: ModalProps) => {
  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) {
        onClose();
      }
    },
  });

  const dismiss = useDismiss(context, {
    outsidePress: true,
  });
  const role = useRole(context, { role: 'dialog' });

  const { getFloatingProps } = useInteractions([dismiss, role]);

  // Transition styles for the modal content
  const { isMounted, styles: transitionStyles } = useTransitionStyles(context, {
    duration: {
      open: 300,
      close: 200,
    },
    initial: {
      opacity: 0,
      transform: 'translateY(1rem) scale(0.95)',
    },
    open: {
      opacity: 1,
      transform: 'translateY(0) scale(1)',
    },
    close: {
      opacity: 0,
      transform: 'translateY(1rem) scale(0.95)',
    },
  });

  if (!isMounted) return null;

  return (
    <FloatingPortal>
      <FloatingOverlay className="fixed inset-0 bg-gray-500/75 transition-opacity duration-300 data-open:opacity-100" lockScroll>
        <div className={className}>
          {/* This element is to trick the browser into centering the modal contents. */}
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
            &#8203;
          </span>
          <FloatingFocusManager context={context} modal returnFocus>
            <div ref={refs.setFloating} className={bodyClassName} style={transitionStyles} {...getFloatingProps()}>
              <div className="hidden sm:block absolute top-0 right-0 pt-2 pr-2">
                <button
                  type="button"
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => onClose()}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              {children}
            </div>
          </FloatingFocusManager>
        </div>
      </FloatingOverlay>
    </FloatingPortal>
  );
};

export default Modal;
