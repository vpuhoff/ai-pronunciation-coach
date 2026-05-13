import React, { useEffect, useState } from 'react';

export interface MetricBarProps {
  label: string;
  value: number;
  /** Tailwind bg-* token, e.g. `bg-cyan-500` (text color derived for the numeric label). */
  colorClass: string;
  /** When true, skip transform transition — final fill immediately (plan 001 Step 11). */
  reduceMotion?: boolean;
}

/** Fill animation duration (plan 001 Step 7: 500–800ms). */
const METRIC_FILL_MS = 650;

/**
 * Deep Analysis bar: `transform: scaleX` + ease-out, no `width` / `transition-all` on load.
 * @see docs/ai/plans/001-session-results-responsive-dynamics.md Step 7, Step 11 (`reduceMotion`)
 */
export const MetricBar: React.FC<MetricBarProps> = ({ label, value, colorClass, reduceMotion = false }) => {
  const clamped = Math.min(100, Math.max(0, value));
  const [fill, setFill] = useState(() => (reduceMotion ? clamped : 0));

  useEffect(() => {
    if (reduceMotion) {
      setFill(clamped);
      return;
    }
    setFill(0);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setFill(clamped);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [clamped, reduceMotion]);

  const scale = fill / 100;
  const textColorClass = colorClass.replace('bg-', 'text-');

  return (
    <div className="flex min-w-0 w-full flex-col gap-1">
      <div className="flex items-end justify-between text-xs">
        <span className="font-medium text-slate-400">{label}</span>
        <span className={`font-bold ${textColorClass}`}>{Math.round(fill)}</span>
      </div>
      <div className="h-2 min-w-0 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className={`h-full w-full origin-left rounded-full ${colorClass}`}
          style={{
            transform: `scaleX(${scale})`,
            transition: reduceMotion
              ? 'none'
              : `transform ${METRIC_FILL_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`,
          }}
        />
      </div>
    </div>
  );
};
