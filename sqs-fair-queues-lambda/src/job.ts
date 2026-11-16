// src/job.ts
export interface ClubJob {
  /** Tenant: every club is its own tenant */
  clubId: string;
  /** Unique job ID, also used for idempotency */
  jobId: string;
  type: 'membership-card' | 'welcome-mail';
  memberId: string;
}

export function parseClubJob(body: string): ClubJob {
  const data = JSON.parse(body) as Partial<ClubJob>;
  if (!data.clubId || !data.jobId || !data.memberId || !data.type) {
    throw new Error('Invalid job: clubId, jobId, memberId and type are required');
  }
  return data as ClubJob;
}
