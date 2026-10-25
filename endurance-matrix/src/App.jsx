import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { DEFAULT_PLAN_FILES, PLAN_FILES } from './data/planCatalog'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const PLAN_COLORS = ['#f97360', '#68a6ff', '#5bc9a5', '#9b83e7', '#e4a952', '#d36b9b']
const PLAN_TINTS = ['#fff0eb', '#edf5ff', '#eafaf4']

const CALENDAR_STYLES = [
  { id: 'calendar-1', shortLabel: 'Grid compare', title: 'A familiar monthly grid', description: 'See every workout label in place, with each plan stacked into the same day.' },
  { id: 'calendar-2', shortLabel: 'Training bands', title: 'A plan-by-plan view', description: 'Keep each plan in its own lane so the rhythm of each week is easier to scan.' },
  { id: 'calendar-3', shortLabel: 'Signal matrix', title: 'An intensity snapshot', description: 'Compare training load as a visual signal before drilling into a selected day.' },
]

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  const paths = {
    arrowLeft: <><path d="m11 17-5-5 5-5" /><path d="M6 12h12" /></>,
    arrowRight: <><path d="m13 17 5-5-5-5" /><path d="M18 12H6" /></>,
    calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 9.5h18" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 3-4 3 2 5-7" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    layers: <><path d="m12 3 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4M4 17l8 4 8-4" /></>,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chartUp: <><path d="M4 19V5M4 19h17" /><path d="M7 15h3v-3h3V9h3V6h3" /></>,
  }
  return <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg"><g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}>{paths[name]}</g></svg>
}

function SiteNav({ current }) {
  return <header className="border-b border-slate-200/80 bg-[#f8fafc]/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
      <a className="group flex items-center gap-3" href="/">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10263b] text-[#e8f2ed] shadow-[0_6px_18px_rgba(16,38,59,0.18)]"><Icon name="chartUp" size={20} /></span>
        <span><span className="block text-[15px] font-semibold tracking-[-0.02em] text-[#10263b]">Endurance Matrix</span><span className="hidden text-[11px] font-medium uppercase tracking-[0.15em] text-slate-400 sm:block">Training plan comparison</span></span>
      </a>
      <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
        <a className={'nav-link ' + (current === 'home' ? 'nav-link-active' : '')} href="/">Overview</a>
        <a className={'nav-link ' + (current === 'compare' ? 'nav-link-active' : '')} href="/compare">Compare plans</a>
        <a className={'nav-link ' + (current === 'calendar-1' ? 'nav-link-active' : '')} href="/calendar-1">Grid compare</a>
        <a className={'nav-link ' + (current === 'calendar-2' ? 'nav-link-active' : '')} href="/calendar-2">Training bands</a>
        <a className={'nav-link ' + (current === 'calendar-3' ? 'nav-link-active' : '')} href="/calendar-3">Signal matrix</a>
      </nav>
      <a className="hidden items-center gap-2 rounded-full bg-[#10263b] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1c3e5b] sm:flex" href="/compare">Compare plans <Icon name="arrowRight" size={15} /></a>
      <a aria-label="Compare plans" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-[#10263b] sm:hidden" href="/compare"><Icon name="arrowRight" size={17} /></a>
    </div>
  </header>
}

function HomePage() {
  return <div className="min-h-screen bg-[#f8fafc] text-[#10263b]">
    <SiteNav current="home" />
    <main>
      <section className="relative isolate overflow-hidden border-b border-slate-200/70">
        <div className="absolute -right-36 -top-32 -z-10 h-[480px] w-[480px] rounded-full bg-[#d9f0e7] blur-3xl" />
        <div className="absolute -left-20 bottom-[-220px] -z-10 h-[420px] w-[420px] rounded-full bg-[#ffe4dc] blur-3xl" />
        <div className="mx-auto grid max-w-[1440px] gap-12 px-4 pb-16 pt-16 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:px-8 lg:pb-24 lg:pt-24">
          <div className="max-w-2xl self-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#cfe5dc] bg-white/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#3b806b]"><span className="h-1.5 w-1.5 rounded-full bg-[#5bc9a5]" />A clearer way to compare training</div>
            <h1 className="max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.065em] text-[#10263b] sm:text-6xl lg:text-7xl">Find the rhythm that fits your next finish line.</h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-slate-500 sm:text-lg">Endurance Matrix puts training plans on the same calendar so you can spot the differences in volume, intensity, and recovery at a glance.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3"><a className="inline-flex items-center gap-2 rounded-full bg-[#10263b] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(16,38,59,0.18)] transition hover:-translate-y-0.5 hover:bg-[#1c3e5b]" href="/compare">Start comparing <Icon name="arrowRight" size={17} /></a><span className="text-sm text-slate-400">Read-only · {PLAN_FILES.length} plans in the library</span></div>
          </div>
          <div className="relative mx-auto w-full max-w-[500px] lg:mt-4">
            <div className="absolute -left-5 top-10 hidden h-16 w-16 rounded-2xl border border-white/80 bg-white/75 shadow-[0_14px_30px_rgba(16,38,59,0.08)] sm:block" />
            <div className="relative rounded-[28px] border border-white bg-white/85 p-4 shadow-[0_24px_70px_rgba(16,38,59,0.12)] backdrop-blur">
              <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Preview</p><p className="mt-1 text-sm font-semibold text-[#10263b]">Monthly comparison</p></div><span className="rounded-full bg-[#edf5ff] px-2.5 py-1 text-[10px] font-bold text-[#5686c7]">3 plans</span></div>
              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-400">{WEEKDAYS.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}</div>
              <div className="mt-2 grid grid-cols-7 gap-1.5">{Array.from({ length: 35 }, (_, index) => { const day = index - 1; const isCurrent = day === 11; const hasWorkout = [2, 4, 7, 9, 11, 15, 18, 21, 23, 28, 30].includes(day); return <div className={'flex h-[54px] flex-col items-start rounded-lg border p-1.5 ' + (isCurrent ? 'border-[#f97360] bg-[#fff6f2]' : 'border-slate-100 bg-slate-50/60')} key={index}>{day > 0 && day <= 30 && <span className={'text-[10px] font-semibold ' + (isCurrent ? 'text-[#f97360]' : 'text-slate-400')}>{day}</span>}{hasWorkout && <div className="mt-auto flex w-full gap-0.5"><span className="h-1.5 flex-1 rounded-full bg-[#f97360]" /><span className="h-1.5 flex-1 rounded-full bg-[#68a6ff]" /><span className="h-1.5 flex-1 rounded-full bg-[#5bc9a5]" /></div>}</div> })}</div>
              <div className="mt-4 flex items-center gap-4 border-t border-slate-100 px-2 pt-4 text-[10px] font-medium text-slate-400"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#f97360]" />Plan A</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#68a6ff]" />Plan B</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#5bc9a5]" />Plan C</span></div>
            </div>
            <div className="absolute -bottom-7 -right-4 rounded-2xl border border-white/80 bg-[#10263b] px-4 py-3 text-white shadow-[0_16px_34px_rgba(16,38,59,0.2)] sm:-right-9"><p className="text-[10px] uppercase tracking-[0.15em] text-slate-400">This week</p><p className="mt-1 text-xl font-semibold tracking-tight">18.4 km</p><p className="text-[10px] text-[#9fdcc7]">across 3 plans</p></div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1440px] px-4 pb-5 pt-12 sm:px-6 lg:px-8 lg:pb-8 lg:pt-16">
        <a className="group flex flex-col justify-between gap-5 rounded-[24px] border border-[#cfe5dc] bg-[#edf5f1] p-6 transition hover:border-[#9fdcc7] hover:shadow-[0_14px_34px_rgba(59,128,107,0.08)] sm:flex-row sm:items-center sm:p-7" href="/compare">
          <div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#3b806b]"><Icon name="layers" size={21} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#3b806b]">New view · same goal</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.035em] text-[#10263b] sm:text-2xl">Compare the shape of similar plans.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Line up weekly miles, long runs, workout counts, and more before you commit to a path.</p></div></div>
          <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[#3b806b] transition group-hover:gap-3">Compare plans <Icon name="arrowRight" size={17} /></span>
        </a>
      </section>
      <section className="mx-auto max-w-[1440px] px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-24">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b806b]">Choose a lens</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-[#10263b] sm:text-4xl">Three ways to see the same work.</h2></div><p className="max-w-sm text-sm leading-6 text-slate-500">Each calendar is intentionally separate, so the best direction can evolve without losing the others.</p></div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">{CALENDAR_STYLES.map((style, index) => <CalendarStyleCard index={index} key={style.id} style={style} />)}</div>
      </section>
    </main>
  </div>
}

