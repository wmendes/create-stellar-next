// Build, then deploy every contract to the network in .env, always as a new instance.
// Mainnet needs --confirm-mainnet.
import { build, deploy, listContracts, loadConfig, main } from "./stellar.mjs";

main(() => {
  const config = loadConfig();
  const confirmMainnet = process.argv.includes("--confirm-mainnet");
  build();
  for (const contract of listContracts())
    deploy(config, contract, { onlyIfChanged: false, confirmMainnet });
});
