/**
 * Production-aware logger utility
 *
 * - log/debug/info: Only in development mode
 * - warn: Only in development mode (or can be enabled for production)
 * - error: Always logs (errors should always be visible)
 */

const isDevelopment = import.meta.env.DEV;

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

function createLogger(prefix?: string): Logger {
  const formatArgs = (args: unknown[]): unknown[] => {
    if (prefix) {
      return [`[${prefix}]`, ...args];
    }
    return args;
  };

  return {
    debug: (...args: unknown[]) => {
      if (isDevelopment) {
        console.debug(...formatArgs(args));
      }
    },
    info: (...args: unknown[]) => {
      if (isDevelopment) {
        console.info(...formatArgs(args));
      }
    },
    log: (...args: unknown[]) => {
      if (isDevelopment) {
        console.log(...formatArgs(args));
      }
    },
    warn: (...args: unknown[]) => {
      if (isDevelopment) {
        console.warn(...formatArgs(args));
      }
    },
    error: (...args: unknown[]) => {
      // Errors always log in production
      console.error(...formatArgs(args));
    },
  };
}

// Default logger without prefix
export const logger = createLogger();

// Named loggers for specific modules
export const storageLogger = createLogger('CoffeeBIM Storage');
export const ifcLogger = createLogger('IFC');
export const placementLogger = createLogger('Placement');

// Factory for custom loggers
export { createLogger };
