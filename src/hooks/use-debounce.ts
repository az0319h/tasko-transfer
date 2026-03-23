import { useEffect, useState } from "react";

/**
 * 값의 debounce 처리를 위한 훅
 * @param value - debounce할 값
 * @param delay - 지연 시간 (ms)
 * @returns debounce된 값
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

