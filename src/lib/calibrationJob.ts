export const CALIBRATION_JOB_SESSION_KEY = 'northpath:pending-calibration-v1';

export type CalibrationJobInput = {
  jobTitle: string;
  jobStage: string;
  jobDirection: string;
  targetJD: string;
  resumeText: string;
};

export type CalibrationJobState = {
  input: CalibrationJobInput;
  startedAt: number;
  status: 'pending' | 'running' | 'failed' | 'done';
};

export const saveCalibrationJob = (input: CalibrationJobInput) => {
  const state: CalibrationJobState = {
    input,
    startedAt: Date.now(),
    status: 'pending',
  };
  sessionStorage.setItem(CALIBRATION_JOB_SESSION_KEY, JSON.stringify(state));
};

export const readCalibrationJob = (): CalibrationJobState | null => {
  const raw = sessionStorage.getItem(CALIBRATION_JOB_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CalibrationJobState>;
    if (!parsed.input?.jobTitle || !parsed.input.resumeText) return null;
    return {
      input: {
        jobTitle: parsed.input.jobTitle,
        jobStage: parsed.input.jobStage || '实习',
        jobDirection: parsed.input.jobDirection || '通用',
        targetJD: parsed.input.targetJD || '',
        resumeText: parsed.input.resumeText,
      },
      startedAt: Number(parsed.startedAt ?? Date.now()) || Date.now(),
      status: parsed.status === 'running' || parsed.status === 'failed' || parsed.status === 'done' ? parsed.status : 'pending',
    };
  } catch {
    return null;
  }
};

export const updateCalibrationJobStatus = (status: CalibrationJobState['status']) => {
  const current = readCalibrationJob();
  if (!current) return;
  sessionStorage.setItem(CALIBRATION_JOB_SESSION_KEY, JSON.stringify({ ...current, status }));
};

export const clearCalibrationJob = () => {
  sessionStorage.removeItem(CALIBRATION_JOB_SESSION_KEY);
};

