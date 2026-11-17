#!/usr/bin/env node
import { isCancel, text } from "@clack/prompts";
import { main, type PromptFn } from "./cli.ts";

const prompt: PromptFn = async (question) => {
  const answer = await text({
    message: question.message,
    placeholder: question.placeholder,
    validate: question.validate,
  });
  return isCancel(answer) ? undefined : answer;
};

const result = await main(process.argv.slice(2), {
  cwd: process.cwd(),
  userAgent: process.env.npm_config_user_agent,
  isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  prompt,
  echo: (text) => process.stdout.write(text),
});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
