// Regenerate the typed clients in packages/ from the built contracts. Never edit packages/ by hand.
import { bindings, listContracts, main } from "./stellar.mjs";

main(() => {
  for (const contract of listContracts()) bindings(contract);
});
