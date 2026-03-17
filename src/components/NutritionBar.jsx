export default function NutritionBar({ nutrition }) {
  const { protein_target, calories, note } = nutrition

  // Assume rough progress for visual interest — in a real app this would come from logged food
  const proteinLogged = 0
  const caloriesLogged = 0

  return (
    <div className="bg-white rounded-2xl px-6 py-5 shadow-card">
      <div className="flex items-start gap-8">
        {/* Header label */}
        <div className="flex-shrink-0 pt-0.5">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#78716C]">
            Nutrition Targets
          </p>
          <p className="text-xs text-[#A8A29E] mt-0.5">Today</p>
        </div>

        {/* Vertical divider */}
        <div className="w-px self-stretch bg-[#F5F5F4]" />

        {/* Protein */}
        <NutritionTarget
          label="Protein"
          value={protein_target}
          unit="g"
          logged={proteinLogged}
          color="#D97706"
        />

        {/* Divider */}
        <div className="w-px self-stretch bg-[#F5F5F4]" />

        {/* Calories */}
        <NutritionTarget
          label="Calories"
          value={calories}
          unit="kcal"
          logged={caloriesLogged}
          color="#D97706"
          wide
        />

        {/* Divider */}
        <div className="w-px self-stretch bg-[#F5F5F4]" />

        {/* Note */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A8A29E] mb-1.5">
            Today's note
          </p>
          <p className="text-sm text-[#78716C] leading-relaxed">{note}</p>
        </div>
      </div>
    </div>
  )
}

function NutritionTarget({ label, value, unit, logged, color, wide }) {
  const pct = Math.min((logged / value) * 100, 100)

  return (
    <div className={wide ? 'w-36' : 'w-28'}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A8A29E] mb-1">
        {label}
      </p>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-xl font-bold text-[#1C1917]">
          {value.toLocaleString()}
        </span>
        <span className="text-xs text-[#78716C] font-medium">{unit}</span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-[#F5F5F4] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: pct > 0 ? `${pct}%` : '0%',
            backgroundColor: color,
          }}
        />
      </div>
      <p className="text-[10px] text-[#A8A29E] mt-1">
        {pct === 0 ? 'Not logged yet' : `${logged} / ${value} ${unit}`}
      </p>
    </div>
  )
}
