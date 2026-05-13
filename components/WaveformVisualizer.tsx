import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  dataUser: { time: number; value: number }[];
  dataRef: { time: number; value: number }[];
  height?: number;
  /**
   * Стабильный ключ смены «сессии» графика (phrase + сигнатура кривых / результата).
   * Сбрасывает одноразовую анимацию при retry / другой записи из истории (plan 001 Step 8).
   */
  animationKey: string;
  /** Единый флаг из ResultScreen — plan 001 Step 11 (`prefers-reduced-motion: reduce`). */
  reduceMotion: boolean;
}

/**
 * Pitch Contour: Recharts + IO (один показ на монтирование и `animationKey`), без повторной анимации при resize.
 * @see docs/ai/plans/001-session-results-responsive-dynamics.md Step 8, Step 11 (`reduceMotion` с родителя)
 */
export const WaveformVisualizer: React.FC<Props> = ({
  dataUser,
  dataRef,
  height = 120,
  animationKey,
  reduceMotion,
}) => {
  const uid = useId().replace(/:/g, '');
  const gradRefId = `pitch-grad-ref-${uid}`;
  const gradUserId = `pitch-grad-user-${uid}`;

  const chartData = useMemo(
    () =>
      dataRef.map((refPoint, i) => ({
        time: refPoint.time,
        ref: refPoint.value,
        user: dataUser[i] ? dataUser[i].value : 0,
      })),
    [dataUser, dataRef]
  );

  const shellRef = useRef<HTMLDivElement>(null);
  /** 0 = до первого пересечения viewport (или ждём IO); 1 = один раз «раскрыли» график для текущего animationKey. */
  const [revealTick, setRevealTick] = useState(0);

  useEffect(() => {
    setRevealTick(0);
  }, [animationKey]);

  useEffect(() => {
    if (reduceMotion) {
      setRevealTick(1);
      return;
    }
    const el = shellRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setRevealTick((t) => (t < 1 ? 1 : t));
      },
      { root: null, rootMargin: '0px 0px 10% 0px', threshold: 0.1 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [animationKey, reduceMotion]);

  const chartRemountKey = reduceMotion ? `${animationKey}|m` : `${animationKey}|${revealTick}`;

  const runChartAnimation = !reduceMotion && revealTick >= 1;

  return (
    <div className="w-full min-w-0 max-w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2">
      <div className="mb-1 flex justify-between px-2 text-slate-400 max-lg:text-[clamp(0.625rem,1.4vw+0.45rem,0.75rem)] lg:text-xs">
        <span>Pitch Contour</span>
        <div className="flex gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> Reference
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400" /> You
          </span>
        </div>
      </div>
      <div
        ref={shellRef}
        className="min-w-0 w-full"
        style={{ height: `${height}px`, minWidth: 0 }}
      >
        <ResponsiveContainer
          key={chartRemountKey}
          width="100%"
          height="100%"
          minWidth={0}
        >
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={gradRefId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={gradUserId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[0, 100]} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
            <Area
              type="monotone"
              dataKey="ref"
              stroke="#22d3ee"
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#${gradRefId})`}
              isAnimationActive={runChartAnimation}
            />
            <Area
              type="monotone"
              dataKey="user"
              stroke="#fb7185"
              strokeDasharray="3 3"
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#${gradUserId})`}
              isAnimationActive={runChartAnimation}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
