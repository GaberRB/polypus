**Description:** Polypus fails to generate a response when a user sends a message. The agent appears to hang or terminate without sending any output, leaving the user with no feedback.

**Steps to Reproduce:**
1. Launch Polypus in any mode (e.g., `polypus run`).
2. Send a message to the agent (e.g., type “Hello”).
3. Observe that no response is generated or displayed.
4. Check logs – no error messages are shown.

**Expected Behavior:** The agent should produce a response, display it to the user, and update the session history accordingly.

**Actual Behavior:**
- No response is sent back to the user; the chat remains silent.
- No error message is logged, making debugging difficult.
- The session history may not be updated, causing inconsistency.

**Environment:**
- OS: Windows 10 (PowerShell)
- Polypus version: 0.2.0 (hardcoded version bug)
- No specific command; issue occurs across multiple command invocations.

**Additional Notes:**
- The bug appears after recent changes to message handling in `src/cli/commands/run.ts` and `src/core/agent/loop.ts`.
- No console errors are shown; the process continues silently.
- Reproducible on multiple machines.

**Labels:** bug, high-priority, UI