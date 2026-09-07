#!/usr/bin/env node

import fs from "node:fs";

export function validatePreflight(summary) {
  if (summary.actual_mechanism !== "cgroup_v2") {
    throw new Error(
      `CgroupV2PreconditionError: expected cgroup_v2, got ${summary.actual_mechanism}`,
    );
  }

  return {
    actual_mechanism: summary.actual_mechanism,
    physical_verdict: summary.physical_verdict,
    survivor_count: (summary.survivor_pids ?? []).length,
    observed_late_write: Boolean(summary.observed_late_write),
    stdout_drained: Boolean(summary.stdout_drained),
    stderr_drained: Boolean(summary.stderr_drained),
  };
}

export function validateMatrix(summary) {
  if (summary.run_count !== 200) {
    throw new Error(
      `FrozenMatrixError: expected 200 runs, got ${summary.run_count}`,
    );
  }

  if (summary.harness_status !== "PASS") {
    throw new Error(
      `FrozenMatrixError: harness status is ${summary.harness_status}`,
    );
  }

  const mechanisms = summary.actual_mechanisms ?? [];
  if (mechanisms.length !== 1 || mechanisms[0] !== "cgroup_v2") {
    throw new Error(
      `CgroupV2PreconditionError: matrix mechanisms=${JSON.stringify(mechanisms)}`,
    );
  }

  return {
    run_count: summary.run_count,
    harness_status: summary.harness_status,
    actual_mechanisms: mechanisms,
    scenario_verdict_counts: summary.scenario_verdict_counts,
  };
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function main(argv) {
  const [mode, path] = argv;
  if (!mode || !path || !["preflight", "matrix"].includes(mode)) {
    throw new Error(
      "Usage: validate-cgroup-v2-evidence.mjs <preflight|matrix> <json-path>",
    );
  }

  const summary = readJson(path);
  const result =
    mode === "preflight"
      ? validatePreflight(summary)
      : validateMatrix(summary);

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const isMain =
  process.argv[1] &&
  new URL(import.meta.url).pathname === new URL(`file://${process.argv[1]}`).pathname;

if (isMain) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
