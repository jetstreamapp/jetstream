import { Dialog, DialogBackdrop, TransitionChild } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Fragment } from 'react';

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
  return (
    <Dialog as="div" className="fixed z-10 inset-0 overflow-y-auto" open={isOpen} onClose={() => onClose()}>
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-500/75 transition-opacity data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
        onClick={() => onClose()}
      />
      <div className={className}>
        {/* This element is to trick the browser into centering the modal contents. */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          enterTo="opacity-100 translate-y-0 sm:scale-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 translate-y-0 sm:scale-100"
          leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
        >
          <div className={bodyClassName}>
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
        </TransitionChild>
      </div>
    </Dialog>
  );
};

export default Modal;
