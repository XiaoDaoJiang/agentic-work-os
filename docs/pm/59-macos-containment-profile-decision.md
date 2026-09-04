# TECH-XP-06 — macOS LocalRunner Containment Profile Decision

> Status: **Final**  
> Date: 2026-09-04  
> Issue: #16  
> Decision: **KEEP LIMITED — `process_group` remains `compatible`; managed / escape-resistant runs are blocked**

## 1. Decision boundary

This decision answers only the macOS LocalRunner containment-profile question opened after TECH-XP-03 directly reproduced Process Group escape.

It does not rewrite historical hostile evidence and does not authorize a new Sandbox, VM/container, persistent Runtime service, Remote Runner, Session Resume or production runtime architecture.

## 2. Frozen evidence

Source evidence remains immutable:

- evidence head: `c8d011c5c6fccc71a0a389039ec2048adf6805eb`;
- hostile workflow: `33491181220`;
- macOS artifact: `9793960123`;
- actual ProcessKit mechanism: `process_group`;
- 200/200 harness runs completed;
- scenario result: 145 PASS / 55 FAIL;
- `root-exit-detached + cancel`: 50/50 FAIL;
- every detached failure observed surviving child + grandchild and a post-stop late write;
- post-evidence cleanup succeeded but does not change the recorded FAIL facts.

The direct conclusion is narrow but decisive:

```text
POSIX Process Group can own/terminate processes that remain in the group
but a descendant can escape through a new session/process group
therefore the mechanism is not escape-resistant
```

## 3. Existing capability schema already represents this result

`local-runner-capabilities-v1` uses:

```text
mechanism:
  job_object | cgroup_v2 | process_group | unproven | none

escape_resistance:
  strong | process_group | best_effort
```

The contract explicitly rejects `process_group + strong`.

`deriveSupportLevel()` returns:

```text
managed
  iff execution capabilities are present
  + whole_tree_termination
  + owner_exit_cleanup
  + membership_observable
  + escape_resistance == strong

compatible
  iff execution capabilities are present
  + whole_tree_termination
  + a proven mechanism other than unproven/none

unsupported
  otherwise
```

No schema expansion is required to express the macOS result.

## 4. Final macOS profile

For the current ProcessKit-backed macOS provider, keep:

```yaml
platform: macos
mechanism: process_group
whole_tree_termination: true
owner_exit_cleanup: false
membership_observable: true
escape_resistance: process_group
stdin: true
separate_output_streams: true
timeout: true
```

Derived support level:

```text
compatible
```

### Meaning of `whole_tree_termination: true`

This Boolean is **mechanism-scoped**, not a claim that every descendant of the original root can always be killed.

It means the provider can apply group-wide teardown to the processes still owned by that Process Group. The independent `escape_resistance: process_group` field records the proven limitation that descendants may escape that boundary by creating a new session/process group.

The frozen hostile evidence therefore remains consistent with this profile.

## 5. Scheduling consequence

### Compatible local execution

A macOS Run may be scheduled when its execution policy explicitly accepts the Process Group containment profile.

The runtime/UI must surface at least:

```text
platform = macos
mechanism = process_group
support_level = compatible
escape_resistance = process_group
owner_exit_cleanup = false
```

No hidden downgrade is allowed.

### Managed / escape-resistant execution

A Run whose policy requires strong descendant containment across process-group/session escape must be blocked on this profile.

The system must not represent macOS Process Group as `managed` or silently treat it as equivalent to Windows Job Object / Linux cgroup-v2.

Future stronger execution capabilities may satisfy that policy, but they are outside this decision.

## 6. Why no new macOS containment mechanism is selected

A focused review of supported Apple platform mechanisms did not identify a bounded public Job Object/cgroup-v2 equivalent that fits the current one-shot local Coding-Agent runner architecture.

### App Sandbox

Apple describes App Sandbox as an access-control technology that restricts access to files, network connections, hardware and other protected resources to contain damage to system/user data.

References:

- https://developer.apple.com/documentation/security/app-sandbox
- https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox

This is useful security isolation, but it is not evidence of a descendant lifecycle/whole-tree teardown primitive and Sandbox remains a separate future capability in this project.

### XPC / launchd services

Apple describes XPC services as explicit service processes managed by `launchd`, which launches them on demand, shuts them down when idle and can restart crashed services.

References:

- https://developer.apple.com/documentation/xpc
- https://developer.apple.com/documentation/xpc/creating-xpc-services

Using XPC/LaunchAgent/LaunchDaemon as the execution substrate would change the architecture from the frozen one-shot LocalRunner into a service-managed runtime. No Product/M0 evidence requires that expansion.

### Foundation `Process`

Foundation exposes process signalling APIs such as `interrupt()` / `terminate()` for a process and its subtasks.

Reference:

- https://developer.apple.com/documentation/foundation/process/interrupt()

That API does not override the direct hostile evidence that an arbitrary descendant can escape a POSIX Process Group/session boundary. No stronger escape-resistant boundary was established.

## 7. Alternatives rejected

### Mark all macOS execution unsupported

Rejected.

The existing mechanism still provides useful, observable local execution, stream handling, timeout and group-owned teardown. Discarding all of that capability would overstate the negative evidence.

### Call Process Group `managed`

Rejected.

This would directly contradict the frozen 50/50 detached-escape failures and the capability contract's prohibition on `process_group + strong`.

### Add App Sandbox / XPC / VM / container now

Rejected for M0.

These mechanisms change a different boundary or materially expand runtime architecture. They are not justified merely to make every platform appear `managed`.

### Use private/undocumented macOS process grouping APIs

Rejected.

No stable public contract was established, and relying on private platform behavior would weaken rather than strengthen the feasibility result.

## 8. Product/runtime implication

The cross-platform LocalRunner abstraction should model **capabilities**, not pretend all platforms have the same guarantees.

For M0 this means:

```text
same upper-level LocalRunner protocol
+ platform-reported actual mechanism/capabilities
+ policy-based scheduling
+ explicit downgrade/blocking
```

This decision is evidence in favor of the capability-model approach; it is not evidence that every platform can satisfy the same managed-containment policy.

## 9. Final verdict

```text
KEEP LIMITED

macOS Process Group profile:
  support = compatible
  escape resistance = process_group
  managed containment = unsupported
```

Historical Process Group failures remain immutable.

No stronger mechanism experiment is required inside the current M0 boundary unless new evidence introduces a concrete supported primitive that can plausibly survive the same frozen detached-descendant matrix.

## 10. Non-claims

This decision does **not**:

- make macOS `managed`;
- make Spike 1 PASS;
- make the Technical Gate PASS;
- authorize Sandbox implementation;
- validate a real Codex Run;
- change Product Validation;
- unlock Product MVP WWA.
