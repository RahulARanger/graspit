import type { dataBaseConnection } from 'src/components/scripts/connection';
import type { TestRunSummary } from 'src/types/test-run-records';
import type TestRunRecord from 'src/types/test-run-records';

const miniConditionForTestRuns = "WHERE ended <> ''";
const conditionForTestRuns = `${miniConditionForTestRuns} order by started desc limit ?`;

export async function getDetailsOfRelatedRuns(
    connection: dataBaseConnection,
    projectName: string,
    maxTestRuns?: number,
) {
    const testRuns = await connection.all<Array<{ testID: string }>>(
        `select testID from runbase ${conditionForTestRuns}`,
        maxTestRuns ?? -1,
    );

    const runs = testRuns.map((run) => run.testID);
    const sqlHelperForRuns = `(${runs.map(() => '?').join(',')})`;

    return connection.all<TestRunRecord[]>(
        `SELECT * from runbase where projectName = ? and testID in ${sqlHelperForRuns} order by started desc;`,
        projectName,
        ...runs,
    );
}

export function generateTestRunSummary(
    _testDetails: TestRunRecord,
): TestRunSummary {
    const testDetails = JSON.parse(_testDetails.suiteSummary);
    return {
        TESTS: {
            passed: _testDetails.passed,
            failed: _testDetails.failed,
            skipped: _testDetails.skipped,
            tests: _testDetails.tests,
        },
        SUITES: {
            passed: testDetails.passed,
            failed: testDetails.failed,
            skipped: testDetails.skipped,
            count: testDetails.count,
        },
        RETRIED: _testDetails.retried,
    };
}
