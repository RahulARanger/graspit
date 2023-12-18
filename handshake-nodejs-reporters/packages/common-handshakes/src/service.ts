import log4js from 'log4js';
import superagent from 'superagent';
import {
  spawn, spawnSync,
} from 'node:child_process';
import {
  setTimeout,
  setInterval,
  clearTimeout,
} from 'node:timers';
import type { ChildProcess, SpawnSyncReturns } from 'node:child_process';
import DialPad from './dialPad';
import { UpdateTestRunConfig } from './payload';

const logger = log4js.getLogger('handshake-service');

// eslint-disable-next-line import/prefer-default-export
export class ServiceDialPad extends DialPad {
  pyProcess?: ChildProcess;

  workers: number = 2;

  get updateRunConfigUrl(): string {
    return `${this.saveUrl}/currentRun`;
  }

  executeCommand(args: string[], isSync: boolean, cwd: string, timeout?:number) {
    const starter = isSync ? spawnSync : spawn;

    logger.info(`🤝 with ${args} at ${this.exePath} from ${cwd} => ${args.join(' ')}`);

    return starter(
      this.exePath,
      args,
      {
        timeout, shell: false, cwd, stdio: 'inherit', detached: false,
      },
    );
  }

  startService(
    projectName: string,
    resultsDir: string,
    rootDir: string,
    workers?: number,
  ): ChildProcess {
    this.workers = Math.max(workers ?? 0, 2);
    const args = ['run-app', projectName, resultsDir, '-p', this.port.toString(), '-w', String(this.workers)];
    logger.warn(`Requesting a handshake server, command used: ${args.join(' ')} from ${rootDir}`);

    const pyProcess = this.executeCommand(args, false, rootDir) as ChildProcess;
    this.pyProcess = pyProcess;
    pyProcess.stdout?.on('data', (chunk) => logger.info(chunk.toString()));
    pyProcess.stderr?.on('data', (chunk) => logger.error(chunk.toString()));

    pyProcess.on('error', (err: Buffer) => {
      throw new Error(String(err));
    });

    pyProcess.on('exit', (code) => {
      if (code !== 0) {
        logger.warn(
          `handshake-server was force closed 😫, found exit code: ${code}`,
        );
      }
    });

    logger.info(
      `Started handshake-server, running 🐰 at pid: ${pyProcess.pid}`,
    );

    // important for avoiding zombie py server
    process.on('exit', async () => {
      pyProcess.kill('SIGINT');
      await this.terminateServer();
    });

    return pyProcess;
  }

  async ping(): Promise<boolean> {
    logger.warn('pinging py-server 👆...');
    const resp = await superagent.get(`${this.url}/`).catch(() => logger.warn('ping failed'));
    return resp?.statusCode === 200;
  }

  async waitUntilItsReady(force?:number): Promise<unknown> {
    const waitingForTheServer = new Error(
      'Not able to connect with handshake-server within 20 seconds 😢.',
    );
    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout;
      let bomb: NodeJS.Timeout;
      const cleanup = () => { clearTimeout(bomb); clearInterval(timer); };

      bomb = setTimeout(async () => {
        cleanup();
        await this.terminateServer();
        reject(waitingForTheServer);
      }, force ?? 20e3);

      timer = setInterval(async () => {
        const isOnline = await this.ping();

        if (isOnline) {
          cleanup();
          logger.info('Server is online! 😀');
          resolve({});
        } else {
          logger.warn('😓 pinging server again...');
        }
      }, 3e3);
    });
  }

  async isServerTerminated(): Promise<boolean> {
    if (this.pyProcess?.killed) return true;
    const resp = await superagent.get(`${this.url}/`).catch(() => logger.warn('ping failed'));
    const wasTerminated = resp?.statusCode !== 200;
    if (!wasTerminated) logger.warn('→ Had to 🗡️ the handshake-server.');
    return wasTerminated;
  }

  async terminateServer() {
    const results = [];
    for (let worker = 0; worker < this.workers; worker += 1) {
      logger.info('Shutting down a worker of handshake-server');
      results.push(
        superagent
          .post(`${this.url}/bye`)
          .retry(2)
          .catch(() => {
            logger.info('→ Py Process was closed 😪');
          }),
      );
    }
    await Promise.all(results);

    if (this.pyProcess?.pid) {
      try {
        process.kill(this.pyProcess.pid);
      } catch {
        logger.warn('🙀 handshake-sever was already terminated.');
      }
    }
  }

  async updateRunConfig(payload: UpdateTestRunConfig) {
    logger.info(
      `📃 Updating config for this current test run with ${payload}.`,
    );
    const resp = await superagent
      .put(this.updateRunConfigUrl)
      .send(JSON.stringify(payload))
      .catch((err) => logger.error(`⚠️ Failed to update the config: ${err}`));

    if (resp) {
      logger.info(
        `Updated config ⚙️ for the test run: ${resp.text}`,
      );
    }
    return resp;
  }

  generateReport(
    resultsDir: string,
    rootDir: string,
    outDir?: string,
    maxTestRuns?: number,
    skipPatch?: boolean,
    timeout?:number,
  ): false | Error | undefined {
    if (skipPatch) {
      logger.warn('Test Results are not patched, as per request. Make sure to patch it up later.');
      return false;
    }
    const patchArgs = ['patch', resultsDir];
    if (outDir == null) {
      logger.info(`Patching the results ⛑️, passing the command ${patchArgs}`);
    }

    // for patching
    let result = this.executeCommand(patchArgs, true, rootDir, timeout) as SpawnSyncReturns<Buffer>;

    if (outDir != null && result.error == null) {
      const exportArgs = ['export', resultsDir, '--out', outDir, '-mr', (maxTestRuns ?? 100).toString()];
      logger.info(`Generating Report 📃, passing the command: ${exportArgs}`);

      result = this.executeCommand(
        exportArgs,
        true,
        process.cwd(),
        timeout,
      ) as SpawnSyncReturns<Buffer>;
      return result.error;
    }
    return result.error;
  }

  async markTestRunCompletion() {
    await superagent
      .put(`${this.url}/done`)
      .retry(3)
      .then(
        async (data) => {
          logger.info(`Marked Test Run: ${data.text} for patching.`);
        },
      ).catch((err) => logger.error(`⚠️ Failed to mark test run completion: ${err}`));
  }
}
