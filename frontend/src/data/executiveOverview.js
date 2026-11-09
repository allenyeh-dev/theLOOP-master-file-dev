// Mock data for the Admin Hub / Executive Overview dashboards, ported from
// the reference prototype (theLOOP-master-plan). No live POS/incident feed
// exists yet — these numbers are for UI preview only, same as upstream.

export const OUTLETS = [
  { key: 'sf', name: 'Santa Fe', brand: 'santafe', color: '#c4611a', covers: 243, target: 220, prevPct: 10, status: 'healthy' },
  { key: 'kor', name: 'KOR', brand: 'kor', color: '#c03040', covers: 312, target: 300, prevPct: 4, status: 'healthy' },
  { key: 'ran', name: 'Rancho', brand: 'rancho', color: '#5aba7a', covers: 189, target: 210, prevPct: -10, status: 'watch' },
  { key: 'clv', name: 'CLV Boon', brand: 'clv', color: '#c88840', covers: 156, target: 150, prevPct: 4, status: 'healthy' },
  { key: 'spc', name: 'SPC', brand: 'spc', color: '#625d57', covers: null, target: null, prevPct: null, status: 'na' },
]

export const ADMIN_HERO = {
  sup: "Admin Hub · All Brands",
  outletsActive: 3,
  lastUpdated: '08:42am',
  statusPills: [
    { label: '5 Outlets Synced', tone: 'ok', dot: '#5aba7a' },
    { label: '1 Access Flag', tone: 'alert', dot: '#e07060' },
    { label: '3 Reports In', tone: 'neutral', dot: '#625d57' },
  ],
}

export const ADMIN_STATS = [
  { val: 900, label: 'Covers Last Night' },
  { val: 2, label: 'Incidents', tone: 'red' },
  { val: 0, label: 'Emergencies', tone: 'green' },
  { val: 3, label: 'Shift Reports In', tone: 'amber' },
]

export const ADMIN_QUICK_ACTIONS = [
  { icon: 'clipboard', label: 'Ops Board', sub: 'All Brands', tone: 'primary' },
  { icon: 'lock', label: 'Access Logs', sub: '1 flag today', tone: 'flagged' },
  { icon: 'alert', label: 'Log Incident', sub: 'T1 · T2 · T3' },
  { icon: 'upload', label: 'Export', sub: 'Reports & Logs' },
]

export const EXEC_HERO = {
  sup: 'Executive Overview',
  outletsActive: 5,
}

export const EXEC_STATS = [
  { val: 900, label: 'Covers Last Night' },
  { val: 1, label: 'T2+ Incidents', tone: 'red' },
  { val: 0, label: 'Emergencies', tone: 'green' },
  { val: 3, label: 'Events Today', tone: 'amber' },
]

export const HOURS_CYCLE = [
  '12:00 pm', '1:00 pm', '2:00 pm', '3:00 pm', '4:00 pm', '5:00 pm', '6:00 pm', '7:00 pm',
  '8:00 pm', '9:00 pm', '10:00 pm', '11:00 pm', '12:00 am', '1:00 am', '2:00 am', '3:00 am', '4:00 am',
]

export const COVER_HOURLY = {
  hours: ['6:00 pm', '7:00 pm', '8:00 pm', '9:00 pm', '10:00 pm'],
  outlets: [
    { name: 'Santa Fe', brand: 'santafe', color: '#c4611a', hourly: [22, 41, 53, 47, 38], runningTotal: 236, priorNightSameHour: 210 },
    { name: 'KOR', brand: 'kor', color: '#c03040', hourly: [18, 34, 52, 61, 58], runningTotal: 171, priorNightSameHour: 185 },
    { name: 'Rancho', brand: 'rancho', color: '#5aba7a', hourly: [17, 29, 38, 33, 26], runningTotal: 169, priorNightSameHour: 150 },
    { name: 'CLV Boon', brand: 'clv', color: '#c88840', hourly: [4, 11, 24, 37, 44], runningTotal: 132, priorNightSameHour: 128 },
  ],
}

