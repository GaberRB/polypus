import { runWizard } from "../../ui/wizard.js";

/** `polypus setup` — interactive onboarding wizard. */
export async function setup(): Promise<void> {
  await runWizard();
}
