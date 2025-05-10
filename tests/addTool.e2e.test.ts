import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'path';

const SERVER_PATH = join(__dirname, '../dist/server.js');

describe('add tool (E2E)', () => {
  it('returns the sum of a and b via client', async () => {
    // Let the StdioClientTransport spawn the server process
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Call the add tool
    const result = await client.callTool({ name: 'add', arguments: { a: 2, b: 3 } });
    // result.content is unknown, cast to expected type
    const content = (result as any).content;
    expect(content[0].text).toBe('5');

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 5000);
});
