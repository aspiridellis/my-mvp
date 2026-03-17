export default function TrainingCard({ training }) {
  const { recommendation, type, duration, intensity, notes } = training

  return (
    <div className="bg-white rounded-2xl p-6 shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-[#78716C]">
          Training
        </h2>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FFFBEB] text-[#D97706]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
          {intensity}
        </span>
      </div>

      {/* Recommendation */}
      <p className="text-xl font-semibold text-[#1C1917] mb-1">{recommendation}</p>

      {/* Type + duration chips */}
      <div className="flex items-center gap-2 mb-4">
        <Chip>{type}</Chip>
        <Chip>{duration}</Chip>
      </div>

      {/* Divider */}
      <div className="border-t border-[#F5F5F4] mb-4" />

      {/* Notes */}
      <p className="text-sm text-[#78716C] leading-relaxed">{notes}</p>
    </div>
  )
}

function Chip({ children }) {
  return (
    <span className="text-xs font-medium text-[#78716C] bg-[#F5F5F4] px-2.5 py-1 rounded-lg">
      {children}
    </span>
  )
}
