export function fmtDate(d) {
  if (!d) return '-'
  const [y, m, day] = d.split('-')
  return `${day}-${m}-${y}`
}

export function fmtMoney(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN')
}

export function today() {
  return new Date().toISOString().split('T')[0]
}

export function avatarColor(i) {
  const cols = ['#1B4FD8','#0BA5A4','#F59E0B','#10B981','#7C3AED','#EF4444','#3B82F6']
  return cols[Math.abs(i) % cols.length]
}

export function initials(n) {
  if (!n) return '?'
  return n.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

export function statusBadgeClass(s) {
  const map = {
    Received: 'b-received',
    Processing: 'b-processing',
    Completed: 'b-completed',
    Packing: 'b-packing',
    Ready: 'b-ready',
    Delivered: 'b-delivered',
    Cancelled: 'b-cancelled',
  }
  return map[s] || 'b-received'
}

export function catBadgeClass(c) {
  if (c === 'Dry Clean') return 'b-dryclean'
  if (c === 'Rafu') return 'b-rafu'
  return 'b-charak'
}
