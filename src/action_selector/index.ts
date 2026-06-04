const ACTION_KEYS = ['A', 'B', 'C'] as const;
const ADVANCE_BUTTON_NAME = '推进';

type ActionKey = (typeof ACTION_KEYS)[number];
type ActionOptions = Partial<Record<ActionKey, string>>;

function parseActionOptionsFromStatusBlock(statusBlock: string): ActionOptions {
  const options: ActionOptions = {};
  const lines = statusBlock.split(/\r?\n/);
  let inActionArea = false;
  let currentKey: ActionKey | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!inActionArea) {
      inActionArea = line.includes('【 行动选项 】');
      continue;
    }

    if (line.includes('╘')) {
      break;
    }

    const optionMatch = line.match(/^([ABC])\s*[.．、:：]\s*(.+)$/);
    if (optionMatch) {
      currentKey = optionMatch[1] as ActionKey;
      options[currentKey] = `${currentKey}. ${optionMatch[2].trim()}`;
      continue;
    }

    if (currentKey && line && !line.startsWith('TIPS') && !line.includes('════')) {
      options[currentKey] = `${options[currentKey]} ${line}`;
    }
  }

  return options;
}

function hasActionOptions(options: ActionOptions): boolean {
  return ACTION_KEYS.some(key => Boolean(options[key]));
}

export function parseActionOptions(message: string): ActionOptions {
  const statusBlocks = [...message.matchAll(/<StatusBlocks\b[^>]*>([\s\S]*?)(?:<\/StatusBlocks>|$)/gi)].map(
    match => match[1],
  );

  for (const statusBlock of statusBlocks.reverse()) {
    const options = parseActionOptionsFromStatusBlock(statusBlock);
    if (hasActionOptions(options)) {
      return options;
    }
  }

  return {};
}

function getLatestActionOptions(): ActionOptions | undefined {
  const chatMessages = getChatMessages('0-{{lastMessageId}}');

  for (const chatMessage of [...chatMessages].reverse()) {
    const options = parseActionOptions(chatMessage.message);
    if (hasActionOptions(options)) {
      return options;
    }
  }

  return undefined;
}

async function sendAction(key: ActionKey): Promise<void> {
  const options = getLatestActionOptions();
  const option = options?.[key];

  if (!option) {
    toastr.warning(`未找到 ${key} 行动选项`);
    return;
  }

  await triggerSlash(`/send ${option} | /trigger await=true`);
}

async function continueLastMessage(): Promise<void> {
  await triggerSlash('/continue await=true');
}

function init(): void {
  replaceScriptButtons([...ACTION_KEYS, ADVANCE_BUTTON_NAME].map(name => ({ name, visible: true })));

  ACTION_KEYS.forEach(key => {
    eventOn(
      getButtonEvent(key),
      errorCatched(async () => sendAction(key)),
    );
  });

  eventOn(
    getButtonEvent(ADVANCE_BUTTON_NAME),
    errorCatched(async () => continueLastMessage()),
  );
}

$(() => {
  errorCatched(init)();
});
