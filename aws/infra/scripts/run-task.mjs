// Runs one of the demo's one-off tasks and waits for it (toreview §133):
//   pnpm --filter @nextkin/infra task db-roles   create the database roles (once, on a new database)
//   pnpm --filter @nextkin/infra task migrate    apply aws/migrations as the owner role
//   pnpm --filter @nextkin/infra task seed       reference data, demo accounts and personas
//   pnpm --filter @nextkin/infra task seed-reference   prompts, routing and other reference rows only;
//                                                 the demo's accounts are left as they are (toreview §160)
// And pauses the demo between demos (owner, 2026-10-24), which stops the Fargate and public-IP
// charges; the load balancer, secrets and database storage keep billing, and Aurora idles at zero:
//   pnpm --filter @nextkin/infra task pause      every service to 0 tasks
//   pnpm --filter @nextkin/infra task resume     back to 1 each, waiting until they are healthy
// A `cdk deploy` also resumes, because the stack sets one task per service.
// Uses the `nextkin` CLI profile unless AWS_PROFILE says otherwise. Logs: /nextkin-demo/<name>.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TASKS = { 'db-roles': 'DbRolesTask', migrate: 'MigrateTask', seed: 'SeedTask', 'seed-reference': 'SeedTask' };
// The seed container's command passes `$SEED_ARGS` on to seed.mjs.
const ARGS = { 'seed-reference': '--reference-only' };
// Support (Valkey, Mailpit) and ClamAV first, so web and worker find them when they start.
const SERVICES = ['support', 'clamav', 'latex', 'links', 'web', 'worker'].map((s) => `nextkin-demo-${s}`);
const name = process.argv[2];
if (!(name in TASKS) && name !== 'pause' && name !== 'resume') {
  console.error(`Usage: task <${[...Object.keys(TASKS), 'pause', 'resume'].join('|')}>`);
  process.exit(2);
}
const profile = process.env.AWS_PROFILE ?? 'nextkin';

function aws(...args) {
  const result = spawnSync('aws', [...args, '--profile', profile, '--region', 'us-east-1', '--output', 'json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.error?.message);
    process.exit(1);
  }
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

const stack = aws('cloudformation', 'describe-stacks', '--stack-name', 'NextkinDemo').Stacks[0];
const outputs = Object.fromEntries(stack.Outputs.map((o) => [o.OutputKey, o.OutputValue]));

if (name === 'pause' || name === 'resume') {
  const count = name === 'pause' ? '0' : '1';
  for (const service of SERVICES) {
    aws('ecs', 'update-service', '--cluster', outputs.ClusterName, '--service', service, '--desired-count', count);
    console.log(`${service}: ${count} task${count === '1' ? '' : 's'}`);
  }
  if (name === 'pause') {
    console.log('Paused. The app answers 503 until `task resume`.');
    process.exit(0);
  }
  console.log('Waiting for the services to start (2–4 minutes)…');
  aws('ecs', 'wait', 'services-stable', '--cluster', outputs.ClusterName, '--services', ...SERVICES);
  console.log(`Resumed: ${outputs.AppUrl}`);
  console.log('ClamAV keeps loading its signatures for a few minutes more; uploads wait on it.');
  process.exit(0);
}

function overridesFile(args) {
  const file = join(tmpdir(), 'nextkin-task-overrides.json');
  writeFileSync(file, JSON.stringify({ containerOverrides: [{ name: 'seed', environment: [{ name: 'SEED_ARGS', value: args }] }] }));
  return `file://${file}`;
}

const network = `awsvpcConfiguration={subnets=[${outputs.Subnets}],securityGroups=[${outputs.AppSecurityGroup}],assignPublicIp=ENABLED}`;
const started = aws(
  'ecs', 'run-task',
  '--cluster', outputs.ClusterName,
  '--task-definition', outputs[TASKS[name]],
  '--launch-type', 'FARGATE',
  '--network-configuration', network,
  ...(ARGS[name] ? ['--overrides', overridesFile(ARGS[name])] : []),
);
const task = started.tasks?.[0];
if (!task) {
  console.error('run-task started nothing:', JSON.stringify(started.failures));
  process.exit(1);
}
console.log(`${name}: started ${task.taskArn.split('/').pop()}; waiting for it to finish…`);

aws('ecs', 'wait', 'tasks-stopped', '--cluster', outputs.ClusterName, '--tasks', task.taskArn);
const done = aws('ecs', 'describe-tasks', '--cluster', outputs.ClusterName, '--tasks', task.taskArn).tasks[0];
const container = done.containers[0];
const code = container.exitCode;
console.log(`${name}: exit ${code ?? 'none'}${done.stoppedReason ? ` (${done.stoppedReason})` : ''}`);
console.log(`logs: aws logs tail /nextkin-demo/${name.replace('-reference', '')} --profile ${profile} --region us-east-1`);
process.exit(code === 0 ? 0 : 1);
