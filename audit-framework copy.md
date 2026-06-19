# Plan Audit Framework

Every plan must pass all 83 per-plan criteria before a build spec is written.
After all plans in a system are complete, the system-level gate (criterion 84) must also pass.

**One audit pass is never enough.** Resolving a flag often changes the answer to a different criterion — a data model fix opens a migration gap, a failure mode answer changes the state machine, a scope decision creates a new security boundary. The audit is a convergence loop, not a checklist.

---

## Recursive Audit Protocol

### How it works

```
PASS 1  →  audit all criteria  →  collect flags
              ↓ address every flag
PASS 2  →  re-audit all criteria with updated plan  →  collect flags
              ↓ address every flag
PASS N  →  re-audit all criteria  →  zero flags
              ↓
         CONVERGENCE — plan is audit-complete
```

### Rules

1. **Full re-audit each pass.** Do not re-check only the previously flagged criteria. Resolving a flag may create a new flag anywhere in the framework.
2. **Flag = any criterion not fully satisfied.** Partial answers, "TBD," "assumed for now," or "out of scope without justification" all count as flags.
3. **Every flag gets a resolution before the next pass.** No deferred flags. If something cannot be resolved yet, the plan is blocked until it can be.
4. **Convergence condition:** A complete pass through all 83 criteria (or 84 for system-level) produces zero flags.
5. **Minimum two passes.** Even if Pass 1 produces zero flags, run Pass 2 to confirm. A plan that passes on the first try likely wasn't audited adversarially enough.
6. **Adversarial pass at least once.** One pass must actively try to break the plan — find the case where the happy path fails, the assumption that doesn't hold, the edge case that produces bad data. If no flags surface during an adversarial pass, state that explicitly.
7. **Pass log required.** Track every pass: what was flagged, what changed, and what pass number achieved convergence. This is the evidence trail for criterion 82 (formal sign-off).

### Pass Log Format

For each plan, maintain a pass log:

```
## Pass Log — Plan [N]: [Plan Name]

### Pass 1
Flags:
- [Criterion #] — [what's missing / what's unclear]
- [Criterion #] — [what's missing / what's unclear]
Resolutions:
- [Criterion #] — [what changed in the plan]

### Pass 2
Flags:
- [Criterion #] — [what's missing / what's unclear]
Resolutions:
- [Criterion #] — [what changed in the plan]

### Pass 3 — CONVERGENCE
Zero flags. Plan is audit-complete.
```

---

## Per-Plan Criteria (83 points)

### Group 1 — Core Completeness
1. Every gap identified in the audit has a locked answer
2. Every edge case has a defined behavior
3. No open question remains that would block implementation
4. Re-audited with new answers — no new gaps found
5. Adversarial pass complete — actively tried to break the plan, all surfaced gaps resolved

### Group 2 — End-to-End Validation
6. End-to-end happy path traced — no dead ends from trigger to outcome
7. Testing strategy defined — specific inputs, expected outputs, and verification method per scenario
8. "What might break" documented for every plan that touches existing working code
9. Primary user workflow alignment confirmed — the workflow was walked through from the primary user's perspective against a real-world use case
10. "Will the primary user actually use this?" validated for every feature and every output this plan produces

### Group 3 — Operational Cost
11. Operational cost estimated for every paid external service this plan uses
12. System ROI calculated — cost vs expected time savings or value delivered

### Group 4 — Logic Correctness
13. State machine complete — all entity states, allowed transitions, and invalid transition handling defined
14. Idempotency defined for every triggerable operation — explicit answer for what happens if it runs twice
15. Boundary conditions and input validation rules defined at every system boundary
16. Feedback loop safety addressed — every "learns over time" system has a defined reset mechanism and corruption detection
17. Real-time vs batch classification explicit for every operation this plan introduces
18. Concurrency and race condition handling defined — when two operations target the same entity simultaneously, the conflict resolution strategy is explicit (last write wins, first write wins, merge, or queue)

### Group 5 — Failure Modes
19. Every failure mode classified — silent (forbidden), loud (acceptable), catastrophic (forbidden)
20. Graceful degradation defined — what the user sees when each external dependency this plan uses is down
21. High-stakes action confirmation gates defined — irreversible actions describe the consequence, not just "are you sure?"
22. "The system was wrong" recovery path defined — what happens when bad system data causes a real-world mistake

### Group 6 — Data Integrity
23. Data freshness policy — maximum age and refresh trigger defined for every data point this plan touches
24. Duplicate detection logic defined and confirmed coherent with all other plans
25. Data migration strategy for every schema change — what existing records get for new fields
26. Reversibility decision made for every destructive action — can it be undone, by whom, and how
27. Data retention and archive policy defined — soft delete vs permanent delete, retention period
28. Data quality threshold defined — when is data too incomplete or conflicted to trust, low-confidence flag behavior specified
29. Data at rest protection defined for all sensitive data this plan stores

### Group 7 — Security and Legal
30. Applicable regulatory compliance verified — legal requirements for the domain this plan operates in are identified and addressed
31. Industry-specific licensing and compliance considered — flagged if jurisdiction-specific regulations apply to this plan
32. API key rotation strategy defined — detection method and recovery steps if a key in this plan leaks
33. Access control documented — who can see what, who can edit what, at every data level this plan introduces
34. Privacy rights compliance defined — right to deletion and data portability addressed for all personal data this plan stores