function PlanComparisonPage() {
  const { plans, loading, error } = usePlans(PLAN_FILES)
  const [goal, setGoal] = useState('5K')
  const [selectedIds, setSelectedIds] = useState([])
  const [metric, setMetric] = useState('weeklyMiles')
  const [alignment, setAlignment] = useState('start')
  const groups = useMemo(() => groupPlansByGoal(plans), [plans])
  const goalOptions = useMemo(() => Object.keys(groups).sort(compareGoals), [groups])
  const availablePlans = useMemo(() => groups[goal] ?? [], [goal, groups])
  const defaultIds = useMemo(() => availablePlans.slice(0, 3).map((plan) => plan.id), [availablePlans])
  const selectedPlanIds = useMemo(() => {
    const validIds = selectedIds.filter((id) => availablePlans.some((plan) => plan.id === id))
    if (validIds.length >= 1) return validIds
    return defaultIds
  }, [availablePlans, defaultIds, selectedIds])
  const selectedPlans = availablePlans.filter((plan) => selectedPlanIds.includes(plan.id))
  const planMetrics = useMemo(() => selectedPlans.map((plan) => ({ plan, metrics: getPlanMetrics(plan) })), [selectedPlans])
  const overview = useMemo(() => getComparisonOverview(planMetrics), [planMetrics])

  const togglePlan = (planId) => setSelectedIds((current) => {
    const base = current.length ? current : defaultIds
    if (base.includes(planId)) {
      return base.length > 1 ? base.filter((id) => id !== planId) : base
    }
    return base.length < 6 ? [...base, planId] : base
  })

  return <div className="min-h-screen bg-[#f8fafc] text-[#10263b]">
    <SiteNav current="compare" />
    <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400"><a className="transition hover:text-[#10263b]" href="/">Overview</a><span>/</span><span>Compare plans</span></div>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-[#10263b] sm:text-5xl lg:text-6xl">Compare plans with the same finish line.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">Choose a goal, select the plans you want to study, and compare how their workload builds week by week.</p>
          </div>
          <div className="rounded-[20px] border border-[#cfe5dc] bg-[#edf5f1] px-5 py-4 lg:min-w-[220px]"><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#3b806b]">Comparison mode</p><p className="mt-2 text-sm font-semibold text-[#10263b]">Read-only analysis</p><p className="mt-1 text-xs text-slate-500">Up to 6 plans at a time</p></div>
        </div>

        {loading && <div className="rounded-[22px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading the plan library…</div>}
        {error && <div className="rounded-[22px] border border-[#f2c8bd] bg-[#fff6f2] p-5 text-sm text-[#9b5144]">{error}</div>}
        {!loading && !error && <><section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(16,38,59,0.04)] sm:p-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#3b806b]">1 · Pick a goal</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#10263b]">Compare similar goals</h2></div><label className="relative min-w-[220px]"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Goal event</span><select aria-label="Choose a goal" className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-[#fbfcfd] px-3.5 py-3 pr-9 text-sm font-semibold text-[#10263b] outline-none" onChange={(event) => { setGoal(event.target.value); setSelectedIds([]) }} value={goal}>{goalOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select><span className="pointer-events-none absolute bottom-3.5 right-3.5 text-slate-400"><Icon name="chevronDown" size={15} /></span></label></div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{availablePlans.map((plan) => { const selected = selectedPlanIds.includes(plan.id); const planIndex = selectedPlans.findIndex((item) => item.id === plan.id); return <button aria-pressed={selected} className={'relative rounded-2xl border p-4 text-left transition ' + (selected ? 'border-[#9fdcc7] bg-[#f3faf7] shadow-[0_8px_20px_rgba(59,128,107,0.07)]' : 'border-slate-200 bg-white hover:border-slate-300')} key={plan.id} onClick={() => togglePlan(plan.id)} type="button"><span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] " style={selected ? { backgroundColor: PLAN_COLORS[planIndex], borderColor: PLAN_COLORS[planIndex], color: '#fff' } : { borderColor: '#cbd5e1', color: '#94a3b8' }}>{selected && <Icon name="check" size={12} strokeWidth={2.5} />}</span><span className="block pr-7 text-sm font-semibold leading-5 text-[#10263b]">{plan.name}</span><span className="mt-2 block text-[11px] text-slate-400">{plan.author ?? 'Training plan'} · {plan.meta?.total_weeks ?? '—'} weeks</span><span className="mt-3 inline-flex rounded-full bg-white px-2 py-1 text-[10px] font-bold capitalize text-slate-500 shadow-sm">{plan.meta?.difficulty ?? 'mixed'}</span></button> })}</div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-400"><span>{selectedPlans.length} of {availablePlans.length} plans selected</span><span>Click a plan to add or remove it · Keep at least one selected</span></div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ComparisonStat label="Plans compared" value={selectedPlans.length} detail={goal + ' goal'} />
          <ComparisonStat label="Peak weekly miles" value={overview.peakMiles ? formatNumber(overview.peakMiles) + ' mi' : '—'} detail={overview.peakPlan ? overview.peakPlan.name : 'No schedule data'} />
          <ComparisonStat label="Longest scheduled run" value={overview.longestRun ? formatNumber(overview.longestRun) + ' mi' : '—'} detail={overview.longestPlan ? overview.longestPlan.name : 'No schedule data'} />
          <ComparisonStat label="Plan length" value={overview.lengthRange} detail="weeks in the selected plans" />
        </div>

        <ProgressionChart alignment={alignment} metric={metric} onAlignmentChange={setAlignment} onMetricChange={setMetric} planMetrics={planMetrics} />
        <ComparisonTable planMetrics={planMetrics} />
        <section className="rounded-[22px] border border-[#d8e5ee] bg-[#f3f8fb] p-5 text-sm leading-6 text-slate-500 sm:p-6"><span className="font-semibold text-[#30485b]">How to read this:</span> weekly miles show scheduled distance from each plan, long runs use the longest distance-based workout in that week, and workout count excludes rest days. Values are converted from the source data’s kilometers to miles.</section>
        </>}
      </div>
    </main>
  </div>
}

function ComparisonStat({ label, value, detail }) {
  return <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(16,38,59,0.03)]"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{label}</p><p className="mt-3 text-2xl font-semibold tracking-[-0.045em] text-[#10263b]">{value}</p><p className="mt-1 truncate text-[11px] text-slate-400">{detail}</p></div>
}

function ProgressionChart({ alignment, metric, onAlignmentChange, onMetricChange, planMetrics }) {
  const metricOptions = [
    { id: 'weeklyMiles', label: 'Weekly miles', unit: 'mi', getValue: (week) => week.miles },
    { id: 'longRun', label: 'Longest run', unit: 'mi', getValue: (week) => week.longRunMiles },
    { id: 'workouts', label: 'Workout count', unit: 'sessions', getValue: (week) => week.workouts },
  ]
  const selectedMetric = metricOptions.find((option) => option.id === metric) ?? metricOptions[0]
  const weekCount = Math.max(...planMetrics.map(({ metrics }) => metrics.weeks.length), 1)
  const maxValue = Math.max(...planMetrics.flatMap(({ metrics }) => metrics.weeks.map(selectedMetric.getValue)), 1)
  const getWeekForSlot = (metrics, slotIndex) => {
    const offset = alignment === 'finish' ? weekCount - metrics.weeks.length : 0
    return metrics.weeks[slotIndex - offset]
  }
  const getSlotLabel = (slotIndex) => {
    if (alignment === 'finish') {
      const weeksToFinish = weekCount - slotIndex - 1
      return weeksToFinish === 0 ? 'Finish' : '−' + weeksToFinish
    }
    return 'W' + (slotIndex + 1)
  }

  return <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(16,38,59,0.04)] sm:p-6">
    <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#3b806b]">2 · Compare the build</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#10263b]">Weekly progression</h2><p className="mt-2 text-xs text-slate-400">{alignment === 'finish' ? 'Final weeks are aligned to the same finish line.' : 'Week 1 is aligned so you can compare how each plan begins.'}</p></div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 rounded-xl bg-[#f3f8fb] p-1"><span className="px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Align by</span><button aria-pressed={alignment === 'start'} className={'rounded-lg px-3 py-2 text-[11px] font-bold transition ' + (alignment === 'start' ? 'bg-white text-[#10263b] shadow-sm' : 'text-slate-400 hover:text-[#10263b]')} onClick={() => onAlignmentChange('start')} type="button">Start</button><button aria-pressed={alignment === 'finish'} className={'rounded-lg px-3 py-2 text-[11px] font-bold transition ' + (alignment === 'finish' ? 'bg-[#10263b] text-white shadow-sm' : 'text-slate-400 hover:text-[#10263b]')} onClick={() => onAlignmentChange('finish')} type="button">Finish</button></div>
        <div className="flex flex-wrap rounded-xl bg-slate-100 p-1">{metricOptions.map((option) => <button className={'rounded-lg px-3 py-2 text-[11px] font-bold transition ' + (option.id === metric ? 'bg-white text-[#10263b] shadow-sm' : 'text-slate-400 hover:text-[#10263b]')} key={option.id} onClick={() => onMetricChange(option.id)} type="button">{option.label}</button>)}</div>
      </div>
    </div>
    <div className="calendar-scroll mt-8 overflow-x-auto pb-2"><div className="min-w-[760px]"><div className="flex h-64 items-end gap-3 border-b border-l border-slate-200 px-3">{Array.from({ length: weekCount }, (_, weekIndex) => <div className="flex h-full min-w-[65px] flex-1 flex-col items-center justify-end gap-2" key={weekIndex}><div className="flex h-52 w-full items-end justify-center gap-1.5">{planMetrics.map(({ plan, metrics }, planIndex) => { const week = getWeekForSlot(metrics, weekIndex); const value = week ? selectedMetric.getValue(week) : 0; const weekLabel = week ? 'W' + week.week : 'Outside plan'; return <div className="group relative flex h-full max-w-[28px] flex-1 items-end" key={plan.id}><div className="w-full rounded-t-lg transition-all group-hover:opacity-80" style={{ backgroundColor: PLAN_COLORS[planIndex], height: value ? Math.max((value / maxValue) * 100, 5) + '%' : '2px' }} title={plan.name + ' · ' + weekLabel + ': ' + formatNumber(value) + ' ' + selectedMetric.unit} /></div> })}</div><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{getSlotLabel(weekIndex)}</span></div>)}</div><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">{planMetrics.map(({ plan }, planIndex) => <span className="flex max-w-[260px] items-center gap-2 truncate text-[11px] font-semibold text-slate-500" key={plan.id}><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PLAN_COLORS[planIndex] }} /><span className="truncate">{plan.name}</span></span>)}</div></div></div>
  </section>
}

