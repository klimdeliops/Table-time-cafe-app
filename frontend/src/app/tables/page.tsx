'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/hooks/useLocale';
import { apiFetch, ApiError } from '@/shared/api/client';
import { ReservationModal } from './ReservationModal';

type TableStatus = 'FREE' | 'RESERVED' | 'OCCUPIED' | 'CLEANING';

interface Table {
  id: string;
  restaurantId: string;
  number: number;
  capacity: number;
  x: number;
  y: number;
  status: TableStatus;
  statusExpiresAt: string | null;
}

const DOT_COLOR: Record<TableStatus, string> = {
  FREE:     'bg-green-500',
  RESERVED: 'bg-yellow-400',
  OCCUPIED: 'bg-red-500',
  CLEANING: 'bg-gray-400',
};

const GLOW_RGBA: Record<TableStatus, string> = {
  FREE:     'rgba(34, 197, 94, 0.85)',
  RESERVED: 'rgba(250, 204, 21, 0.85)',
  OCCUPIED: 'rgba(239, 68, 68, 0.85)',
  CLEANING: 'rgba(156, 163, 175, 0.85)',
};

const RING_CLS: Record<TableStatus, string> = {
  FREE:     'ring-green-400',
  RESERVED: 'ring-yellow-300',
  OCCUPIED: 'ring-red-400',
  CLEANING: 'ring-gray-300',
};

function getEffectiveStatus(table: Table, now: number): TableStatus {
  if (table.statusExpiresAt) {
    const expiresMs = new Date(table.statusExpiresAt).getTime();
    if (now >= expiresMs) return 'FREE';
  }
  return table.status;
}

