import { useLocation } from 'react-router-dom';

export function useLocationState<T = unknown>() {
  const { state } = useLocation();
  return state as Partial<T> | null;
}
