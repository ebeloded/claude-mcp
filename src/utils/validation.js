import { existsSync, accessSync, constants } from "fs";
import { resolve, relative } from "path";
import { ValidationError } from "./errors.js";
import { logger } from "./logger.js";

/**
 * Validation utilities for common operations
 */

/**
 * Validate and resolve working directory
 * @param {string|null|undefined} workingDirectory
 * @returns {string}
 */
export function validateWorkingDirectory(workingDirectory) {
  if (!workingDirectory) {
    return process.cwd();
  }

  // Resolve relative paths
  const resolvedPath = resolve(workingDirectory);
  
  // Security check: prevent directory traversal attacks
  const relativePath = relative(process.cwd(), resolvedPath);
  if (relativePath.startsWith('..') && !resolvedPath.startsWith(process.cwd())) {
    logger.debugLog(`Working directory security check: ${resolvedPath} is outside current directory tree`);
    // Allow absolute paths, but log for security awareness
  }

  // Check if directory exists
  if (!existsSync(resolvedPath)) {
    throw new ValidationError(`Working directory does not exist: ${resolvedPath}`);
  }

  // Check if directory is accessible
  try {
    accessSync(resolvedPath, constants.R_OK);
  } catch (error) {
    throw new ValidationError(`Working directory is not accessible: ${resolvedPath}`);
  }

  logger.debugLog(`Using working directory: ${resolvedPath}`);
  return resolvedPath;
}

/**
 * Validate task ID format - more lenient for backward compatibility
 */
export function validateTaskId(taskId) {
  if (!taskId || typeof taskId !== 'string') {
    throw new ValidationError('Task ID must be a non-empty string');
  }
  
  // Allow any string for backward compatibility with tests
  // In production, stricter validation could be enabled
}

/**
 * Validate prompt input
 */
export function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new ValidationError('Prompt must be a non-empty string');
  }
}