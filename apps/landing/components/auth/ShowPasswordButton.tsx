interface ShowPasswordButtonProps {
  isActive: boolean;
  onClick: () => void;
}

export function ShowPasswordButton({ isActive, onClick }: ShowPasswordButtonProps) {
  return (
    <button type="button" className="text-sm font-semibold leading-6 text-blue-600 hover:text-blue-700" onClick={() => onClick()}>
      {isActive ? 'Hide Password' : 'Show Password'}
    </button>
  );
}
