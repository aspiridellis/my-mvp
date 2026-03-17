// ── Flag styles ───────────────────────────────────────────────────────────────
const FLAG_STYLES = {
  'sleep-risk': {
    dot:   '#D97706',
    badge: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  },
  'early-start': {
    dot:   '#DC2626',
    badge: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  },
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
      <path d="M12.5 8.5A6 6 0 0 1 5.5 1.5a6 6 0 1 0 7 7z" fill="#D97706" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
      <path
        d="M4.5 1v3.5M4.5 7h.01"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ScheduleCard({ events, date, sleepTarget }) {
  const hasEvents = events.length > 0

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

      {/* ── Date header ── */}
      <div className="px-7 pt-7 pb-5 border-b border-[#F5F5F4]">
        <h2 className="text-2xl font-semibold text-[#1C1917] tracking-tight">
          {date}
        </h2>
      </div>

      {/* ── Timeline ── */}
      <div className={`px-7 ${hasEvents ? 'pt-5' : 'pt-4'}`}>
        {hasEvents ? (
          events.map((event, i) => (
            <TimelineEvent
              key={i}
              event={event}
              isLast={i === events.length - 1}
            />
          ))
        ) : (
          <EmptyState />
        )}
      </div>

      {/* ── Sleep target footer ── */}
      <div className="px-7 pb-6 border-t border-[#F5F5F4]">
        <div className="flex items-center gap-2 pt-5">
          <MoonIcon />
          <span className="text-sm text-[#78716C]">
            Sleep target tonight:{' '}
            <span className="font-semibold text-[#1C1917]">{sleepTarget}</span>
          </span>
        </div>
      </div>

    </div>
  )
}

// ── Timeline event ────────────────────────────────────────────────────────────
function TimelineEvent({ event, isLast }) {
  const flagStyle = event.flag ? FLAG_STYLES[event.flag.type] : null
  const dotColor  = flagStyle ? flagStyle.dot : '#D1D5DB'

  return (
    <div className="flex gap-0">
      {/* Time column */}
      <div className="w-[76px] flex-shrink-0 text-right pr-4 pt-0.5">
        <span className="text-xs font-medium text-[#A8A29E]">{event.time}</span>
      </div>

      {/* Spine */}
      <div className="flex flex-col items-center flex-shrink-0 w-4">
        <div
          className="w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0 ring-2 ring-white"
          style={{ backgroundColor: dotColor }}
        />
        {!isLast && (
          <div className="w-px flex-1 min-h-[2rem]" style={{ backgroundColor: '#E7E5E4' }} />
        )}
      </div>

      {/* Content */}
      <div className={`pl-3 ${isLast ? 'pb-0' : 'pb-5'} flex-1 min-w-0`}>
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <span className="text-sm font-semibold text-[#1C1917] leading-snug">
            {event.title}
          </span>
          {event.duration && (
            <span className="text-xs text-[#A8A29E] font-medium whitespace-nowrap mt-0.5 flex-shrink-0">
              {event.duration}
            </span>
          )}
        </div>

        {event.flag && flagStyle && (
          <div className="mt-2">
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border"
              style={{
                color:           flagStyle.badge.text,
                backgroundColor: flagStyle.badge.bg,
                borderColor:     flagStyle.badge.border,
              }}
            >
              <AlertIcon />
              {event.flag.label}
            </span>
            <p className="text-xs text-[#78716C] mt-1.5 leading-relaxed">
              {event.flag.note}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <p className="text-sm font-medium text-[#A8A29E]">No events today</p>
      <p className="text-xs text-[#C7C3BF] text-center max-w-[220px] leading-relaxed">
        Add <span className="font-mono">credentials.json</span> to{' '}
        <span className="font-mono">backend/</span> to connect Google Calendar
      </p>
    </div>
  )
}