function ComparisonTable({ planMetrics }) {
  const rows = [
    { label: 'Plan length', getValue: ({ metrics }) => metrics.weeks.length + ' weeks' },
    { label: 'Scheduled miles', getValue: ({ metrics }) => formatNumber(metrics.totalMiles) + ' mi' },
    { label: 'Peak week', getValue: ({ metrics }) => metrics.peakMiles ? 'W' + metrics.peakWeek + ' · ' + formatNumber(metrics.peakMiles) + ' mi' : '—' },
    { label: 'Longest run', getValue: ({ metrics }) => metrics.longestRun ? formatNumber(metrics.longestRun) + ' mi' : '—' },
    { label: 'Avg. workouts / week', getValue: ({ metrics }) => metrics.averageWorkouts ? formatNumber(metrics.averageWorkouts) : '—' },
    { label: 'Activities', getValue: ({ plan }) => (plan.activity_types ?? []).join(', ') || '—' },
    { label: 'Training phases', getValue: ({ metrics }) => metrics.phases.join(', ') || '—' },
  ]
  return <section className="rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(16,38,59,0.04)]"><div className="border-b border-slate-100 px-5 py-5 sm:px-6"><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#3b806b]">3 · At a glance</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#10263b]">Where the plans differ</h2></div><div className="calendar-scroll overflow-x-auto"><table className="min-w-[760px] w-full border-collapse text-left"><thead><tr className="border-b border-slate-100 bg-[#fbfcfd]"><th className="w-[180px] px-5 py-4 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 sm:px-6">Metric</th>{planMetrics.map(({ plan }, index) => <th className="min-w-[175px] px-5 py-4 sm:px-6" key={plan.id}><span className="flex items-start gap-2 text-sm font-semibold leading-5 text-[#10263b]"><i className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PLAN_COLORS[index] }} />{plan.name}</span><span className="mt-1 block pl-4 text-[10px] font-medium text-slate-400">{plan.author ?? 'Training plan'}</span></th>)}</tr></thead><tbody>{rows.map((row) => <tr className="border-b border-slate-100 last:border-0" key={row.label}><th className="px-5 py-4 text-xs font-semibold text-slate-500 sm:px-6">{row.label}</th>{planMetrics.map((item) => <td className="px-5 py-4 text-sm font-semibold text-[#30485b] sm:px-6" key={item.plan.id}>{row.getValue(item)}</td>)}</tr>)}</tbody></table></div></section>
}

