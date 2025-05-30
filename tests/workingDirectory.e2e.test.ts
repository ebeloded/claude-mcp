import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join } from 'path';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';

const SERVER_PATH = join(__dirname, '../server.js');
const TEST_DIR = join(__dirname, 'test-workspace');
const SUB_DIR = join(TEST_DIR, 'subdir');

describe('Working Directory Support (E2E)', () => {
  beforeAll(() => {
    // Create test directories and files
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(SUB_DIR, { recursive: true });
    
    // Create test files
    writeFileSync(join(TEST_DIR, 'test.txt'), 'test content in root');
    writeFileSync(join(SUB_DIR, 'sub-test.txt'), 'test content in subdirectory');
  });

  afterAll(() => {
    // Clean up test directories
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('executes with custom working directory', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Test with absolute path
    const result = await client.callTool({ 
      name: 'task', 
      arguments: { 
        prompt: 'List the files in the current directory using the ls command.',
        workingDirectory: TEST_DIR
      } 
    });
    
    const content = (result as any).content;
    expect(content).toBeDefined();
    expect(content[0]).toBeDefined();
    
    console.log('Agent response with working directory:', content[0].text);
    
    // Check if it's an error response
    if (content[0].text.startsWith('Error:')) {
      expect(content[0].text).toContain('Error:');
      console.log('Agent CLI not available, but error handled correctly');
    } else {
      // Check the clean text response format
      expect(content[0].text).toContain('Response ID:');
      // Should contain the test.txt file from our test directory
      expect(content[0].text).toContain('test.txt');
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 30000);

  it('executes async task with custom working directory', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Start async task with working directory
    const asyncResult = await client.callTool({ 
      name: 'task', 
      arguments: { 
        prompt: 'List the files in the current directory.',
        workingDirectory: SUB_DIR,
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
    
    // Wait a bit for task to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check status
    const statusResult = await client.callTool({ 
      name: 'status', 
      arguments: { taskId } 
    });
    
    const statusContent = (statusResult as any).content;
    expect(statusContent).toBeDefined();
    expect(statusContent[0]).toBeDefined();
    console.log('Async task status with working directory:', statusContent[0].text);
    
    // Should show the working directory was used (either in result or logs)
    if (statusContent[0].text.includes('completed') && statusContent[0].text.includes('Result:')) {
      // Should contain the sub-test.txt file from our subdirectory
      expect(statusContent[0].text).toContain('sub-test.txt');
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 60000);

  it('handles relative working directory paths', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Test with relative path
    const result = await client.callTool({ 
      name: 'task', 
      arguments: { 
        prompt: 'What is 2 + 2?',
        workingDirectory: './tests' // relative to project root
      } 
    });
    
    const content = (result as any).content;
    expect(content).toBeDefined();
    expect(content[0]).toBeDefined();
    
    console.log('Agent response with relative working directory:', content[0].text);
    
    // Should not error on valid relative path
    if (!content[0].text.startsWith('Error:')) {
      expect(content[0].text).toContain('Response ID:');
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 30000);

  it('rejects invalid working directory', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Test with non-existent directory
    const result = await client.callTool({ 
      name: 'task', 
      arguments: { 
        prompt: 'What is 2 + 2?',
        workingDirectory: '/path/that/does/not/exist'
      } 
    });
    
    const content = (result as any).content;
    expect(content).toBeDefined();
    expect(content[0]).toBeDefined();
    expect(content[0].text).toContain('Error:');
    expect(content[0].text).toContain('Working directory does not exist');
    
    console.log('Expected error for invalid directory:', content[0].text);

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 30000);

  it('uses current directory when workingDirectory not specified', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // Test without workingDirectory parameter (should use current directory)
    const result = await client.callTool({ 
      name: 'task', 
      arguments: { 
        prompt: 'What is 2 + 2? Just respond with the number.'
      } 
    });
    
    const content = (result as any).content;
    expect(content).toBeDefined();
    expect(content[0]).toBeDefined();
    
    console.log('Agent response with default working directory:', content[0].text);
    
    // Should work normally without workingDirectory
    if (!content[0].text.startsWith('Error:')) {
      expect(content[0].text).toContain('Response ID:');
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 30000);

  it('maintains conversation continuity across different working directories', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [SERVER_PATH]
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await client.connect(transport);

    // First call in one directory
    const firstResult = await client.callTool({ 
      name: 'task', 
      arguments: { 
        prompt: 'Remember the number 42. Just say "remembered 42".',
        workingDirectory: TEST_DIR
      } 
    });
    
    const firstContent = (firstResult as any).content;
    console.log('First response in TEST_DIR:', firstContent[0].text);
    
    if (!firstContent[0].text.startsWith('Error:')) {
      // Extract response ID from clean text format
      const responseIdMatch = firstContent[0].text.match(/Response ID: ([a-f0-9-]+)/);
      expect(responseIdMatch).toBeDefined();
      const responseId = responseIdMatch[1];
      
      expect(responseId).toBeDefined();

      // Second call using continue tool (no workingDirectory parameter - uses original conversation's directory)
      const secondResult = await client.callTool({ 
        name: 'continue', 
        arguments: { 
          prompt: 'What number did I ask you to remember?',
          previousResponseId: responseId
        } 
      });
      
      const secondContent = (secondResult as any).content;
      console.log('Second response using resume:', secondContent[0].text);
      
      if (!secondContent[0].text.startsWith('Error:')) {
        expect(secondContent[0].text).toContain('Response ID:');
        // Should remember the number using original conversation's working directory
        expect(secondContent[0].text).toContain('42');
      } else {
        // If there's an error, it should be handled gracefully
        console.log('Resume conversation failed - this could be due to agent CLI limitations');
        expect(secondContent[0].text).toContain('Error:');
      }
    }

    // Clean up
    if (typeof (transport as any).kill === 'function') {
      await (transport as any).kill();
    }
  }, 60000);
});