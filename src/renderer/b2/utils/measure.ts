export function measureStart(label: string) {
  if (performance.mark) {
    performance.mark(label);
  }
}

export function measureLog(label: string, ...vals) {
  if (performance.measure) {
    const m = performance.measure(label, label);
    const duration = Math.round(m.duration);
    console.debug(`[${label}] ${duration} ms`, ...vals);
  }
}