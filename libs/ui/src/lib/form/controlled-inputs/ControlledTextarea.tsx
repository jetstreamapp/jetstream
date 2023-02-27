import { ChangeEvent, DetailedHTMLProps, useEffect, useRef, useState } from 'react';

/**
 * https://stackoverflow.com/questions/46000544/react-controlled-input-cursor-jumps
 * If a user is entering text in the middle of an input, sometimes the cursor jumps (not always sure why this happens in some cases and not others)
 * @param props
 * @returns
 */
export const ControlledTextarea = (props: DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>) => {
  const { value, onChange, ...rest } = props;
  const [cursor, setCursor] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const input = ref.current;
    if (input) {
      input.setSelectionRange(cursor, cursor);
    }
  }, [ref, cursor, value]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setCursor(e.target.selectionStart);
    onChange && onChange(e);
  };

  return <textarea ref={ref} value={value} onChange={handleChange} {...rest} />;
};

export default ControlledTextarea;
