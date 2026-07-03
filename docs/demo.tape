# docs/demo.tape — reproducible terminal demo GIF for the README.
#
# Regenerate:   vhs docs/demo.tape      →  writes docs/demo.gif
#
# Prereqs (once):
#   - vhs installed (https://github.com/charmbracelet/vhs).
#       Windows:  scoop install vhs      (pulls ffmpeg + ttyd)
#       macOS:    brew install vhs
#   - polypus installed and configured with at least one agent:
#       npm install -g @gaberrb/polypus  &&  polypus setup
#   - An API key in the env the recording runs in (e.g. OPENROUTER_API_KEY),
#     OR use an Ollama agent so no key/network is needed.
#   - A tiny throwaway project at ./demo-project with a src/server.ts to edit.
#     (Any small repo works — the point is to SHOW a real edit + green check.)
#
# TUNING: VHS records real time. `Sleep` does NOT wait for the command to finish —
# it just holds the recording. Run once, note how long the task actually takes,
# then set the Sleep below to (real runtime + ~2s) so the GIF captures the whole
# run without a long idle tail. Use --fast for a quicker, cheaper demo run.

Output docs/demo.gif

Require polypus

Set Shell "pwsh"
Set FontSize 15
Set Width 1100
Set Height 640
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 55ms
Set PlaybackSpeed 1.0

# --- set up off-camera so the GIF starts on a clean prompt ---
Hide
Type "cd demo-project"
Enter
Type "clear"
Enter
Show

Sleep 1s
Type "polypus run --fast 'add a GET /health route that returns {status:""ok""} to src/server.ts'"
Sleep 900ms
Enter

# Wait for the agent to plan → read → edit → run the project's checks (verify).
# ADJUST this to your real run time (see TUNING note above).
Sleep 16s

# Show the applied change so viewers see the payoff, not just the log.
Type "git --no-pager diff --stat"
Enter
Sleep 3s
