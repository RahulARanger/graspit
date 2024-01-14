import type { Dayjs } from 'dayjs';
import type { statusOfEntity } from 'src/types/session-records';
import type { Duration } from 'dayjs/plugin/duration';
import type { ErrorRecord, SimpleSuiteDetails } from './test-entity-related';
import type { specNode } from './test-run-records';

export default interface BasicDetails {
    Started: [Dayjs, Dayjs];
    Ended: [Dayjs, Dayjs];
    Status: statusOfEntity;
    Title: string;
    Duration: Duration;
    Rate: [number, number, number];
    Id: string;
    Tests: number;
}

export interface DetailedTestRecord extends BasicDetails {
    SuitesSummary: [number, number, number];
    Suites: number;
    Link: string;
    projectName: string;
    specStructure: specNode;
}

export interface ParsedSuiteRecord extends BasicDetails, SimpleSuiteDetails {
    errors: ErrorRecord[];
    error: ErrorRecord;
    RollupValues: [number, number, number];
    totalRollupValue: number;
    Contribution: number;
    File: string;
    entityName: string;
    entityVersion: string;
    simplified: string;
    hooks: number;
}

export interface ParsedTestRecord extends BasicDetails, SimpleSuiteDetails {
    isBroken: boolean;
    errors: ErrorRecord[];
    error: ErrorRecord;
}

export type SuiteDetails = { '@order': string[] } & Record<
    string,
    ParsedSuiteRecord
>;

export type TestDetails = Record<string, ParsedTestRecord>;

interface ParsedRetriedRecord {
    suite_id: string;
    test: string;
    tests: string[];
    key: number;
    length: number;
}

export type ParsedRetriedRecords = Record<string, ParsedRetriedRecord>;
