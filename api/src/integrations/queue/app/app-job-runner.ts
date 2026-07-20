import type { AppJobName, AppJobPayloadMap } from './app-job.types';

export const APP_JOB_RUNNER = Symbol('APP_JOB_RUNNER');

export interface AppJobRunner {
  run<TName extends AppJobName>(
    name: TName,
    payload: AppJobPayloadMap[TName],
  ): Promise<void>;
}
