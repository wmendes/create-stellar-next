import type { Module } from "../lib/compose.ts";

/** A local network in Docker through the stock `stellar container` commands (`--local`). */
export const local: Module = {
  id: "local",
  templates: ["local"],
  scripts: {
    "network:start": {
      command: "stellar container start local",
      description:
        "Start a local network in Docker. To use it, set `NEXT_PUBLIC_STELLAR_NETWORK=local` and `NEXT_PUBLIC_STELLAR_RPC_URL=http://localhost:8000/rpc` in `.env`, then run `setup`",
    },
    "network:stop": {
      command: "stellar container stop local",
      description:
        "Stop the local network. Its state is lost: run `setup` again after the next start",
    },
  },
  next: [],
  doctor: [
    {
      id: "stellar",
      description: "Stellar CLI",
      command: "stellar",
      args: ["--version"],
      fix: "Install the Stellar CLI: https://developers.stellar.org/docs/tools/cli/install-cli",
    },
    {
      id: "docker",
      description: "Docker, running (for the local network)",
      command: "docker",
      args: ["info", "--format", "{{.ServerVersion}}"],
      fix: "Install Docker and start it: https://docs.docker.com/get-started/get-docker/",
    },
  ],
};
