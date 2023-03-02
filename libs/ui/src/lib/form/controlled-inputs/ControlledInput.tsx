import { ChangeEvent, DetailedHTMLProps, useEffect, useRef, useState } from 'react';

/**
 * https://stackoverflow.com/questions/46000544/react-controlled-input-cursor-jumps
 * If a user is entering text in the middle of an input, sometimes the cursor jumps (not always sure why this happens in some cases and not others)
 * @param props
 * @returns
 */
export const ControlledInput = (props: DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {
  const { value, onChange, ...rest } = props;
  const [cursor, setCursor] = useState<number | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = ref.current;
    if (input) {
      input.setSelectionRange(cursor, cursor);
    }
  }, [ref, cursor, value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCursor(e.target.selectionStart);
    onChange && onChange(e);
  };

  return <input ref={ref} value={value} onChange={handleChange} {...rest} />;
};

export default ControlledInput;
