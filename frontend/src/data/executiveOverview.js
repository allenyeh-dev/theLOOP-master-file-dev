// Mock data for the Admin Hub / Executive Overview dashboards, ported from
// the reference prototype (theLOOP-master-plan). No live POS/incident feed
// exists yet — these numbers are for UI preview only, same as upstream.

export const OUTLETS = [
  { key: 'sf', name: 'Santa Fe', color: '#c4611a', covers: 243, target: 220, prevPct: 10, status: 'healthy' },
  { key: 'kor', name: 'KOR', color: '#c03040', covers: 312, target: 300, prevPct: 4, status: 'healthy' },
  { key: 'ran', name: 'Rancho', color: '#5aba7a', covers: 189, target: 210, prevPct: -10, status: 'watch' },
  { key: 'clv', name: 'CLV Boon', color: '#c88840', covers: 156, target: 150, prevPct: 4, status: 'healthy' },
  { key: 'spc', name: 'SPC', color: '#625d57', covers: null, target: null, prevPct: null, status: 'na' },
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
  { val: 2, label: 'All Incidents', tone: 'red' },
  { val: 0, label: 'Emergencies', tone: 'green' },
  { val: 3, label: 'Reports In', tone: 'amber' },
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
    { name: 'Santa Fe', color: '#c4611a', hourly: [22, 41, 53, 47, 38], runningTotal: 236, priorNightSameHour: 210 },
    { name: 'KOR', color: '#c03040', hourly: [18, 34, 52, 61, 58], runningTotal: 171, priorNightSameHour: 185 },
    { name: 'Rancho', color: '#5aba7a', hourly: [17, 29, 38, 33, 26], runningTotal: 169, priorNightSameHour: 150 },
    { name: 'CLV Boon', color: '#c88840', hourly: [4, 11, 24, 37, 44], runningTotal: 132, priorNightSameHour: 128 },
  ],
}

export const COVER_ANALYTICS = {
  day: {
    label: 'Jun 18 vs Jun 17',
    outlets: [
      { name: 'Santa Fe', color: '#c4611a', current: 243, prior: 220, delta: '+10.5%', dir: 'up' },
      { name: 'KOR', color: '#c03040', current: 312, prior: 300, delta: '+4.0%', dir: 'up' },
      { name: 'Rancho', color: '#5aba7a', current: 189, prior: 210, delta: '−10.0%', dir: 'down' },
      { name: 'CLV Boon', color: '#c88840', current: 156, prior: 150, delta: '+4.0%', dir: 'up' },
    ],
    total: { current: 900, prior: 880, delta: '+2.3%', dir: 'up' },
  },
  week: {
    label: 'Jun 9–15 vs Jun 2–8',
    outlets: [
      { name: 'Santa Fe', color: '#c4611a', current: 1540, prior: 1420, delta: '+8.5%', dir: 'up' },
      { name: 'KOR', color: '#c03040', current: 2180, prior: 2250, delta: '−3.1%', dir: 'down' },
      { name: 'Rancho', color: '#5aba7a', current: 1280, prior: 1190, delta: '+7.6%', dir: 'up' },
      { name: 'CLV Boon', color: '#c88840', current: 980, prior: 940, delta: '+4.3%', dir: 'up' },
    ],
    total: { current: 5980, prior: 5800, delta: '+3.1%', dir: 'up' },
  },
  month: {
    label: 'Jun vs May 2026',
    outlets: [
      { name: 'Santa Fe', color: '#c4611a', current: 5800, prior: 5200, delta: '+11.5%', dir: 'up' },
      { name: 'KOR', color: '#c03040', current: 8400, prior: 8900, delta: '−5.6%', dir: 'down' },
      { name: 'Rancho', color: '#5aba7a', current: 4200, prior: 3800, delta: '+10.5%', dir: 'up' },
      { name: 'CLV Boon', color: '#c88840', current: 3600, prior: 3100, delta: '+16.1%', dir: 'up' },
    ],
    total: { current: 22000, prior: 21000, delta: '+4.8%', dir: 'up' },
  },
}
