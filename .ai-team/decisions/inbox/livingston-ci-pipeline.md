### 2025-07-19: CI pipeline uses Node 18.x with concurrency control

**By:** Livingston
**What:** Updated `.github/workflows/ci.yml` to use Node 18.x (down from 20) per team decision, and added `concurrency` group with `cancel-in-progress: true` so duplicate CI runs on the same branch cancel each other.
**Why:** Node 18 is the agreed LTS version. Concurrency control prevents wasted CI minutes when multiple pushes happen in quick succession on the same branch or PR.
