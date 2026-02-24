import chalk from 'chalk';
import ora, { Ora } from 'ora';

export function info(msg: string): void {
  console.log(chalk.cyan('  ' + msg));
}

export function success(msg: string): void {
  console.log(chalk.green('  ✓ ' + msg));
}

export function warn(msg: string): void {
  console.log(chalk.yellow('  ⚠ ' + msg));
}

export function error(msg: string): void {
  console.log(chalk.red('  ✗ ' + msg));
}

export function heading(msg: string): void {
  console.log(chalk.bold.blue('\n  ' + msg + '\n'));
}

export function dim(msg: string): void {
  console.log(chalk.dim('  ' + msg));
}

export function spinner(msg: string): Ora {
  return ora({ text: msg, indent: 2 }).start();
}

export function table(rows: Array<[string, string]>): void {
  const maxKey = Math.max(...rows.map(([k]) => k.length));
  for (const [key, value] of rows) {
    console.log(chalk.dim('  ' + key.padEnd(maxKey + 2)) + value);
  }
}
