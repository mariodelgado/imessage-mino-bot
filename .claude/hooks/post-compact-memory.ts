import { stdin } from 'process';

interface PostToolUseInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: string;
}

interface HookOutput {
  result: 'continue' | 'block';
  message?: string;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk) => (data += chunk));
    stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const input: PostToolUseInput = JSON.parse(await readStdin());

  // Only trigger after compaction (the Compact tool)
  if (input.tool_name !== 'Compact') {
    const output: HookOutput = { result: 'continue' };
    console.log(JSON.stringify(output));
    return;
  }

  // After compaction, inject a reminder to recall memory
  // The actual memvid search will be done by Claude using the MCP tool
  const output: HookOutput = {
    result: 'continue',
    message: `<memory-recall>
Context was just compacted. To restore relevant project knowledge, consider searching memvid:

1. Search for context about current work:
   mcp__memvid__search_memory({ query: "current task or feature being worked on" })

2. Get broader project context:
   mcp__memvid__get_context({ query: "project architecture and key patterns" })

Memory banks available: Use mcp__memvid__list_memory_banks() to see what's indexed.
</memory-recall>`
  };

  console.log(JSON.stringify(output));
}

main().catch((err) => {
  console.error('Hook error:', err);
  process.exit(1);
});
