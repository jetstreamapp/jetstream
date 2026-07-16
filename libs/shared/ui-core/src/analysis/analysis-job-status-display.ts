/**
 * Analysis job `status` from the API is stored lowercase; format for UI labels.
 */
export function formatAnalysisJobStatusForDisplay(status: string | null | undefined): string {
  if (status == null || !String(status).trim()) {
    return '—';
  }
  const normalized = String(status).trim().toLowerCase();
  switch (normalized) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'running':
      return 'Running';
    case 'pending':
      return 'Pending';
    default:
      return String(status)
        .trim()
        .split(/[\s_-]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
  }
}
