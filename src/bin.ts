#!/usr/bin/env node
import { confirm, isCancel, select, text } from "@clack/prompts";
import { type ConfirmFn, main, type PromptFn, type SelectFn } from "./cli.ts";

const prompt: PromptFn = async (question) => {
  const answer = await text({
    message: question.message,
    placeholder: question.placeholder,
    validate: question.validate,
  });
  return isCancel(answer) ? undefined : answer;
};

const ask: SelectFn = async (question) => {
  const answer = await select({
    message: question.message,
    options: question.options,
    initialValue: question.initialValue,
  });
  return isCancel(answer) ? undefined : answer;
};

const yesNo: ConfirmFn = async (question) => {
  const answer = await confirm({ message: question.message, initialValue: question.initialValue });
  return isCancel(answer) ? undefined : answer;
};

const result = await main(process.argv.slice(2), {
  cwd: process.cwd(),
  userAgent: process.env.npm_config_user_agent,
  isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  prompt,
  select: ask,
  confirm: yesNo,
  echo: (text) => process.stdout.write(text),
});
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