### Group 8 — Scheduling and Time
35. Timezone locked for every scheduled operation this plan introduces
36. Primary user absence handling defined — behavior of every scheduled and triggered action when the primary user is unavailable

### Group 9 — Usability and Cognitive Load
37. Decision budget counted — how many decisions does this plan add to the primary user's daily load
38. Automation vs judgment split defined — which decisions this plan introduces can be automated vs must remain the user's
39. Notification priority tier assigned for every notification this plan adds — urgent, important, or informational
40. Mobile and connectivity behavior defined — does every workflow in this plan work one-handed on a phone with intermittent connection
41. Session state persistence defined — is work saved if the user is interrupted mid-workflow
42. Multi-device state sync decision made — syncs across devices, or explicitly documented as unsupported
43. Empty and null state design defined — what the user sees when a feature in this plan has no data yet
44. First-run experience defined for every major new feature — what guides the user the first time they use it
45. Speed-to-action optimization addressed — for time-sensitive features, how fast does the user get alerted

### Group 10 — Continuity and Recovery
46. Single points of failure identified — what happens to the rest of the system if each dependency this plan adds fails
47. Developer unavailability plan — what the primary user can do without developer involvement for this plan's features
48. Rollback strategy — how to revert the deploy if this plan breaks something
49. Rollforward strategy — how to fix forward when rollback is impossible because data has been written or messages have been sent
50. Backup and disaster recovery defined for every critical data store this plan writes to

### Group 11 — System Coherence
51. Rate limits defined for every outbound communication or high-frequency operation this plan introduces
52. Opt-out and consent handling defined for every outbound communication this plan sends
53. Cancellation and withdrawal workflow defined — what happens end-to-end when a user exits a committed action
54. External event handling defined — how the system records real-world events that don't enter through normal system channels
55. Implicit rule capture considered — will this plan's data surface patterns in user behavior that can become explicit system rules over time

### Group 12 — Observability
56. System-level logging defined for this plan — separate from business audit trail, for operational diagnosis by the development team
57. Background processing status contribution defined — every background task this plan adds must be represented in the processing status indicator
58. System health dashboard contribution defined — what green/yellow/red indicator this plan adds
59. API contract change detection strategy — how the team knows if a vendor changes something that breaks this plan
60. Alerting thresholds defined — for every metric this plan tracks, the threshold that triggers a notification is explicit, not just that the metric exists

### Group 13 — Performance
61. Performance degradation threshold defined — at what data volume does this plan's feature become noticeably slow
62. Caching strategy defined — which data this plan touches is stale-cacheable vs must always be fresh

### Group 14 — Trust and Confidence
63. System trust calibration defined — how the system communicates its own confidence level for this plan's outputs, especially on day one
64. Cold start strategy defined for every history-dependent feature — explicit behavior on day zero with no prior data

### Group 15 — Search and Intelligence
65. Global search indexing defined — every new data type this plan introduces is searchable
66. Failure pattern surfacing defined — logged failures have a path to becoming surfaced patterns, not just stored records
67. Analytics contribution defined — this plan's data is accounted for in the operator's analytics view

### Group 16 — Scope and Evolution
68. Scope creep guard — explicit "out of scope" section with documented reasons for exclusion
69. Mock-data-only assumptions flagged — every assumption only validated against mock data is marked for real-world validation during implementation
70. Localization scope declared — supported locales explicitly stated, no accidental locale assumptions
71. Business model change resilience — hardcoded business-model assumptions flagged with estimated cost to change
72. Vendor lock-in documented — switching cost noted for every deeply embedded external service this plan introduces
73. Time-bounded decisions flagged — decisions that depend on current pricing, API availability, or market conditions are marked with explicit review triggers
74. Dependency version strategy defined — pinned versions documented and upgrade/deprecation path specified for every library and API version this plan depends on

### Group 17 — Release Context
75. Release classification — this plan is part of which release version, explicitly stated
76. Time to value contribution — this plan's role in reaching the minimum useful system state is defined
77. Partial deployment state defined — what is visible and what is hidden before this plan's dependencies are deployed
78. Integration test coverage specified — which other plans must be integration-tested against this one before it ships

### Group 18 — Build Process
79. Test environment strategy defined — every external service this plan uses has a non-production execution path (sandbox, mock, or test mode) so the plan can be validated without burning real API credits or triggering real actions
80. Build spec complete — every task has: file to create or modify, data model change if any, and acceptance criteria
81. Deployment order documented — what must be deployed before this plan, and what depends on this plan
82. Formal sign-off criteria — every audit criterion above has evidence, not assumption
83. Primary user mental model confirmed — no step in this plan's workflow assumes technical knowledge or terminology the primary user doesn't have

---

## System-Level Gate (criterion 84)

Applied after all plans in the system are written and before any implementation begins.

**84. Cross-plan consistency audit** — no conflicts between any two plans, dependency data formats match across plan boundaries, data model is coherent across all plans, and the full system journey is traceable from the primary user's first day to their first successful outcome with no dead ends, no missing handoffs, and no contradictory behaviors.
