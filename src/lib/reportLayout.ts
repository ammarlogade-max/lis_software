export function readReportGroupPageModes(orderId: string): Record<string, boolean> {
  const stored = window.localStorage.getItem(`lis-report-group-page-modes:${orderId}`);
  if (!stored) return {};

  const parsed: unknown = JSON.parse(stored);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Saved report page layout is not valid.');
  }

  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
  );
}

export function saveReportGroupPageModes(orderId: string, modes: Record<string, boolean>): void {
  window.localStorage.setItem(`lis-report-group-page-modes:${orderId}`, JSON.stringify(modes));
}
