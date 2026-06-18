import pc from "picocolors";
import { scaffoldPoly } from "../../core/scaffold/init.js";
import { getLocale, t } from "../../core/i18n/index.js";

export interface InitOptions {
  force?: boolean;
}

/** `polypus init` — scaffold a `.poly/` workspace in the current directory. */
export async function init(opts: InitOptions): Promise<void> {
  const { created, skipped } = await scaffoldPoly(process.cwd(), {
    force: Boolean(opts.force),
    locale: getLocale(),
  });

  if (created.length === 0) {
    console.log(pc.yellow(t("init.allExist")));
    for (const f of skipped) console.log(pc.dim(`  ${f}`));
    console.log(pc.dim(t("init.forceHint")));
    return;
  }

  console.log(pc.green(t("init.created")));
  for (const f of created) console.log(pc.dim(`  ${f}`));
  if (skipped.length > 0) {
    console.log(pc.dim(t("init.skipped")));
    for (const f of skipped) console.log(pc.dim(`  ${f}`));
  }
  console.log("\n" + t("init.tip"));
}