function getComparableGoal(plan) {
  const source = (plan.sourceFile ?? '').toLowerCase()
  if (source.startsWith('5k_')) return '5K'
  if (source.startsWith('10k_')) return '10K'
  if (source.startsWith('15k_10_mile_')) return '10 Mile'
  if (source.includes('8k_training_novice_15k')) return '15K'
  if (source.includes('8k_training_intermediate_half_marathon') || source.includes('half_marathon') || source.includes('base_training_') && source.includes('half_marathon')) return 'Half Marathon'
  if (source.includes('8k_training_advanced_marathon') || source.includes('marathon_training_')) return 'Marathon'
  if (source.includes('ultramarathon')) return 'Ultramarathon'
  if (source.includes('triathlon')) return 'Triathlon'
  if (source.includes('cross_country')) return 'Cross Country'
  if (source.includes('post_marathon_recovery')) return 'Recovery'
  if (source.includes('base_training_spring') || source.includes('more_training_winter')) return 'General Training'
  return plan.meta?.goal_event ?? 'Other goals'
}

function groupPlansByGoal(plans) {
  return plans.reduce((groups, plan) => {
    const goal = getComparableGoal(plan)
    if (!groups[goal]) groups[goal] = []
    groups[goal].push(plan)
    return groups
  }, {})
}

function compareGoals(first, second) {
  const order = ['5K', '10K', '15K', '10 Mile', 'Half Marathon', 'Marathon', 'Ultramarathon', 'Triathlon', 'Cross Country', 'Recovery', 'General Training']
  const firstIndex = order.indexOf(first)
  const secondIndex = order.indexOf(second)
  if (firstIndex === -1 && secondIndex === -1) return first.localeCompare(second)
  if (firstIndex === -1) return 1
  if (secondIndex === -1) return -1
  return firstIndex - secondIndex
}

function getWorkoutDistanceKm(workout) {
  const distanceKm = Number(workout.distance_km)
  if (Number.isFinite(distanceKm) && distanceKm > 0) return distanceKm >= 100 ? distanceKm / 1000 : distanceKm
  const distanceMiles = Number(workout.distance_miles)
  return Number.isFinite(distanceMiles) && distanceMiles > 0 ? distanceMiles / 0.621371 : 0
}

