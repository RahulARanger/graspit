import getConnection from 'src/components/scripts/connection';
import LayoutStructureForRunDetails from 'src/components/core/TestRun';

import React, { useEffect, useMemo, useState } from 'react';
import { type GetStaticPropsResult } from 'next';
import { type ReactNode } from 'react';
import sqlFile from 'src/components/scripts/RunPage/script';
import type TestRunRecord from 'src/types/test-run-records';
import type {
    TestRecordDetails,
    ImageRecord,
    AssertionRecord,
    RetriedRecord,
} from 'src/types/test-entity-related';
import { type SuiteRecordDetails } from 'src/types/test-entity-related';
import type DetailedPageProperties from 'src/types/records-in-detailed';
import type { ValuesInDetailedContext } from 'src/types/records-in-detailed';
import { DetailedContext } from 'src/types/records-in-detailed';
import {
    parseDetailedTestRun,
    parseImageRecords,
    parseRetriedRecords,
    parseSuites,
    parseTests,
} from 'src/components/parse-utils';
import { menuTabs } from 'src/types/ui-constants';
import { useRouter } from 'next/router';
import TestEntities from 'src/components/core/test-entities';

export async function getStaticProps(prepareProperties: {
    params: {
        id: string;
    };
}): Promise<GetStaticPropsResult<DetailedPageProperties>> {
    const testID = prepareProperties.params.id;

    const connection = await getConnection();

    await connection.exec({
        sql: sqlFile('detailed-page.sql').replace('?', testID),
    });

    const detailsOfTestRun = await connection.get<TestRunRecord>(
        'SELECT * from CURRENT_RUN;',
    );

    if (detailsOfTestRun == undefined) {
        return {
            redirect: {
                permanent: true,
                destination: '/RUNS/no-test-run-found',
            },
        };
    }

    const suites =
        (await connection.all<SuiteRecordDetails[]>('SELECT * FROM SUITES;')) ??
        [];

    const tests =
        (await connection.all<TestRecordDetails[]>('SELECT * FROM TESTS;')) ??
        [];

    const assertions = await connection.all<AssertionRecord[]>(
        'SELECT * from ASSERTIONS;',
    );
    const images = await connection.all<ImageRecord[]>('SELECT * FROM IMAGES;');

    const retriedRecords =
        (await connection.all<RetriedRecord[]>('SELECT * FROM RETRIES;')) ?? [];

    await connection.close();

    return {
        props: {
            detailsOfTestRun,
            suites,
            tests,
            assertions,
            images,
            retriedRecords,
        },
    };
}

export default function TestRunResults(
    properties: DetailedPageProperties,
): ReactNode {
    const parsedRecords: ValuesInDetailedContext = useMemo(() => {
        const testRun = parseDetailedTestRun(properties.detailsOfTestRun);
        const suites = parseSuites(
            properties.suites,
            testRun.Started[0],
            testRun.Tests,
        );
        const images = parseImageRecords(
            properties.images,
            properties.detailsOfTestRun.testID,
        );
        return {
            detailsOfTestRun: testRun,
            suites,
            tests: parseTests(
                properties.tests,
                suites,
                images,
                properties.assertions,
            ),
            retriedRecords: parseRetriedRecords(properties.retriedRecords),
        };
    }, [properties]);
    const router = useRouter();
    const [viewMode, setViewMode] = useState<string>(
        menuTabs.testEntitiesTab.gridViewMode,
    );
    const [highlight, setHightLight] = useState<string>('');

    useEffect(() => {
        if (!router.isReady) return;
        const query = router.query as { tab: string };
        setViewMode(query.tab);
    }, [setViewMode, router]);

    return (
        <DetailedContext.Provider value={parsedRecords}>
            <LayoutStructureForRunDetails
                activeTab={viewMode}
                changeDefault={setViewMode}
                highlight={highlight}
            >
                <TestEntities
                    defaultTab={viewMode}
                    setHightLight={setHightLight}
                />
            </LayoutStructureForRunDetails>
        </DetailedContext.Provider>
    );
}

export { default as getStaticPaths } from 'src/components/scripts/RunPage/generate-path';
