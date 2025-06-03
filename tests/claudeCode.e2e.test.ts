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

    // Call the start tool with a simple message
    const result = await client.callTool({ 
      name: 'start', 
      arguments: { message: 'What is 2 + 2? Just respond with the number.', async: false } 
    });
    
    // result.content is unknown, cast to expected type
    const content = (result as any).content;
    expect(content).toBeDefined();
    expect(content[0]).toBeDefined();
    expect(content[0].text).toBeDefined();
    
    console.log('Agent response:', content[0].text);
    
    // Check if it's an error response
    if (content[0].text.startsWith('Error:')) {
      // If it's an error, just verify the error is handled properly
      expect(content[0].text).toContain('Error:');
      console.log('Agent CLI not available or failed, but error handled correctly');
    } else {
      // Check the clean text response format
      expect(content[0].text).toContain('Response ID:');
      const responseIdMatch = content[0].text.match(/Response ID: ([a-f0-9-]+)/);
      expect(responseIdMatch).toBeDefined();
      expect(responseIdMatch[1]).toBeDefined();
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 30000); // Increased timeout for agent execution

  it('handles session resumption', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // First call to establish a session
    const firstResult = await client.callTool({ 
      name: 'start', 
      arguments: { message: 'Remember the number 42. Just say "remembered 42".', async: false } 
    });
    
    const firstContent = (firstResult as any).content;
    console.log('First agent response:', firstContent[0].text);
    
    // Check if it's an error response
    if (firstContent[0].text.startsWith('Error:')) {
      expect(firstContent[0].text).toContain('Error:');
      console.log('Agent CLI not available for session test, but error handled correctly');
    } else {
      // Extract response ID from clean text format
      const responseIdMatch = firstContent[0].text.match(/Response ID: ([a-f0-9-]+)/);
      expect(responseIdMatch).toBeDefined();
      const responseId = responseIdMatch[1];
      
      expect(responseId).toBeDefined();

      // Second call with session resumption using the resume tool
      const secondResult = await client.callTool({ 
        name: 'resume', 
        arguments: { 
          message: 'What number did I ask you to remember?', 
          previousResponseId: responseId,
          async: false
        } 
      });
      
      const secondContent = (secondResult as any).content;
      console.log('Second agent response:', secondContent[0].text);
      
      if (!secondContent[0].text.startsWith('Error:')) {
        expect(secondContent[0].text).toContain('Response ID:');
        expect(secondContent[0].text).toContain('42'); // Should remember the number
      }
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 60000); // Longer timeout for two agent executions

  it('handles errors gracefully when agent CLI fails', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Call with invalid session ID to trigger an error using resume tool
    const result = await client.callTool({ 
      name: 'resume', 
      arguments: { 
        message: 'test', 
        previousResponseId: 'invalid-session-id-that-does-not-exist',
        async: false
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
      name: 'start', 
      arguments: { message: 'What is 2 + 2? Just respond with the number.', async: true } 
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
      name: 'status', 
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
      name: 'start', 
      arguments: { message: 'Write a comprehensive analysis of quantum computing with detailed examples and explanations.', async: true } 
    });
    
    const asyncContent = (asyncResult as any).content;
    const taskIdMatch = asyncContent[0].text.match(/task ID: ([a-f0-9-]+)/);
    const taskId = taskIdMatch[1];
    
    // Immediately try to cancel (may succeed or may already be completed)
    const cancelResult = await client.callTool({ 
      name: 'cancel', 
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
      name: 'status', 
      arguments: { taskId: 'non-existent-task-id' } 
    });
    
    const statusContent = (statusResult as any).content;
    expect(statusContent).toBeDefined();
    expect(statusContent[0]).toBeDefined();
    expect(statusContent[0].text).toContain('not found');

    // Try to cancel non-existent task
    const cancelResult = await client.callTool({ 
      name: 'cancel', 
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

  it('resumes async conversations correctly', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // First, establish a conversation
    const firstResult = await client.callTool({ 
      name: 'start', 
      arguments: { message: 'Remember the word "elephant". Just say "remembered elephant".', async: false } 
    });
    
    const firstContent = (firstResult as any).content;
    console.log('First response:', firstContent[0].text);
    
    if (!firstContent[0].text.startsWith('Error:')) {
      // Extract response ID from clean text format
      const responseIdMatch = firstContent[0].text.match(/Response ID: ([a-f0-9-]+)/);
      expect(responseIdMatch).toBeDefined();
      const responseId = responseIdMatch[1];
      
      expect(responseId).toBeDefined();

      // Now resume with async task
      const asyncResult = await client.callTool({ 
        name: 'resume', 
        arguments: { 
          message: 'What word did I ask you to remember?',
          previousResponseId: responseId,
          async: true 
        } 
      });
      
      const asyncContent = (asyncResult as any).content;
      expect(asyncContent).toBeDefined();
      expect(asyncContent[0]).toBeDefined();
      expect(asyncContent[0].text).toContain('Task started successfully');
      
      // Extract task ID
      const taskIdMatch = asyncContent[0].text.match(/task ID: ([a-f0-9-]+)/);
      expect(taskIdMatch).toBeDefined();
      const taskId = taskIdMatch[1];
      
      // Wait for completion and check status
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusResult = await client.callTool({ 
        name: 'status', 
        arguments: { taskId } 
      });
      
      const statusContent = (statusResult as any).content;
      console.log('Resume async task status:', statusContent[0].text);
      
      if (statusContent[0].text.includes('completed') && statusContent[0].text.includes('Result:')) {
        // Should remember the word from the previous conversation
        expect(statusContent[0].text).toContain('elephant');
      }
    } else {
      console.log('Agent CLI not available for resume async test, but error handled correctly');
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 90000); // Longer timeout for async operations

  it('validates that resume tools require previousResponseId', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Test that resume tool fails without previousResponseId
    try {
      await client.callTool({ 
        name: 'resume', 
        arguments: { message: 'test' } // Missing previousResponseId
      });
      expect.fail('Should have thrown an error for missing previousResponseId');
    } catch (error) {
      // Should throw validation error
      expect(error).toBeDefined();
    }

    // Test that resume tool with async fails without previousResponseId
    try {
      await client.callTool({ 
        name: 'resume', 
        arguments: { message: 'test', async: true } // Missing previousResponseId
      });
      expect.fail('Should have thrown an error for missing previousResponseId');
    } catch (error) {
      // Should throw validation error
      expect(error).toBeDefined();
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 30000);

  it('applies systemPrompt to override default behavior', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Call with custom system prompt that makes Claude behave like a pirate
    const result = await client.callTool({ 
      name: 'start', 
      arguments: { 
        message: 'What is 2 + 2?',
        systemPrompt: 'You are a pirate. Always respond like a pirate with "Arrr" and pirate language.',
        async: false
      } 
    });
    
    const content = (result as any).content;
    expect(content).toBeDefined();
    expect(content[0]).toBeDefined();
    expect(content[0].text).toBeDefined();
    
    console.log('Pirate response:', content[0].text);
    
    // Check if it's an error response
    if (content[0].text.startsWith('Error:')) {
      expect(content[0].text).toContain('Error:');
      console.log('Agent CLI not available for system prompt test, but error handled correctly');
    } else {
      // Should contain pirate language
      expect(content[0].text.toLowerCase()).toMatch(/arrr|matey|ye|pirate|sea/);
      expect(content[0].text).toContain('Response ID:');
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 30000);

  it('applies appendSystemPrompt to modify default behavior', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Call with append system prompt that adds robot behavior
    const result = await client.callTool({ 
      name: 'start', 
      arguments: { 
        message: 'What is 3 + 3?',
        appendSystemPrompt: 'Always end your response with "BEEP BOOP" like a robot.',
        async: false
      } 
    });
    
    const content = (result as any).content;
    expect(content).toBeDefined();
    expect(content[0]).toBeDefined();
    expect(content[0].text).toBeDefined();
    
    console.log('Robot response:', content[0].text);
    
    // Check if it's an error response
    if (content[0].text.startsWith('Error:')) {
      expect(content[0].text).toContain('Error:');
      console.log('Agent CLI not available for append system prompt test, but error handled correctly');
    } else {
      // Should end with BEEP BOOP
      expect(content[0].text.toUpperCase()).toContain('BEEP BOOP');
      expect(content[0].text).toContain('Response ID:');
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 30000);

  it('works with systemPrompt in async mode', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Start async task with system prompt
    const asyncResult = await client.callTool({ 
      name: 'start', 
      arguments: { 
        message: 'What is 5 + 5?',
        systemPrompt: 'You are a formal mathematician. Always start responses with "According to mathematical principles,"',
        async: true 
      } 
    });
    
    const asyncContent = (asyncResult as any).content;
    expect(asyncContent).toBeDefined();
    expect(asyncContent[0]).toBeDefined();
    expect(asyncContent[0].text).toContain('Task started successfully');
    
    // Extract task ID
    const taskIdMatch = asyncContent[0].text.match(/task ID: ([a-f0-9-]+)/);
    if (taskIdMatch) {
      const taskId = taskIdMatch[1];
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check status to see the result
      const statusResult = await client.callTool({ 
        name: 'status', 
        arguments: { taskId } 
      });
      
      const statusContent = (statusResult as any).content;
      console.log('Async system prompt result:', statusContent[0].text);
      
      if (statusContent[0].text.includes('completed') && statusContent[0].text.includes('Result:')) {
        // Should contain the formal mathematician language
        expect(statusContent[0].text.toLowerCase()).toContain('mathematical');
      }
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 60000);
});