function getPlanMetrics(plan) {
  const weeks = (plan.schedule ?? []).map((week, index) => {
    const dayStats = (week.days ?? []).map((day) => {
      const workouts = (day.workouts ?? []).filter((workout) => workout.workout_ref !== 'rest')
      const distances = workouts.map(getWorkoutDistanceKm).filter(Boolean)
      const labels = workouts.map((workout) => plan.workout_definitions?.[workout.workout_ref]?.label ?? titleCase(workout.workout_ref)).join(' ').toLowerCase()
      const longDistances = workouts.filter((workout) => labels.includes('long') || getWorkoutDistanceKm(workout) >= 10).map(getWorkoutDistanceKm).filter(Boolean)
      return { distanceKm: distances.reduce((total, value) => total + value, 0), longRunKm: Math.max(...(longDistances.length ? longDistances : distances), 0), workoutCount: workouts.length }
    })
    const scheduledDistanceKm = dayStats.reduce((total, day) => total + day.distanceKm, 0)
    return { week: week.week ?? index + 1, phase: week.phase, miles: scheduledDistanceKm * 0.621371, longRunMiles: Math.max(...dayStats.map((day) => day.longRunKm), 0) * 0.621371, workouts: dayStats.reduce((total, day) => total + day.workoutCount, 0) }
  })
  const peak = weeks.reduce((current, week) => week.miles > current.miles ? week : current, { miles: 0, week: 0 })
  const longestRun = Math.max(...weeks.map((week) => week.longRunMiles), 0)
  return { weeks, totalMiles: weeks.reduce((total, week) => total + week.miles, 0), peakMiles: peak.miles, peakWeek: peak.week, longestRun, averageWorkouts: weeks.length ? weeks.reduce((total, week) => total + week.workouts, 0) / weeks.length : 0, phases: [...new Set(weeks.map((week) => week.phase).filter(Boolean))] }
}

function getComparisonOverview(planMetrics) {
  const peakItem = planMetrics.reduce((current, item) => item.metrics.peakMiles > current.metrics.peakMiles ? item : current, { metrics: { peakMiles: 0 }, plan: null })
  const longestItem = planMetrics.reduce((current, item) => item.metrics.longestRun > current.metrics.longestRun ? item : current, { metrics: { longestRun: 0 }, plan: null })
  const lengths = planMetrics.map(({ metrics }) => metrics.weeks.length).filter(Boolean)
  const minLength = Math.min(...lengths)
  const maxLength = Math.max(...lengths)
  return { peakMiles: peakItem.metrics.peakMiles, peakPlan: peakItem.plan, longestRun: longestItem.metrics.longestRun, longestPlan: longestItem.plan, lengthRange: lengths.length ? minLength === maxLength ? minLength + ' weeks' : minLength + '–' + maxLength + ' weeks' : '—' }
}

function CalendarStyleCard({ style, index }) {
  const descriptions = ['Classic monthly grid with each plan visible in the same day cell.', 'Weekly lanes make cadence, rest days, and long-run patterns easy to compare.', 'Compact workload signals highlight where plans diverge before you inspect details.']
  const icons = ['grid', 'layers', 'chartUp']
  return <a className="group rounded-[24px] border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-[#b9d8cd] hover:shadow-[0_18px_42px_rgba(16,38,59,0.08)]" href={'/' + style.id}>
    <div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: PLAN_TINTS[index], color: PLAN_COLORS[index] }}><Icon name={icons[index]} size={21} /></span><span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition group-hover:border-[#10263b] group-hover:bg-[#10263b] group-hover:text-white"><Icon name="arrowRight" size={15} /></span></div>
    <p className="mt-8 text-[10px] font-bold uppercase tracking-[0.17em] text-slate-400">Option 0{index + 1}</p><h3 className="mt-2 text-xl font-semibold tracking-[-0.035em] text-[#10263b]">{style.shortLabel}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{descriptions[index]}</p>
    <div className="mt-6 flex items-center gap-1.5">{PLAN_COLORS.map((color) => <span className="h-1.5 flex-1 rounded-full" key={color} style={{ backgroundColor: color }} />)}</div>
  </a>
}

