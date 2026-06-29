"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({ value, onChange }: SearchInputProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setLocal(v);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChange(v), 200);
    },
    [onChange]
  );

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#ADADAC]" />
      <input
        type="text"
        value={local}
        onChange={handleChange}
        placeholder="Filter facilities, regions..."
        className="pl-8 pr-3 py-1.5 text-[13px] leading-[16px] font-mono border border-[#E5E5E5] rounded-[4px] w-56 bg-white text-[#1D1B16] focus:outline-none focus:border-[#FB631B] placeholder:text-[#ADADAC]"
      />
    </div>
  );
}
