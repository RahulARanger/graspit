import type { Options } from '@wdio/types';
import { AfterCommandArgs, BeforeCommandArgs } from '@wdio/reporter';
import { Assertion } from 'common-handshakes';
import { HandshakeServiceOptions, ReporterOptions } from './types';
import HandshakeService from './service';
import { currentReporter } from './contacts';

export function attachReporter(
  config: Options.Testrunner,
  options: ReporterOptions & HandshakeServiceOptions,
): Options.Testrunner {
  const port = options.port ?? 6969;
  const toModify = config;

  toModify.reporters = toModify.reporters || [];
  toModify.services = toModify.services || [];

  toModify.reporters.push([
    'handshake',
    {
      port,
      addScreenshots: options.addScreenshots || false,
      timeout: options.timeout,
    },
  ]);

  toModify.services.push([
    HandshakeService, {
      port,
      exePath: options.exePath,
      timeout: options.timeout,
      root: options.root,
      workers: options.workers,
      collectionName: options.collectionName,
      export: options.export,
      testConfig: {
        ...options.testConfig, avoidParentSuitesInCount: options.testConfig.avoidParentSuitesInCount ?? config.framework === 'cucumber',
      },
    },
  ]);

  return toModify;
}

// Thanks to https://github.com/webdriverio/webdriverio/blob/a8ae7be72d0c58c7afa7ff085d9c4f41c9aea724/packages/wdio-allure-reporter/src/utils.ts#L153
export function isScreenShot(command: BeforeCommandArgs | AfterCommandArgs): boolean {
  const isScrenshotEndpoint = /\/session\/[^/]*(\/element\/[^/]*)?\/screenshot/;

  return (
    (command.endpoint && isScrenshotEndpoint.test(command.endpoint))
        || command.command === 'takeScreenshot'
  );
}

export function skipIfRequired() {
  if (currentReporter == null || currentReporter?.skipTestRun) {
    currentReporter?.logger.info('🚫 Skipping the test as marked');
    return true;
  }
  if (currentReporter.currentTestID == null) {
    currentReporter?.logger.warn('🤕 Didn\'t find the current test id');
    return true;
  }
  return false;
}

export async function attachScreenshot(title: string, content: string, description?:string) {
  if (skipIfRequired()) {
    return;
  }

  await currentReporter?.supporter?.attachScreenshot(
    title,
    content,
    currentReporter?.currentTestID ?? '',
    description,
  );
}

export async function addDescription(content: string) {
  if (skipIfRequired()) {
    return;
  }

  await currentReporter?.supporter?.addDescription(
    content,
    currentReporter?.currentTestID ?? '',
  );
}

export async function addLink(url: string, title: string) {
  if (skipIfRequired()) {
    return;
  }

  await currentReporter?.supporter?.addLink(
    url,
    title,
    currentReporter?.currentTestID ?? '',
  );
}

export async function addAssertion(assertion: Assertion) {
  if (skipIfRequired()) {
    return;
  }

  await currentReporter?.supporter?.addAssertion(
    assertion,
    currentReporter?.currentTestID ?? '',
  );
}
