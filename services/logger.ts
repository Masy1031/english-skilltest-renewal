export const Logger = {
  init: () => {
    if (typeof window !== 'undefined') {
      window.onerror = (message, source, lineno, colno, error) => {
        Logger.error("Global Uncaught Error", { message, source, lineno, colno, error });
      };

      window.onunhandledrejection = (event) => {
        Logger.error("Global Unhandled Rejection", { reason: event.reason });
      };
      
      Logger.info("Logger initialized");
    }
  },

  info: (message: string, data?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '');
    // In a real app, this would send data to a monitoring service like Sentry
  }
};