export const COVER_ANALYTICS = {
  day: {
    label: 'Jun 18 vs Jun 17',
    outlets: [
      { name: 'Santa Fe', brand: 'santafe', color: '#c4611a', current: 243, prior: 220, delta: '+10.5%', dir: 'up' },
      { name: 'KOR', brand: 'kor', color: '#c03040', current: 312, prior: 300, delta: '+4.0%', dir: 'up' },
      { name: 'Rancho', brand: 'rancho', color: '#5aba7a', current: 189, prior: 210, delta: '−10.0%', dir: 'down' },
      { name: 'CLV Boon', brand: 'clv', color: '#c88840', current: 156, prior: 150, delta: '+4.0%', dir: 'up' },
    ],
    total: { current: 900, prior: 880, delta: '+2.3%', dir: 'up' },
  },
  week: {
    label: 'Jun 9–15 vs Jun 2–8',
    outlets: [
      { name: 'Santa Fe', brand: 'santafe', color: '#c4611a', current: 1540, prior: 1420, delta: '+8.5%', dir: 'up' },
      { name: 'KOR', brand: 'kor', color: '#c03040', current: 2180, prior: 2250, delta: '−3.1%', dir: 'down' },
      { name: 'Rancho', brand: 'rancho', color: '#5aba7a', current: 1280, prior: 1190, delta: '+7.6%', dir: 'up' },
      { name: 'CLV Boon', brand: 'clv', color: '#c88840', current: 980, prior: 940, delta: '+4.3%', dir: 'up' },
    ],
    total: { current: 5980, prior: 5800, delta: '+3.1%', dir: 'up' },
  },
  month: {
    label: 'Jun vs May 2026',
    outlets: [
      { name: 'Santa Fe', brand: 'santafe', color: '#c4611a', current: 5800, prior: 5200, delta: '+11.5%', dir: 'up' },
      { name: 'KOR', brand: 'kor', color: '#c03040', current: 8400, prior: 8900, delta: '−5.6%', dir: 'down' },
      { name: 'Rancho', brand: 'rancho', color: '#5aba7a', current: 4200, prior: 3800, delta: '+10.5%', dir: 'up' },
      { name: 'CLV Boon', brand: 'clv', color: '#c88840', current: 3600, prior: 3100, delta: '+16.1%', dir: 'up' },
    ],
    total: { current: 22000, prior: 21000, delta: '+4.8%', dir: 'up' },
  },
}

// Keep only rows whose `brand` is one of the signed-in user's brands.
export function filterByBrands(rows, brands) {
  const keys = new Set(brands.map((b) => b.key))
  return rows.filter((r) => r.brand && keys.has(r.brand))
}

// Roll a per-outlet list up into the {current, prior, delta, dir} total shape.
export function sumTotals(outlets) {
  const current = outlets.reduce((n, o) => n + o.current, 0)
  const prior = outlets.reduce((n, o) => n + o.prior, 0)
  const pct = prior ? ((current - prior) / prior) * 100 : 0
  return {
    current,
    prior,
    delta: `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`,
    dir: pct >= 0 ? 'up' : 'down',
  }
}

// ---- Admin Hub sections (mock — UI preview only, no live feed yet) ----

export const ADMIN_BRAND_FILTERS = [
  { key: 'all', label: 'All Brands' },
  { key: 'sf', label: 'Santa Fe' },
  { key: 'kor', label: 'KOR' },
  { key: 'ran', label: 'Rancho' },
  { key: 'clv', label: 'CLV Boon' },
  { key: 'spc', label: 'SPC' },
]

export const ADMIN_RECAPS = {
  title: 'Night Recap — Jun 17',
  items: [
    {
      outlet: 'sf', name: 'SANTA FE', color: '#c4611a', covers: 243,
      summary: 'Smooth overall service. Section B private event (30 pax) concluded by 11:30pm with no issues. One Tier 1 staff incident at 10pm — resolved on shift. Handoff note flags broken AC unit in Section C, maintenance request submitted. Closing crew departed by 2:15am.',
      tags: [
        { label: '1 Incident', tone: 'amber' },
        { label: 'Maintenance Flagged', tone: 'muted' },
        { label: 'Event Completed', tone: 'green' },
      ],
    },
    {
      outlet: 'kor', name: 'KOR', color: '#c03040', covers: 312,
      summary: 'Busy Friday night. DJ set ran until 3am as scheduled. One Tier 2 incident at 1:20am — Drunk & Disorderly, guest removed by security with no escalation. Bar closed out on target. No maintenance issues. Strong bottle service night — full venue utilization.',
      tags: [
        { label: '1 Tier 2 Incident', tone: 'red' },
        { label: 'Security Handled', tone: 'green' },
        { label: 'Full House', tone: 'green' },
      ],
    },
    {
      outlet: 'ran', name: 'RANCHO', color: '#5aba7a', covers: 189,
      summary: 'Below target — walk-in traffic softer than expected for a Friday. No incidents. Patio section was underutilized due to light rain. Handoff note: kitchen closed 30 min early at MOD BOH discretion. No late reservations were missed.',
      tags: [
        { label: 'Clean Night', tone: 'green' },
        { label: 'Below Target', tone: 'amber' },
        { label: 'Weather Impact', tone: 'muted' },
      ],
    },
    {
      outlet: 'clv', name: 'CLV BOON', color: '#c88840', covers: 156,
      summary: 'Steady Friday night — slightly below cover target but within acceptable range. Bar service strong on cocktails. One FOH staff called out last minute, shift adjusted without service impact. No incidents. All SOPs maintained.',
      tags: [
        { label: 'Clean Night', tone: 'green' },
        { label: 'Below Target', tone: 'amber' },
      ],
    },
  ],
}

