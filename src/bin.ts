#!/usr/bin/env node
import { main } from "./cli.ts";

const result = await main(process.argv.slice(2), {
  cwd: process.cwd(),
  userAgent: process.env.npm_config_user_agent,
});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
