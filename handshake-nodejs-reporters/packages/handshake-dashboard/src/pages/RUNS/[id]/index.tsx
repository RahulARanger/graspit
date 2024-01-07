import type { SuiteDetails } from 'src/types/generated-response';
import { type DetailedTestRunPageProperties } from 'src/types/generated-response';
import getConnection from 'src/components/scripts/connection';
import LayoutStructureForRunDetails from 'src/components/core/TestRun';

import React, { useMemo } from 'react';
import { type GetStaticPropsResult } from 'next';
import { type ReactNode } from 'react';
import EnsureFallback from 'src/components/utils/swr-fallback';
import { menuTabs } from 'src/types/ui-constants';
import Overview from 'src/components/core/TestRun/overview-tab';
import { attachmentPrefix } from 'src/components/core/TestRun/context';

import sqlFile from 'src/components/scripts/RunPage/script';
import type TestRunRecord from 'src/types/test-run-records';
import type { TestRunConfig } from 'src/types/test-run-records';
import type {
    ImageRecord,
    SuiteRecordDetails,
} from 'src/types/test-entity-related';
import { parseEntitiesForOverview } from 'src/components/scripts/RunPage/parse-overview-records';
import type {
    OverallAggResults,
    OverviewPageProperties,
    SessionSummary,
} from 'src/types/records-in-overview';

export async function getStaticProps(): Promise<
    GetStaticPropsResult<OverviewPageProperties>
> {
    const testID = '0e329d8f-9624-44e1-8d04-93e3771dd750';

    const connection = await getConnection();

    await connection.exec({
        sql: sqlFile('overview-script.sql').replace('?', testID),
    });
    const detailsOfTestRun = await connection.get<TestRunRecord>(
        'SELECT * FROM CURRENT_RUN',
    );
    const summaryForAllSessions = await connection.all<SessionSummary[]>(
        'SELECT * FROM SESSION_SUMMARY',
    );

    if (summaryForAllSessions == undefined || detailsOfTestRun == undefined) {
        return {
            redirect: {
                permanent: true,
                destination: '/RUNS/no-test-run-found',
            },
        };
    }

    const testRunConfig =
        (await connection.get<TestRunConfig>('SELECT * FROM TEST_CONFIG;')) ??
        false;

    const recentSuites =
        (await connection.all<SuiteRecordDetails[]>(
            "SELECT * FROM RECENT_ENTITIES WHERE suiteType = 'SUITE';",
        )) ?? [];

    const recentTests =
        (await connection.all<SuiteRecordDetails[]>(
            "SELECT * FROM RECENT_ENTITIES WHERE suiteType = 'TEST';",
        )) ?? [];

    const randomImages = await connection.all<ImageRecord[]>(
        'SELECT * FROM IMAGES;',
    );

    const aggResults: OverallAggResults = {
        parentSuites: 0,
        files: 0,
        sessionCount: 0,
        imageCount: 0,
    };

    await connection.each<{ key: string; value: number }>(
        'SELECT * FROM KEY_NUMBERS',
        (_, row) => {
            aggResults[
                row.key as
                    | 'parentSuites'
                    | 'files'
                    | 'sessionCount'
                    | 'imageCount'
            ] = row.value;
        },
    );

    await connection.close();

    return {
        props: {
            detailsOfTestRun,
            summaryForAllSessions,
            testRunConfig,
            aggResults,
            recentTests,
            recentSuites,
            randomImages,
            attachmentPrefix: process.env.ATTACHMENTS ?? attachmentPrefix,
        },
    };
}

export default function TestRunResults(
    properties: OverviewPageProperties,
): ReactNode {
    const parsedRecords = useMemo(() => {
        return {
            recentTests: parseEntitiesForOverview(properties.recentTests),
            recentSuites: parseEntitiesForOverview(properties.recentSuites),
        };
    }, properties);

    return (
        <EnsureFallback fallbackPayload={parsedRecords}>
            <LayoutStructureForRunDetails activeTab={menuTabs.overviewTab}>
                <Overview />
            </LayoutStructureForRunDetails>
        </EnsureFallback>
    );
}

export { default as getStaticPaths } from 'src/components/scripts/RunPage/generate-path';