function formatCountdown(expiresAt: string, now: number): string {
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const totalSec  = Math.ceil(remaining / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins > 0) return `освободится через ${mins} мин ${secs} сек`;
  return `освободится через ${secs} сек`;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

type ChipKey = 'now' | 'in1h' | 'tonight' | 'tomorrow';
interface TimeChip {
  key: ChipKey;
  date: string;
  startTime: string;
  endTime: string;
}

function buildTimeChips(): TimeChip[] {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayISO = now.toISOString().split('T')[0];
  const tomorrowISO = tomorrow.toISOString().split('T')[0];

  const h = now.getHours();
  const m = now.getMinutes();

  // "In 1 hour" might cross midnight
  const h1start = (h + 1) % 24;
  const h1end   = (h + 3) % 24;
  const h1date  = (h + 1) >= 24 ? tomorrowISO : todayISO;

  return [
    { key: 'now',      date: todayISO,    startTime: `${pad(h)}:${pad(m)}`,   endTime: `${pad((h + 2) % 24)}:${pad(m)}` },
    { key: 'in1h',     date: h1date,      startTime: `${pad(h1start)}:00`,    endTime: `${pad(h1end)}:00` },
    { key: 'tonight',  date: todayISO,    startTime: '19:00',                 endTime: '21:00' },
    { key: 'tomorrow', date: tomorrowISO, startTime: '09:00',                 endTime: '11:00' },
  ];
}

export default function TablesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLocale();

  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [date, setDate]           = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');
  const [guests, setGuests]       = useState(0);

  const [availableIds, setAvailableIds] = useState<Set<string> | null>(null);
  const [checking, setChecking]         = useState(false);

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const floorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<Table[]>('/api/tables')
      .then(setTables)
      .catch((err) => {
        setPageError(err instanceof ApiError ? err.message : 'Failed to load tables');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const guestsActive = guests >= 1;
    const timeComplete = !!(date && startTime && endTime && startTime < endTime);

    if (!guestsActive && !timeComplete) {
      setAvailableIds(null);
      setChecking(false);
      return;
    }

    if (tables.length === 0) {
      setAvailableIds(new Set());
      return;
    }

    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const requestedStartMs = timeComplete
      ? new Date(`${date}T${startTime}`).getTime()
      : null;
    const occupiedCanBook =
      requestedStartMs !== null && requestedStartMs >= Date.now() + TWO_HOURS_MS;

    const start = requestedStartMs ?? Date.now();
    const CLEANING_MAX_MS = 10 * 60 * 1000;

    const blockedByStatus = new Set(
      tables.filter((t) => {
        if (t.status === 'CLEANING') {
          const cleaningEndsMs = t.statusExpiresAt
            ? new Date(t.statusExpiresAt).getTime()
            : Date.now() + CLEANING_MAX_MS;
          return start < cleaningEndsMs;
        }
        if (t.status === 'OCCUPIED') return !occupiedCanBook;
        return false;
      }).map((t) => t.id),
    );

    if (guestsActive && !timeComplete) {
      setAvailableIds(new Set(
        tables
          .filter((t) => t.capacity >= guests && !blockedByStatus.has(t.id))
          .map((t) => t.id),
      ));
      setChecking(false);
      return;
    }

    const timer = setTimeout(() => {
      const restaurantIds = [...new Set(tables.map((t) => t.restaurantId))];
      const startISO = new Date(`${date}T${startTime}`).toISOString();
      const endISO   = new Date(`${date}T${endTime}`).toISOString();

      setChecking(true);

      Promise.all(
        restaurantIds.map((rId) => {
          const qs = new URLSearchParams({
            restaurantId: rId,
            startTime:    startISO,
            endTime:      endISO,
            numberOfGuests: String(Math.max(guests, 1)),
          });
          return apiFetch<Table[]>(`/api/reservations/available?${qs}`);
        }),
      )
        .then((results) => {
          let ids = results.flat().map((t) => t.id);
          if (guestsActive) {
            const capableIds = new Set(tables.filter((t) => t.capacity >= guests).map((t) => t.id));
            ids = ids.filter((id) => capableIds.has(id));
          }
                ids = ids.filter((id) => !blockedByStatus.has(id));
          setAvailableIds(new Set(ids));
        })
        .catch(() => setAvailableIds(new Set()))
        .finally(() => setChecking(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [date, startTime, endTime, guests, tables]);

  function handleTableSelect(table: Table) {
    if (!user) {
      router.push('/login?redirect=/tables');
      return;
    }
    setSelectedTable(table);
  }

  const CHIPS: TimeChip[] = buildTimeChips();

  function applyChip(chip: TimeChip) {
    setDate(chip.date);
    setStartTime(chip.startTime);
    setEndTime(chip.endTime);
  }

  const activeChip = CHIPS.find(
    (c) => c.date === date && c.startTime === startTime && c.endTime === endTime,
  )?.key ?? null;

  const filterActive = availableIds !== null;
  const hasAnyFilter = !!(date || startTime || endTime || guests);

  function resetFilters() {
    setDate('');
    setStartTime('');
    setEndTime('');
    setGuests(0);
    setAvailableIds(null);
  }

  const CHIP_LABELS: Record<ChipKey, string> = {
    now:      t('tables.chipNow'),
    in1h:     t('tables.chipIn1h'),
    tonight:  t('tables.chipTonight'),
    tomorrow: t('tables.chipTomorrow'),
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-brand-espresso/20 border-t-brand-espresso animate-spin" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card rounded-2xl px-6 py-6 text-center space-y-3 max-w-sm w-full">
          <p className="text-sm text-red-600">{pageError}</p>
          <button onClick={() => window.location.reload()} className="btn-amber rounded-xl px-5 py-2 text-sm font-semibold">
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const panelStyle = {
    backdropFilter: 'blur(20px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
    background: 'rgba(252,249,234,0.86)',
    border: '1px solid rgba(255,255,255,0.58)',
    boxShadow: '0 4px 28px rgba(0,0,0,0.09), inset 0 1px 0 rgba(255,255,255,0.72)',
  };

  return (
    <div
      className="min-h-screen -mt-[68px] pt-[68px] pb-6 px-4 sm:px-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #f4f7ec 0%, #edf2de 28%, #e2ebce 55%, #d6e4bc 78%, #ccdba8 100%)',
      }}
    >
      {/* Ambient blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Large top-left cream glow */}
        <div style={{
          position: 'absolute', top: '-12%', left: '-8%',
          width: '55%', height: '55%',
          background: 'radial-gradient(ellipse at 40% 40%, rgba(252,249,234,0.90) 0%, rgba(252,249,234,0.40) 42%, transparent 70%)',
          filter: 'blur(18px)',
        }} />
        {/* Mid-right green glow */}
        <div style={{
          position: 'absolute', top: '20%', right: '-10%',
          width: '50%', height: '50%',
          background: 'radial-gradient(ellipse at 60% 40%, rgba(174,183,132,0.55) 0%, rgba(174,183,132,0.22) 45%, transparent 70%)',
          filter: 'blur(24px)',
        }} />
        {/* Bottom-left soft green */}
        <div style={{
          position: 'absolute', bottom: '-8%', left: '10%',
          width: '45%', height: '45%',
          background: 'radial-gradient(ellipse at 40% 60%, rgba(174,183,132,0.40) 0%, rgba(174,183,132,0.14) 50%, transparent 72%)',
          filter: 'blur(20px)',
        }} />
        {/* Center highlight — bright specular glare */}
        <div style={{
          position: 'absolute', top: '8%', left: '30%',
          width: '40%', height: '28%',
          background: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 40%, transparent 68%)',
          filter: 'blur(12px)',
          transform: 'rotate(-8deg)',
        }} />
        {/* Bottom-right cream fade */}
        <div style={{
          position: 'absolute', bottom: '0', right: '0',
          width: '40%', height: '40%',
          background: 'radial-gradient(ellipse at 70% 70%, rgba(252,249,234,0.60) 0%, transparent 65%)',
          filter: 'blur(16px)',
        }} />
        {/* Subtle noise texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'200\' height=\'200\' filter=\'url(%23n)\' opacity=\'0.035\'/%3E%3C/svg%3E")',
          opacity: 0.6,
        }} />
      </div>

      <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-5 items-start relative z-10 pt-8">

        {/* ── LEFT: Floor map ─────────────────────────────────── */}
        <div className="flex-1 min-w-0 w-full">
          <div
            ref={floorRef}
            className="glass-card relative w-full aspect-[1672/941] rounded-2xl overflow-hidden"
          >
            <div className="absolute inset-0 pt-[5%] pr-[4%]">
              <Image
                src="/floor.png"
                alt="Floor plan"
                fill
                className="object-cover pointer-events-none"
                draggable={false}
                priority
              />
            </div>

            {tables.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-brand-espresso/40">
                {t('tables.noTables')}
              </p>
            )}

            {tables.map((table) => {
              const available = !filterActive || availableIds!.has(table.id);
              return (
                <TableDot
                  key={table.id}
                  table={table}
                  available={available}
                  filterActive={filterActive}
                  selected={selectedTable?.id === table.id}
                  onSelect={() => handleTableSelect(table)}
                />
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Booking panel ────────────────────────────── */}
        <aside className="w-full lg:w-[300px] xl:w-[320px] flex-shrink-0 lg:sticky lg:top-[80px]">
          <div className="rounded-2xl p-5 flex flex-col gap-5" style={panelStyle}>

            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-bold text-brand-espresso leading-tight">
                  {t('tables.title')}
                </h1>
                <p className="text-sm text-brand-espresso/45 mt-0.5">
                  {tables.length} {t('tables.tablesCount')}
                </p>
              </div>
              {!user && (
                <button
                  onClick={() => router.push('/login?redirect=/tables')}
                  className="btn-amber text-xs font-semibold rounded-xl px-3 py-1.5 flex-shrink-0"
                >
                  {t('reservation.loginToReserve')}
                </button>
              )}
            </div>

            {/* Popular time chips */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-brand-espresso/45 uppercase tracking-[0.12em]">
                {t('tables.popularTimes')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    onClick={() => applyChip(chip)}
                    className={[
                      'text-xs font-medium px-2.5 py-1 rounded-full border transition-all duration-150',
                      activeChip === chip.key
                        ? 'bg-brand-espresso text-brand-cream border-brand-espresso'
                        : 'bg-brand-espresso/6 border-brand-espresso/15 text-brand-espresso/65 hover:border-brand-espresso/30 hover:bg-brand-espresso/10',
                    ].join(' ')}
                  >
                    {CHIP_LABELS[chip.key]}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter fields — vertical stack */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-brand-espresso/45 uppercase tracking-[0.10em] mb-1.5">
                  {t('tables.date')}
                </label>
                <input
                  type="date"
                  min={todayStr()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="glass-input w-full rounded-xl px-3 py-2 text-sm text-brand-espresso focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-brand-espresso/45 uppercase tracking-[0.10em] mb-1.5">
                    {t('tables.from')}
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="glass-input w-full rounded-xl px-3 py-2 text-sm text-brand-espresso focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-brand-espresso/45 uppercase tracking-[0.10em] mb-1.5">
                    {t('tables.to')}
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="glass-input w-full rounded-xl px-3 py-2 text-sm text-brand-espresso focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-brand-espresso/45 uppercase tracking-[0.10em] mb-1.5">
                  {t('tables.guests')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={guests || ''}
                  placeholder={t('tables.anyGuests')}
                  onChange={(e) => setGuests(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="glass-input w-full rounded-xl px-3 py-2 text-sm text-brand-espresso placeholder:text-brand-espresso/30 focus:outline-none"
                />
              </div>
            </div>

            {/* Status line */}
            <div className="text-xs min-h-[1rem]">
              {checking && <span className="text-brand-espresso/40">{t('tables.checking')}</span>}
              {!checking && filterActive && availableIds!.size > 0 && (
                <span className="text-green-600 font-semibold">
                  {availableIds!.size} {availableIds!.size === 1 ? t('tables.matchSingle') : availableIds!.size < 5 ? t('tables.matchPlural') : t('tables.matchMany')}
                </span>
              )}
              {!checking && filterActive && availableIds!.size === 0 && (
                <span className="text-red-500">{t('tables.noMatch')}</span>
              )}
              {!checking && !filterActive && (
                <span className="text-brand-espresso/30">{t('tables.filterHint')}</span>
              )}
            </div>

            {/* Reset */}
            {hasAnyFilter && (
              <button
                onClick={resetFilters}
                className="text-xs text-brand-espresso/40 hover:text-brand-espresso/70 underline transition-colors text-left -mt-2"
              >
                {t('tables.resetFilters')}
              </button>
            )}

            {/* Legend */}
            <div className="border-t border-brand-espresso/8 pt-4 space-y-2">
              {(['FREE', 'RESERVED', 'OCCUPIED', 'CLEANING'] as TableStatus[]).map((status) => (
                <div key={status} className="flex items-center gap-2 text-sm text-brand-espresso/60">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_COLOR[status]}`} />
                  {t(`tables.legend.${status.toLowerCase() as 'free' | 'reserved' | 'occupied' | 'cleaning'}`)}
                </div>
              ))}
            </div>

          </div>
        </aside>

      </div>

      {selectedTable && (
        <ReservationModal
          table={selectedTable}
          initialDate={date}
          initialStartTime={startTime}
          initialEndTime={endTime}
          initialGuests={Math.max(guests, 1)}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  );
}

function TableDot({
  table,
  available,
  filterActive,
  selected,
  onSelect,
}: {
  table: Table;
  available: boolean;
  filterActive: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const now = useNow();

  const displayStatus = getEffectiveStatus(table, now);

  const visualStatus: TableStatus = (filterActive && available) ? 'FREE' : displayStatus;

  const clickable = available && visualStatus !== 'CLEANING';

  const glowOpacity = !clickable ? 0 : selected ? 0.60 : hovered ? 0.42 : 0.10;
  const dotScale    = selected ? 1.35 : (hovered && clickable) ? 1.18 : 1;
  const dotOpacity  = available ? 0.92 : 0.28;

  const selectionGlow = selected ? 'rgba(255,162,57,0.45)' : GLOW_RGBA[visualStatus];

  return (
    <div
      style={{ left: `${table.x}%`, top: `${table.y}%` }}
      className="absolute -translate-x-1/2 -translate-y-1/2"
    >
      <button
        onClick={clickable ? onSelect : undefined}
        disabled={!clickable}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`relative w-10 h-10 flex items-center justify-center rounded-full focus:outline-none ${
          clickable ? 'cursor-pointer' : 'cursor-not-allowed'
        }`}
      >
        {/* Wave pulse — all statuses except CLEANING and selected */}
        {!selected && visualStatus !== 'CLEANING' && (
          <>
            <span
              className={`absolute rounded-full table-wave pointer-events-none ${DOT_COLOR[visualStatus]}`}
              style={{ width: 18, height: 18 }}
            />
            <span
              className={`absolute rounded-full table-wave pointer-events-none ${DOT_COLOR[visualStatus]}`}
              style={{ width: 18, height: 18, animationDelay: '1.5s' }}
            />
          </>
        )}

        {/* Soft glow */}
        <span
          className="absolute pointer-events-none transition-opacity duration-250"
          style={{
            width: 72,
            height: 72,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${selectionGlow} 0%, transparent 68%)`,
            opacity: glowOpacity,
            filter: 'blur(5px)',
            borderRadius: '50%',
          }}
        />

        {/* Status dot */}
        <span
          className={`relative rounded-full transition-all duration-150 ${selected ? 'bg-amber-400' : DOT_COLOR[visualStatus]}`}
          style={{
            width: 7,
            height: 7,
            opacity: dotOpacity,
            transform: `scale(${dotScale})`,
          }}
        />

        {/* Selection ring — amber when selected */}
        {selected && (
          <span
            className={`absolute rounded-full ring-[1.5px] ring-offset-[2px] pointer-events-none ${RING_CLS[visualStatus]}`}
            style={{
              width: 16,
              height: 16,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}

        {/* Tooltip on hover / select */}
        {(hovered || selected) && (
          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-brand-espresso text-brand-cream rounded-lg whitespace-nowrap pointer-events-none shadow-lg flex flex-col items-center px-2.5 py-1.5 gap-0.5">
            <span className="text-[11px] font-bold">
              Стол №{table.number} · {table.capacity} места
            </span>
            {displayStatus === 'CLEANING' && table.statusExpiresAt && (
              <span className="text-[10px] opacity-65">
                {formatCountdown(table.statusExpiresAt, now)}
              </span>
            )}
          </span>
        )}
      </button>
    </div>
  );
}
