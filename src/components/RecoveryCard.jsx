function timeSince(iso) {
  if (!iso) return null
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

export default function RecoveryCard({ recovery, fetchedAt, source }) {
  const {
    score, status, hrv, hrv_trend,
    resting_hr, temp_delta,
    sleep_total, sleep_deep, sleep_rem,
  } = recovery

  // ── SVG ring ────────────────────────────────────────────────────────────────
  const size         = 140
  const strokeWidth  = 8          // thinner than before
  const radius       = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress     = (score / 100) * circumference

  // ── Status badge colours ─────────────────────────────────────────────────────
  const statusColors = {
    Good:    { text: '#16A34A', bg: '#F0FDF4', dot: '#16A34A' },
    Warning: { text: '#D97706', bg: '#FFFBEB', dot: '#D97706' },
    Low:     { text: '#DC2626', bg: '#FEF2F2', dot: '#DC2626' },
  }
  const sc = statusColors[status] ?? statusColors.Good

  // ── Metric colour signals ────────────────────────────────────────────────────
  const isHrvPositive  = hrv_trend && hrv_trend.startsWith('+')
  const isHrvNegative  = hrv_trend && hrv_trend.startsWith('-')
  const hrvValueColor  = isHrvPositive ? '#16A34A' : isHrvNegative ? '#D97706' : '#1C1917'

  const tempSign      = temp_delta > 0 ? '+' : ''
  const tempNote      = temp_delta > 0.3 ? 'Elevated' : temp_delta < -0.3 ? 'Below baseline' : 'Normal'
  const tempNoteColor = temp_delta > 0.3 ? '#D97706' : '#64748B'
  const tempValueColor = '#64748B'  // always blue-gray — temp deviations feel clinical

  const syncLabel = timeSince(fetchedAt)

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">

      {/* ── Tiny header: sync + status badge ── */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-[11px] text-[#C7C3BF]">
          {source === 'oura' && syncLabel ? `Oura · ${syncLabel}` : syncLabel ?? ''}
        </span>
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ color: sc.text, backgroundColor: sc.bg }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
          {status}
        </span>
      </div>

      {/* ── Centered ring ── */}
      <div className="flex justify-center mb-7">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            {/* Track */}
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke="#F5F5F4" strokeWidth={strokeWidth}
            />
            {/* Progress */}
            <circle
              cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke="#D97706" strokeWidth={strokeWidth}
              strokeDasharray={`${progress} ${circumference}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-[42px] font-bold text-[#1C1917] leading-none tracking-tight">
              {score}
            </span>
            <span className="text-[10px] font-medium text-[#A8A29E] tracking-wide uppercase">
              Recovery Score
            </span>
          </div>
        </div>
      </div>

      {/* ── Metric rows ── */}
      <div className="space-y-3.5 mb-6">
        <MetricRow
          label="HRV"
          value={`${hrv} ms`}
          valueColor={hrvValueColor}
          note={hrv_trend}
          noteColor={isHrvPositive ? '#16A34A' : isHrvNegative ? '#D97706' : '#A8A29E'}
        />
        <MetricRow
          label="Resting HR"
          value={`${resting_hr} bpm`}
          valueColor="#1C1917"
        />
        <MetricRow
          label="Temp deviation"
          value={`${tempSign}${temp_delta}°`}
          valueColor={tempValueColor}
          note={tempNote}
          noteColor={tempNoteColor}
        />
      </div>

      {/* ── Sleep section ── */}
      <div className="border-t border-[#F5F5F4] pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A8A29E] mb-3">
          Last night's sleep
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          <SleepStat label="Total" value={sleep_total} />
          <SleepStat label="Deep"  value={sleep_deep} />
          <SleepStat label="REM"   value={sleep_rem} />
        </div>
      </div>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricRow({ label, value, valueColor, note, noteColor }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-[#A8A29E] font-medium">{label}</span>
      <div className="flex items-baseline gap-2">
        <span
          className="text-[15px] font-bold"
          style={{ color: valueColor ?? '#1C1917' }}
        >
          {value}
        </span>
        {note && (
          <span className="text-xs font-medium" style={{ color: noteColor ?? '#A8A29E' }}>
            {note}
          </span>
        )}
      </div>
    </div>
  )
}

function SleepStat({ label, value }) {
  return (
    <div className="bg-[#FAFAF8] rounded-xl px-2 py-2.5 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#A8A29E] mb-1">
        {label}
      </p>
      <p className="text-sm font-bold text-[#1C1917]">{value}</p>
    </div>
  )
}
