import { sectorWatchUrl } from './sector-invite-urls.js';

export type SlashCommandContext = {
  gameId: string;
  /** When false, spectate share still returns the URL but notes the gallery may be closed. */
  allowSpectate: boolean;
};

export type SlashCommandResult =
  | { kind: 'reply'; text: string; copyText?: string }
  | { kind: 'error'; text: string };

export type SlashCommand = {
  name: string;
  aliases?: readonly string[];
  summary: string;
  /** If true, may run even when table free-text is restricted (rated active play). */
  localOnly: boolean;
  run: (ctx: SlashCommandContext, args: string) => SlashCommandResult;
};

const HELP_SUMMARY = 'List local Subspace commands';

function spectateReply(ctx: SlashCommandContext): SlashCommandResult {
  const url = sectorWatchUrl(ctx.gameId);
  if (!ctx.allowSpectate) {
    return {
      kind: 'reply',
      text: `Spectator gallery is closed for this sector. Link (if reopened): ${url}`,
      copyText: url,
    };
  }
  return {
    kind: 'reply',
    text: `Spectator link: ${url}`,
    copyText: url,
  };
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    name: 'help',
    aliases: ['commands', '?'],
    summary: HELP_SUMMARY,
    localOnly: true,
    run: () => ({
      kind: 'reply',
      text: formatHelp(),
    }),
  },
  {
    name: 'spectate',
    aliases: ['spectator', 'watch'],
    summary: 'Show (and copy) the public spectator link for this sector',
    localOnly: true,
    run: (ctx) => spectateReply(ctx),
  },
];

function formatHelp(): string {
  const lines = SLASH_COMMANDS.map((cmd) => {
    const names = [cmd.name, ...(cmd.aliases ?? [])]
      .map((n) => `/${n}`)
      .join(', ');
    return `${names} — ${cmd.summary}`;
  });
  return `Local commands (not transmitted):\n${lines.join('\n')}`;
}

function findCommand(name: string): SlashCommand | undefined {
  const key = name.toLowerCase();
  return SLASH_COMMANDS.find(
    (cmd) =>
      cmd.name === key ||
      (cmd.aliases?.some((alias) => alias.toLowerCase() === key) ?? false)
  );
}

/**
 * Parse a Subspace composer line. Returns null when the line is ordinary text
 * (does not start with `/`).
 */
export function parseSlashCommand(
  raw: string
): { name: string; args: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }
  const body = trimmed.slice(1).trim();
  if (!body) {
    return { name: 'help', args: '' };
  }
  const space = body.search(/\s/);
  if (space < 0) {
    return { name: body.toLowerCase(), args: '' };
  }
  return {
    name: body.slice(0, space).toLowerCase(),
    args: body.slice(space + 1).trim(),
  };
}

export function runSlashCommand(
  raw: string,
  ctx: SlashCommandContext
): SlashCommandResult | null {
  const parsed = parseSlashCommand(raw);
  if (!parsed) {
    return null;
  }
  const command = findCommand(parsed.name);
  if (!command) {
    return {
      kind: 'error',
      text: `Unknown command /${parsed.name}. Try /help.`,
    };
  }
  return command.run(ctx, parsed.args);
}