export const ADMIN_SCHEDULE = {
  title: 'Team Schedule — All Venues',
  rows: [
    { outlet: 'clv', name: 'CLV Boon', color: '#c88840', published: 2, total: 2 },
    { outlet: 'kor', name: 'KOR', color: '#c03040', published: 2, total: 2 },
    { outlet: 'spc', name: 'SPC Kitchen', color: '#e3a83f', published: 1, total: 1 },
  ],
}

export const ADMIN_INCIDENTS = [
  {
    tier: 'T2', tone: 'red', title: 'Drunk & Disorderly — Guest Removed',
    tag: 'KOR', color: '#c03040', meta: 'Jun 17 · 1:20am · Reported by MOD FOH',
    sop: 'KOR Security & Door S.O.P. (Pending)',
  },
  {
    tier: 'T1', tone: 'amber', title: 'Staff Dispute — Verbal Altercation (Resolved)',
    tag: 'RSF', color: '#c88840', meta: 'Jun 17 · 10:00pm · Reported by MOD FOH',
    sop: 'RSF-OPS-005 Incident Response Framework',
  },
]

// `dayOffset` is relative to the date shown in the stepper (0 = today).
export const ADMIN_LOGS = [
  { outlet: 'kor', kind: 'incident', tier: 'T2', title: 'Drunk & Disorderly — Guest Removed', tag: 'KOR', color: '#c03040', meta: 'Jun 17 · 1:20am · Manager on Duty', dayOffset: 0 },
  { outlet: 'kor', kind: 'open', title: 'Opening Log — KOR', tag: 'KOR', color: '#c03040', meta: 'Jun 17 · 4:54 PM · Manager on Duty', dayOffset: 0 },
  { outlet: 'kor', kind: 'open', title: 'Opening Log — KOR', tag: 'KOR', color: '#c03040', meta: 'Jun 17 · 4:54 PM · Manager on Duty', dayOffset: 0 },
  { outlet: 'kor', kind: 'open', title: 'Opening Log — KOR', tag: 'KOR', color: '#c03040', meta: 'Jun 17 · 6:30pm · Manager on Duty', dayOffset: 0 },
  { outlet: 'sf', kind: 'open', title: 'Opening Log — Santa Fe', tag: 'SF', color: '#c4611a', meta: 'Jun 17 · 5:10 PM · Manager on Duty', dayOffset: 0 },
  { outlet: 'ran', kind: 'open', title: 'Opening Log — Rancho', tag: 'RAN', color: '#5aba7a', meta: 'Jun 17 · 5:30 PM · Manager on Duty', dayOffset: 0 },
]

export const ADMIN_TODAY = [
  { time: '6pm', title: 'Santa Fe — Brunch Menu Staff Briefing', sub: 'All FOH · Ahead of June 22 launch', tag: 'RSF', color: '#c88840' },
  { time: '8pm', title: 'KOR — Regular Saturday Service', sub: 'Full house expected · DJ from 11pm', tag: 'KOR', color: '#c03040' },
  { time: '7pm', title: 'Rancho — Private Buyout 60 Pax', sub: 'Full venue · Event run sheet active', tag: 'RAN', color: '#5aba7a' },
]

export const ADMIN_PLATFORM = [
  { icon: 'person', tone: 'ok', title: '3 New Accounts Created', sub: '2 × Santa Fe FOH · 1 × KOR Bar · by GM Maria Chen & GM Kevin Liu', badge: 'Normal' },
  { icon: 'lock', tone: 'review', title: 'Access Anomaly Flagged', sub: 'Staff account RSF-0441 accessed sensitive docs 3 min after creation — Jun 18, 9:14am', badge: 'Review' },
  { icon: 'key', tone: 'ok', title: '2 Password Changes', sub: 'RSF-0438 · KOR-0217 · Both within normal first-login window', badge: 'Normal' },
  { icon: 'signout', tone: 'logged', title: '1 Account Deactivated', sub: 'RSF-0391 removed by GM Maria Chen · Jun 17, 11:55pm', badge: 'Logged' },
]

export const ADMIN_SOP_FLAGS = []
