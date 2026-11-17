#!/usr/bin/env node
import { main } from "./cli.ts";

const result = await main(process.argv.slice(2));
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
