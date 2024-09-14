import dayjs from 'dayjs';
import { Chance } from 'chance';
import type { statusOfEntity } from 'types/session-records';
import type { TestRunRecord } from 'types/test-run-records';

interface Feeder {
    started?: dayjs.Dayjs;
    ended?: dayjs.Dayjs;
    framework?: string;
    passed?: number;
    failed?: number;
    skipped?: number;
    tests?: number;
    avoidParentSuitesInCount?: boolean;
    fileRetries?: number;
    maxInstances?: number;
    suites?: number;
    passedSuites?: number;
    failedSuites?: number;
    skippedSuites?: number;
}

export function getStatus(
    passed: number,
    failed: number,
    skipped: number,
): statusOfEntity {
    if (failed) return 'FAILED';
    return passed === 0 && skipped !== 0 ? 'SKIPPED' : 'PASSED';
}
const generator = Chance();

export function generateTestRun(rawFeed?: Feeder): TestRunRecord {
    const feed: Feeder = rawFeed ?? {};

    const tests = feed.tests ?? generator.integer({ min: 3, max: 100 });
    const passed = feed.passed ?? generator.integer({ min: 0, max: tests });
    const failed =
        feed.failed ?? generator.integer({ min: 0, max: tests - passed });

    const skipped = tests - (passed + failed);

    const fileRetries =
        feed.fileRetries ?? generator.integer({ min: 0, max: 2 });

    const maxInstances =
        feed.maxInstances ?? generator.integer({ min: 0, max: 2 });

    const bail = generator.integer({ min: 0, max: 3 });

    const suites = feed.suites ?? generator.integer({ min: 1, max: tests });
    const passedSuites = generator.integer({ min: 0, max: suites });
    const failedSuites = generator.integer({
        min: 0,
        max: suites - passedSuites,
    });
    const skippedSuites = suites - (passedSuites + failedSuites);

    const platform = generator.pickone([
        'windows',
        'macos',
        'win32',
        'mac13',
        'ubuntu',
    ]);

    // eslint-disable-next-line unicorn/no-new-array
    const tags = new Array(generator.integer({ min: 0, max: 4 }))
        .map(() =>
            generator.bool()
                ? { name: generator.hashtag(), label: 'test' }
                : false,
        )
        .filter((index) => index !== false);

    const back = generator.integer({ min: 0, max: 3 });
    const backBy = generator.pickone([
        'week',
        'days',
        'months',
    ]) as dayjs.ManipulateType;

    const durationFor = generator.pickone([
        'minutes',
        'seconds',
        'hours',
    ]) as dayjs.ManipulateType;

    const started = (
        feed.started ??
        dayjs()
            .subtract(back, backBy)
            .subtract(generator.integer({ min: 10, max: 20 }), durationFor)
    ).toISOString();
    const ended = (
        feed.ended ??
        dayjs()
            .subtract(back, backBy)
            .subtract(generator.integer({ min: 5, max: 9 }), durationFor)
    ).toISOString();

    return {
        started,
        ended,
        framework: feed.framework ?? 'webdriverio,mocha',
        passed,
        failed,
        skipped,
        platform,
        avoidParentSuitesInCount: feed.avoidParentSuitesInCount || false,
        exitCode: Number(failed),
        fileRetries,
        maxInstances,
        bail,
        suiteSummary: JSON.stringify({
            count: suites,
            failed: failedSuites,
            skipped: skippedSuites,
            passed: passedSuites,
        }),
        duration: dayjs(ended).diff(dayjs(started)),
        projectName: generator.company(),
        testID: crypto.randomUUID(),
        tests,
        standing: getStatus(passed, failed, skipped),
        tags: JSON.stringify(tags),
        specStructure: JSON.stringify({
            'features\\login.feature': {
                current: 'features\\login.feature',
                suites: 2,
            },
        }),
        retried: generator.integer({ min: 0, max: 1 }),
        projectIndex: generator.integer({ min: 0, max: 10 }),
        timelineIndex: generator.integer({ min: 0, max: 20 }),
    };
}

export const onlySkipped = generateTestRun({
    tests: 3,
    skipped: 3,
    passed: 0,
    failed: 0,
    suites: 3,
    passedSuites: 0,
    failedSuites: 0,
    skippedSuites: 3,
});
export const allPassed = generateTestRun({
    tests: 10,
    skipped: 0,
    passed: 10,
    failed: 0,
    suites: 3,
    passedSuites: 3,
    failedSuites: 0,
    skippedSuites: 0,
});

export const mixed = generateTestRun({});

export const randomTestProjects = (length: number) => {
    const generator = new Chance();
    return Array.from({ length })
        .fill(true)
        .map(() => generator.company());
};

export function generateTestRunForDemo() {
    return generator.n(generateTestRun, 6);
}
