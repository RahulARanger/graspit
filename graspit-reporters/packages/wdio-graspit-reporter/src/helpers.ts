import type { Options } from '@wdio/types';
import { AfterCommandArgs, BeforeCommandArgs } from '@wdio/reporter';
import { GraspItServiceOptions, ReporterOptions } from './types';
import GraspItService from './service';
import { currentReporter } from './contacts';

export function attachReporter(
  config: Options.Testrunner,
  options: ReporterOptions & GraspItServiceOptions,
): Options.Testrunner {
  const port = options.port ?? 6969;
  const toModify = config;

  toModify.reporters = toModify.reporters || [];
  toModify.services = toModify.services || [];

  toModify.reporters.push([
    'graspit',
    {
      port,
      addScreenshots: options.addScreenshots || false,
    },
  ]);

  toModify.services.push([
    GraspItService, {
      port,
      exePath: options.exePath,
      projectName: options.projectName,
      timeout: options.timeout,
      root: options.root,
      collectionName: options.collectionName,
      export: options.export,
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

export async function attachScreenshot(title: string, content: string, description?:string) {
  if (currentReporter?.skipTestRun) {
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
  if (currentReporter?.skipTestRun) {
    return;
  }

  await currentReporter?.supporter?.addDescription(
    content,
    currentReporter?.currentTestID ?? '',
  );
}
