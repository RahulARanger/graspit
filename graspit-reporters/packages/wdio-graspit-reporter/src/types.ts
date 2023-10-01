import type { Tag } from '@wdio/reporter';

export interface ReporterOptions {
  port?: number;
}

export type SuiteType = 'SUITE' | 'TEST';

export interface PayloadForRegisteringTestEntity {
  title: string;
  description: string;
  file: string;
  standing: string;
  tags: string[] | Tag[];
  started: string;
  suiteType: SuiteType;
  parent: string;
  session_id: string;
  retried: number;
}

export interface PayloadForMarkingTestEntityCompletion {
  duration: number;
  suiteID: string;
  error?: Error;
  errors: Error[];
  standing: string;
}

export interface GraspItServiceOptions {
  port?: number;
  root?: string;
  collectionName?: string;
  timeout?: number;
  results?: string;
  projectName?: string;
}
