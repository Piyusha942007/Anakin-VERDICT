const colors = {
  reset: "\x1b[0m",
  info: "\x1b[36m",    // Cyan
  success: "\x1b[32m", // Green
  warn: "\x1b[33m",    // Yellow
  error: "\x1b[31m",   // Red
  debug: "\x1b[90m",   // Dark Gray
  purple: "\x1b[35m",  // Magenta for Gemini/Wire
};

export const logger = {
  info: (msg: string, ...meta: any[]) => {
    console.log(`${colors.info}[INFO] ${new Date().toISOString()} | ${msg}${colors.reset}`, ...meta);
  },
  success: (msg: string, ...meta: any[]) => {
    console.log(`${colors.success}[SUCCESS] ${new Date().toISOString()} | ${msg}${colors.reset}`, ...meta);
  },
  warn: (msg: string, ...meta: any[]) => {
    console.log(`${colors.warn}[WARN] ${new Date().toISOString()} | ${msg}${colors.reset}`, ...meta);
  },
  error: (msg: string, ...meta: any[]) => {
    console.error(`${colors.error}[ERROR] ${new Date().toISOString()} | ${msg}${colors.reset}`, ...meta);
  },
  debug: (msg: string, ...meta: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${colors.debug}[DEBUG] ${new Date().toISOString()} | ${msg}${colors.reset}`, ...meta);
    }
  },
  system: (msg: string, ...meta: any[]) => {
    console.log(`${colors.purple}[SYSTEM] ${new Date().toISOString()} | ${msg}${colors.reset}`, ...meta);
  }
};

export default logger;
