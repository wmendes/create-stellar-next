// Identity, build, deploy and client generation in one pass. Safe to run again:
// unchanged contracts are not redeployed. Add --confirm-mainnet only for a mainnet deploy the user asked for.
import {
  bindings,
  build,
  deploy,
  ensureIdentity,
  listContracts,
  loadConfig,
  main,
} from "./stellar.mjs";

main(() => {
  const config = loadConfig();
  const confirmMainnet = process.argv.includes("--confirm-mainnet");
  ensureIdentity(config);
  build();
  for (const contract of listContracts()) {
    deploy(config, contract, { onlyIfChanged: true, confirmMainnet });
    bindings(contract);
  }
  console.log(`\n✓ Setup done on ${config.network}. Start the app with the dev script.`);
});
