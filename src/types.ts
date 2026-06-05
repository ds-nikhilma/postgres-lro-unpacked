export interface WorkItem {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'canceled' | 'expired' | 'deleted';
  created_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
  claimed_until: string | null;
  claimed_count: number;
  cache_key: string | null;
  version: string | null;
  compute_request: string;
  output_data: string | null;
  finished_at: string | null;
}

export interface SlideProps {
  isActive: boolean;
  /** Navigate to another slide by index or by slide title (case-insensitive substring match). */
  goToSlide?: (target: number | string) => void;
}