function CalendarPage({ variant }) {
  const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1) })
  const [startDate] = useState(() => startOfWeek(new Date()))
  const [selectedFiles, setSelectedFiles] = useState(DEFAULT_PLAN_FILES)
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const { plans, loading, error } = usePlans(selectedFiles)
  const style = CALENDAR_STYLES.find((item) => item.id === variant) ?? CALENDAR_STYLES[0]
  const calendarDays = useMemo(() => getMonthDays(month), [month])
  const changeMonth = (offset) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  const updatePlan = (index, file) => setSelectedFiles((current) => current.map((item, itemIndex) => itemIndex === index ? file : item))

  return <div className="min-h-screen bg-[#f8fafc] text-[#10263b]">
    <SiteNav current={variant} />
    <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400"><a className="transition hover:text-[#10263b]" href="/">Overview</a><span>/</span><span>{style.shortLabel}</span></div><h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-[#10263b] sm:text-5xl">{style.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">{style.description} The calendar starts each plan on <span className="font-semibold text-[#10263b]">{formatDate(startDate, { month: 'short', day: 'numeric' })}</span>.</p></div><div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-slate-200 bg-white p-1 shadow-sm lg:self-end">{CALENDAR_STYLES.map((item, index) => <a aria-label={'Open ' + item.shortLabel} className={'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ' + (item.id === variant ? 'bg-[#10263b] text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-[#10263b]')} href={'/' + item.id} key={item.id}>{index + 1}</a>)}</div></div>
        <div className="grid gap-3 lg:grid-cols-3">{selectedFiles.map((file, index) => <PlanSelector file={file} index={index} key={index + '-' + file} onChange={(nextFile) => updatePlan(index, nextFile)} plan={plans[index]} />)}</div>
        <div className="flex flex-col justify-between gap-4 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(16,38,59,0.04)] sm:flex-row sm:items-center sm:px-5"><div className="flex items-center gap-3"><button aria-label="Previous month" className="icon-button" onClick={() => changeMonth(-1)} type="button"><Icon name="arrowLeft" size={17} /></button><h2 className="min-w-[170px] text-center text-lg font-semibold tracking-[-0.03em] text-[#10263b]">{formatDate(month, { month: 'long', year: 'numeric' })}</h2><button aria-label="Next month" className="icon-button" onClick={() => changeMonth(1)} type="button"><Icon name="arrowRight" size={17} /></button><button className="ml-1 hidden rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-[#10263b] hover:text-[#10263b] sm:block" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(now) }} type="button">Today</button></div><div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-400"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#f97360]" />Plan A</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#68a6ff]" />Plan B</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#5bc9a5]" />Plan C</span><span className="hidden text-slate-300 sm:inline">Scroll to compare →</span></div></div>
        {loading && <div className="rounded-[22px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading plan schedules…</div>}
        {error && <div className="rounded-[22px] border border-[#f2c8bd] bg-[#fff6f2] p-5 text-sm text-[#9b5144]">{error}</div>}
        {!loading && !error && variant === 'calendar-1' && <ClassicGridView calendarDays={calendarDays} month={month} plans={plans} startDate={startDate} onSelectDate={setSelectedDate} />}
        {!loading && !error && variant === 'calendar-2' && <TrainingBandsView calendarDays={calendarDays} month={month} plans={plans} startDate={startDate} onSelectDate={setSelectedDate} />}
        {!loading && !error && variant === 'calendar-3' && <SignalMatrixView calendarDays={calendarDays} month={month} plans={plans} selectedDate={selectedDate} startDate={startDate} onSelectDate={setSelectedDate} />}
        {variant !== 'calendar-3' && !loading && !error && <DaySummary date={selectedDate} plans={plans} startDate={startDate} />}
      </div>
    </main>
  </div>
}

function PlanSelector({ file, index, onChange, plan }) {
  return <label className="group relative flex min-w-0 items-center gap-3 rounded-[18px] border border-slate-200 bg-white p-3.5 shadow-[0_8px_24px_rgba(16,38,59,0.03)] transition hover:border-slate-300"><span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: PLAN_COLORS[index] }} /><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Plan {String.fromCharCode(65 + index)}</span><select aria-label={'Choose plan ' + String.fromCharCode(65 + index)} className="mt-1 w-full cursor-pointer appearance-none truncate bg-transparent pr-5 text-sm font-semibold text-[#10263b] outline-none" onChange={(event) => onChange(event.target.value)} value={file}>{PLAN_FILES.map((option) => <option key={option} value={option}>{planTitleFromFile(option)}</option>)}</select><span className="mt-0.5 block truncate text-[11px] text-slate-400">{plan ? (plan.meta?.total_weeks ?? '—') + ' week plan · ' + (plan.meta?.difficulty ?? 'mixed') : 'Loading details…'}</span></span><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="chevronDown" size={15} /></span></label>
}

