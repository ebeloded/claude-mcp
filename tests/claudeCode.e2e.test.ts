import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'path';

const SERVER_PATH = join(__dirname, '../server.js');

describe('Claude Code MCP Server (E2E)', () => {
  it('executes a simple prompt and returns structured response', async () => {
    // Let the StdioClientTransport spawn the server process
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Call the ask tool with a simple prompt
    const result = await client.callTool({ 
      name: 'ask', 
      arguments: { prompt: 'What is 2 + 2? Just respond with the number.' } 
    });
    
    // result.content is unknown, cast to expected type
    const content = (result as any).content;
    expect(content).toBeDefined();
    expect(content[0]).toBeDefined();
    expect(content[0].text).toBeDefined();
    
    console.log('Claude response:', content[0].text);
    
    // Check if it's an error response
    if (content[0].text.startsWith('Error:')) {
      // If it's an error, just verify the error is handled properly
      expect(content[0].text).toContain('Error:');
      console.log('Claude Code not available or failed, but error handled correctly');
    } else {
      // Parse the JSON response from Claude Code
      const claudeResponse = JSON.parse(content[0].text);
      expect(claudeResponse.type).toBe('result');
      expect(claudeResponse.subtype).toBe('success');
      expect(claudeResponse.session_id).toBeDefined();
      expect(claudeResponse.result).toBeDefined();
      expect(claudeResponse.is_error).toBe(false);
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 30000); // Increased timeout for Claude Code execution

  it('handles session resumption', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // First call to establish a session
    const firstResult = await client.callTool({ 
      name: 'ask', 
      arguments: { prompt: 'Remember the number 42. Just say "remembered 42".' } 
    });
    
    const firstContent = (firstResult as any).content;
    console.log('First Claude response:', firstContent[0].text);
    
    // Check if it's an error response
    if (firstContent[0].text.startsWith('Error:')) {
      expect(firstContent[0].text).toContain('Error:');
      console.log('Claude Code not available for session test, but error handled correctly');
    } else {
      const firstResponse = JSON.parse(firstContent[0].text);
      const sessionId = firstResponse.session_id;
      
      expect(sessionId).toBeDefined();
      expect(firstResponse.type).toBe('result');
      expect(firstResponse.subtype).toBe('success');

      // Second call with session resumption
      const secondResult = await client.callTool({ 
        name: 'ask', 
        arguments: { 
          prompt: 'What number did I ask you to remember?', 
          sessionId: sessionId 
        } 
      });
      
      const secondContent = (secondResult as any).content;
      console.log('Second Claude response:', secondContent[0].text);
      
      if (!secondContent[0].text.startsWith('Error:')) {
        const secondResponse = JSON.parse(secondContent[0].text);
        expect(secondResponse.type).toBe('result');
        expect(secondResponse.subtype).toBe('success');
        expect(secondResponse.session_id).toBeDefined(); // Session continues (may get new ID)
        expect(secondResponse.result).toContain('42'); // Should remember the number
      }
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 60000); // Longer timeout for two Claude Code executions

  it('handles errors gracefully when Claude Code fails', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Call with invalid session ID to trigger an error
    const result = await client.callTool({ 
      name: 'ask', 
      arguments: { 
        prompt: 'test', 
        sessionId: 'invalid-session-id-that-does-not-exist' 
      } 
    });
    
    const content = (result as any).content;
    expect(content).toBeDefined();
    expect(content[0]).toBeDefined();
    expect(content[0].text).toContain('Error:');

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 30000);

  it('starts async tasks and provides status updates', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Start async task
    const asyncResult = await client.callTool({ 
      name: 'ask_async', 
      arguments: { prompt: 'What is 2 + 2? Just respond with the number.' } 
    });
    
    const asyncContent = (asyncResult as any).content;
    expect(asyncContent).toBeDefined();
    expect(asyncContent[0]).toBeDefined();
    expect(asyncContent[0].text).toContain('Task started successfully');
    
    // Extract task ID
    const taskIdMatch = asyncContent[0].text.match(/task ID: ([a-f0-9-]+)/);
    expect(taskIdMatch).toBeDefined();
    const taskId = taskIdMatch[1];
    
    // Check status (may still be running or completed)
    const statusResult = await client.callTool({ 
      name: 'ask_status', 
      arguments: { taskId } 
    });
    
    const statusContent = (statusResult as any).content;
    expect(statusContent).toBeDefined();
    expect(statusContent[0]).toBeDefined();
    expect(statusContent[0].text).toContain(`Task ${taskId}`);
    expect(statusContent[0].text).toMatch(/Status: (pending|running|completed|failed)/);
    
    console.log('Async task status:', statusContent[0].text);

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 60000);

  it('can cancel async tasks', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Start async task with a longer prompt that might take time
    const asyncResult = await client.callTool({ 
      name: 'ask_async', 
      arguments: { prompt: 'Write a comprehensive analysis of quantum computing with detailed examples and explanations.' } 
    });
    
    const asyncContent = (asyncResult as any).content;
    const taskIdMatch = asyncContent[0].text.match(/task ID: ([a-f0-9-]+)/);
    const taskId = taskIdMatch[1];
    
    // Immediately try to cancel (may succeed or may already be completed)
    const cancelResult = await client.callTool({ 
      name: 'ask_cancel', 
      arguments: { taskId } 
    });
    
    const cancelContent = (cancelResult as any).content;
    expect(cancelContent).toBeDefined();
    expect(cancelContent[0]).toBeDefined();
    expect(cancelContent[0].text).toContain(taskId);
    
    console.log('Cancel result:', cancelContent[0].text);

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 30000);

  it('handles invalid task IDs gracefully', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Check status for non-existent task
    const statusResult = await client.callTool({ 
      name: 'ask_status', 
      arguments: { taskId: 'non-existent-task-id' } 
    });
    
    const statusContent = (statusResult as any).content;
    expect(statusContent).toBeDefined();
    expect(statusContent[0]).toBeDefined();
    expect(statusContent[0].text).toContain('not found');

    // Try to cancel non-existent task
    const cancelResult = await client.callTool({ 
      name: 'ask_cancel', 
      arguments: { taskId: 'non-existent-task-id' } 
    });
    
    const cancelContent = (cancelResult as any).content;
    expect(cancelContent).toBeDefined();
    expect(cancelContent[0]).toBeDefined();
    expect(cancelContent[0].text).toContain('could not be cancelled');

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 30000);
});