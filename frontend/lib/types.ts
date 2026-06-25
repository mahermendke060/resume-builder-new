export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ResumeOut {
  id: string;
  filename: string | null;
  parse_status: string;
  parsed_json: Record<string, any> | null;
  active: boolean;
  created_at: string;
}

export interface JobStub {
  source: string;
  external_id: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  url: string | null;
  posted_at: string | null;
  snippet: string | null;
}

export interface DiscoverResponse {
  jobs: JobStub[];
}

export interface JobOut {
  id: string;
  source: string;
  title: string | null;
  company: string | null;
  location: string | null;
  url: string | null;
  posted_at: string | null;
  created_at: string;
  description?: { raw_text: string; capture_mode: string; quality_score: number | null } | null;
}

export interface ScoreOut {
  overall: number;
  breakdown: Record<string, number>;
  missing_keywords: string[];
  warnings: string[];
}

export interface TailorRunDetail {
  id: string;
  resume_id: string;
  job_id: string;
  status: string;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at?: string;
  updated_at?: string;
  variants: Array<{ id: string; content_json: Record<string, any>; provenance_json: any; docx_key: string | null; pdf_key: string | null }>;
  scores: ScoreOut[];
}