function ClassicGridView({ calendarDays, month, plans, startDate, onSelectDate }) {
  return <section aria-label={formatDate(month, { month: 'long', year: 'numeric' }) + ' calendar'} className="calendar-scroll overflow-x-auto rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(16,38,59,0.04)]"><div className="min-w-[930px]"><div className="grid grid-cols-7 border-b border-slate-200 bg-[#fbfcfd]">{WEEKDAYS.map((day) => <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400" key={day}>{day}</div>)}</div><div className="grid grid-cols-7">{calendarDays.map((date, index) => <ClassicDayCell date={date} index={index} key={date ? date.toISOString() : 'empty-' + index} onSelectDate={onSelectDate} plans={plans} startDate={startDate} />)}</div></div></section>
}

function ClassicDayCell({ date, index, onSelectDate, plans, startDate }) {
  if (!date) return <div className="min-h-[154px] border-b border-r border-slate-100 bg-[#fbfcfd]/70" />
  const isToday = isSameDay(date, new Date())
  const dayEntries = plans.map((plan) => getPlanDay(plan, date, startDate))
  const hasWorkout = dayEntries.some((entry) => entry?.day?.workouts?.some((workout) => workout.workout_ref !== 'rest'))
  return <button className={'group min-h-[154px] border-b border-r border-slate-100 p-3 text-left align-top transition hover:bg-[#fbfdfc] ' + (index % 7 === 6 ? 'border-r-0' : '')} onClick={() => onSelectDate(date)} type="button"><div className="flex items-center justify-between"><span className={'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ' + (isToday ? 'bg-[#f97360] text-white shadow-[0_4px_12px_rgba(249,115,96,0.28)]' : 'text-slate-500 group-hover:bg-slate-100')}>{date.getDate()}</span>{hasWorkout && <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#69a38d]">{getWeekLabel(dayEntries)}</span>}</div><div className="mt-3 space-y-1.5">{plans.map((plan, planIndex) => <WorkoutChip entry={dayEntries[planIndex]} color={PLAN_COLORS[planIndex]} key={plan.id + '-' + planIndex} />)}</div></button>
}

function WorkoutChip({ entry, color, compact = false }) {
  const summary = entry ? summarizeDay(entry) : null
  return <div className={'min-w-0 rounded-lg border border-slate-100 bg-slate-50/80 ' + (compact ? 'px-2 py-1.5' : 'px-2.5 py-2')}><div className="flex min-w-0 items-center gap-1.5"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} /><span className="truncate text-[10px] font-semibold text-[#30485b]">{summary?.label ?? 'Not scheduled'}</span></div>{summary && <span className="mt-1 block truncate pl-3 text-[9px] font-medium text-slate-400">{summary.metric || summary.phase || 'Recovery'}</span>}</div>
}

function TrainingBandsView({ calendarDays, month, plans, startDate, onSelectDate }) {
  const weeks = []
  for (let index = 0; index < calendarDays.length; index += 7) weeks.push(calendarDays.slice(index, index + 7))
  return <section aria-label={formatDate(month, { month: 'long', year: 'numeric' }) + ' training bands'} className="calendar-scroll overflow-x-auto rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(16,38,59,0.04)]"><div className="min-w-[1030px]"><div className="grid grid-cols-[112px_repeat(7,minmax(130px,1fr))] border-b border-slate-200 bg-[#fbfcfd]"><div className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Week</div>{WEEKDAYS.map((day) => <div className="border-l border-slate-100 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400" key={day}>{day}</div>)}</div>{weeks.map((week, weekIndex) => <div className="grid grid-cols-[112px_repeat(7,minmax(130px,1fr))]" key={'week-' + weekIndex}><WeekRail plans={plans} week={week} weekIndex={weekIndex} startDate={startDate} />{week.map((date, dayIndex) => <BandDayCell date={date} dayIndex={dayIndex} key={date ? date.toISOString() : 'empty-' + weekIndex + '-' + dayIndex} onSelectDate={onSelectDate} plans={plans} startDate={startDate} />)}</div>)}</div></section>
}

function WeekRail({ plans, week, weekIndex, startDate }) {
  const firstDate = week.find(Boolean)
  const firstEntry = firstDate && getPlanDay(plans[0], firstDate, startDate)
  return <div className="border-b border-r border-slate-100 bg-[#f8fafc] px-4 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Week {firstEntry?.week?.week ?? weekIndex + 1}</p><p className="mt-1 text-xs font-semibold leading-4 text-[#30485b]">{firstEntry?.week?.phase ?? '—'}</p><div className="mt-4 space-y-2">{plans.map((plan, index) => <span className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400" key={plan.id}><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PLAN_COLORS[index] }} />Plan {String.fromCharCode(65 + index)}</span>)}</div></div>
}

function BandDayCell({ date, onSelectDate, plans, startDate }) {
  if (!date) return <div className="min-h-[146px] border-b border-l border-slate-100 bg-[#fbfcfd]/70" />
  const isToday = isSameDay(date, new Date())
  return <button className="min-h-[146px] border-b border-l border-slate-100 p-3 text-left transition hover:bg-[#fbfdfc]" onClick={() => onSelectDate(date)} type="button"><div className="flex items-center justify-between"><span className={'text-xs font-semibold ' + (isToday ? 'text-[#f97360]' : 'text-slate-500')}>{formatDate(date, { month: 'short', day: 'numeric' })}</span>{isToday && <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#f97360]">Today</span>}</div><div className="mt-4 space-y-2.5">{plans.map((plan, index) => <WorkoutChip compact color={PLAN_COLORS[index]} entry={getPlanDay(plan, date, startDate)} key={plan.id + '-' + index} />)}</div></button>
}

function SignalMatrixView({ calendarDays, month, plans, selectedDate, startDate, onSelectDate }) {
  const [mode, setMode] = useState('intensity')
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"><section aria-label={formatDate(month, { month: 'long', year: 'numeric' }) + ' signal matrix'} className="calendar-scroll overflow-x-auto rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_30px_rgba(16,38,59,0.04)]"><div className="min-w-[880px]"><div className="flex items-center justify-between border-b border-slate-200 bg-[#fbfcfd] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Daily comparison signal</p><div className="flex rounded-full bg-slate-100 p-0.5"><button className={'rounded-full px-3 py-1 text-[10px] font-bold transition ' + (mode === 'intensity' ? 'bg-white text-[#10263b] shadow-sm' : 'text-slate-400')} onClick={() => setMode('intensity')} type="button">Intensity</button><button className={'rounded-full px-3 py-1 text-[10px] font-bold transition ' + (mode === 'volume' ? 'bg-white text-[#10263b] shadow-sm' : 'text-slate-400')} onClick={() => setMode('volume')} type="button">Volume</button></div></div><div className="grid grid-cols-7 border-b border-slate-200 bg-[#fbfcfd]">{WEEKDAYS.map((day) => <div className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400" key={day}>{day}</div>)}</div><div className="grid grid-cols-7">{calendarDays.map((date, index) => <SignalDayCell date={date} index={index} key={date ? date.toISOString() : 'empty-' + index} mode={mode} onSelectDate={onSelectDate} plans={plans} selectedDate={selectedDate} startDate={startDate} />)}</div><div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400"><span>Signal is relative to each workout type.</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#dceee7]" />light <i className="ml-2 h-2 w-2 rounded-full bg-[#3b806b]" />high load</span></div></div></section><DaySummary date={selectedDate} matrix plans={plans} startDate={startDate} /></div>
}

function SignalDayCell({ date, index, mode, onSelectDate, plans, selectedDate, startDate }) {
  if (!date) return <div className="min-h-[112px] border-b border-r border-slate-100 bg-[#fbfcfd]/70" />
  const selected = isSameDay(date, selectedDate)
  const isToday = isSameDay(date, new Date())
  return <button className={'min-h-[112px] border-b border-r border-slate-100 p-3 text-left transition hover:bg-[#fbfdfc] ' + (selected ? 'bg-[#f0f8f4] ring-2 ring-inset ring-[#9fdcc7]' : '') + (index % 7 === 6 ? 'border-r-0' : '')} onClick={() => onSelectDate(date)} type="button"><div className="flex items-center justify-between"><span className={'text-xs font-semibold ' + (isToday ? 'text-[#f97360]' : 'text-slate-500')}>{date.getDate()}</span>{isToday && <span className="h-1.5 w-1.5 rounded-full bg-[#f97360]" />}</div><div className="mt-4 space-y-2">{plans.map((plan, planIndex) => { const entry = getPlanDay(plan, date, startDate); const value = getSignalValue(entry, mode); return <div className="flex items-center gap-2" key={plan.id + '-' + planIndex}><span className="w-3 text-[9px] font-bold text-slate-400">{String.fromCharCode(65 + planIndex)}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full transition-all" style={{ backgroundColor: value ? PLAN_COLORS[planIndex] : '#e2e8f0', opacity: value ? 0.35 + value * 0.65 : 1, width: Math.max(value * 100, value ? 8 : 3) + '%' }} /></span></div> })}</div></button>
}

function DaySummary({ date, plans, startDate, matrix = false }) {
  const isFuture = date && dateAtNoon(date) >= dateAtNoon(startDate)
  return <aside className={'rounded-[22px] border border-slate-200 bg-[#10263b] p-5 text-white shadow-[0_12px_34px_rgba(16,38,59,0.12)] ' + (matrix ? 'h-fit lg:sticky lg:top-5' : '')}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#9fdcc7]">Day comparison</p><h3 className="mt-2 text-xl font-semibold tracking-[-0.035em]">{date ? formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' }) : 'Select a day'}</h3></div><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-300">{isFuture ? 'In schedule' : 'Before start'}</span></div><div className="mt-6 space-y-3">{plans.map((plan, index) => { const entry = date && getPlanDay(plan, date, startDate); const summary = entry && summarizeDay(entry); return <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3" key={plan.id + '-' + index}><div className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2 text-xs font-semibold"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PLAN_COLORS[index] }} /><span className="truncate">Plan {String.fromCharCode(65 + index)}</span></span><span className="text-[10px] text-slate-400">{entry?.week ? 'W' + entry.week.week : '—'}</span></div><p className="mt-2 text-sm font-semibold text-white">{summary?.label ?? 'No workout'}</p><p className="mt-1 text-[11px] leading-4 text-slate-400">{summary?.detail ?? (isFuture ? 'This plan has no session scheduled here.' : 'The plan starts later in the calendar.')}</p></div> })}</div></aside>
}

function usePlans(selectedFiles) {
  const requestKey = selectedFiles.join('|')
  const [state, setState] = useState({ requestKey: '', plans: [], loading: true, error: '' })

  useEffect(() => {
    let cancelled = false
    Promise.all(selectedFiles.map(async (file) => { const response = await fetch('/data/plans/' + file); if (!response.ok) throw new Error('Could not load ' + file); const payload = await response.json(); return { ...(payload.plan ?? payload), sourceFile: file } }))
      .then((nextPlans) => { if (!cancelled) setState({ requestKey, plans: nextPlans, loading: false, error: '' }) })
      .catch((loadError) => { if (!cancelled) setState({ requestKey, plans: [], loading: false, error: loadError.message + '. Check that the plan data is available in public/data/plans.' }) })
    return () => { cancelled = true }
  }, [requestKey, selectedFiles])

  if (state.requestKey !== requestKey) return { plans: [], loading: true, error: '' }
  return state
}

function getMonthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: offset }, () => null)
  for (let day = 1; day <= totalDays; day += 1) cells.push(new Date(month.getFullYear(), month.getMonth(), day))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function getPlanDay(plan, date, startDate) {
  if (!plan || !date) return null
  const dayOffset = Math.floor((dateAtNoon(date) - dateAtNoon(startDate)) / 86400000)
  if (dayOffset < 0) return null
  const weekIndex = Math.floor(dayOffset / 7)
  const scheduleWeek = plan.schedule?.[weekIndex]
  if (!scheduleWeek) return null
  const day = scheduleWeek.days?.find((item) => item.day_of_week === WEEKDAY_KEYS[dayOffset % 7])
  return day ? { day, week: scheduleWeek, definitions: plan.workout_definitions ?? {} } : null
}

function summarizeDay(entry) {
  const workouts = entry.day.workouts ?? []
  const definitions = entry.definitions ?? {}
  const labels = workouts.map((workout) => definitions[workout.workout_ref]?.label ?? titleCase(workout.workout_ref)).filter(Boolean)
  const first = workouts[0]
  const distance = workouts.reduce((total, workout) => total + getWorkoutDistanceKm(workout), 0)
  const duration = workouts.reduce((total, workout) => total + (Number(workout.duration_min) || 0), 0)
  const isRest = labels.length > 0 && labels.every((label) => label.toLowerCase() === 'rest')
  const metric = distance ? formatNumber(distance) + ' km' : duration ? formatNumber(duration) + ' min' : ''
  const detail = [metric, first?.notes].filter(Boolean).join(' · ')
  return { label: isRest ? 'Rest' : labels.join(' + ') || 'Open day', metric, detail, phase: entry.week?.phase }
}

function getWeekLabel(entries) {
  return entries.find((entry) => entry?.week)?.week?.phase ?? ''
}

function getSignalValue(entry, mode) {
  if (!entry) return 0
  const workouts = entry.day.workouts ?? []
  if (mode === 'volume') {
    const distance = workouts.reduce((total, workout) => total + getWorkoutDistanceKm(workout), 0)
    const duration = workouts.reduce((total, workout) => total + (Number(workout.duration_min) || 0), 0)
    return Math.min((distance / 32) + (duration / 180), 1)
  }
  const intensityScore = { none: 0.05, low: 0.25, moderate: 0.58, high: 0.92 }
  const definitions = entry.definitions ?? {}
  return Math.max(...workouts.map((workout) => intensityScore[definitions[workout.workout_ref]?.intensity] ?? 0.2), 0)
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - day)
  return result
}

function dateAtNoon(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
}

function isSameDay(first, second) {
  return Boolean(first && second) && first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate()
}

function formatDate(date, options) {
  return new Intl.DateTimeFormat('en-US', options).format(date)
}

function formatNumber(value) {
  return Number.isInteger(value) ? value : value.toFixed(1)
}

function titleCase(value = '') {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function planTitleFromFile(file) {
  return file.replace(/_hal_higdon_plan\.json$/, '').split('_').map((part) => { if (/^\d+k$/i.test(part)) return part.toUpperCase(); return part.charAt(0).toUpperCase() + part.slice(1) }).join(' ')
}

function App() {
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/'
  if (currentPath === '/compare') return <PlanComparisonPage />
  const variant = CALENDAR_STYLES.some((style) => '/' + style.id === currentPath) ? currentPath.slice(1) : null
  return variant ? <CalendarPage variant={variant} /> : <HomePage />
}

export default App
