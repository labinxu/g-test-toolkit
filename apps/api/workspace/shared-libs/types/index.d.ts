export declare class CustomLogger {
  private readonly winstonLogger;
  private readonly loggerGateway;
  private logger;
  private context;
  private clientId;
  constructor(
    winstonLogger: winston.Logger,
    loggerGateway: LoggerGateway,
    clientId?: string,
  );
  format(level: string, message: string): string;
  setContext(context: string): void;
  addLogFileTransports(
    filename: string,
  ): winston.transports.FileTransportInstance;
  removeLogFileTransports(
    transport: winston.transports.FileTransportInstance,
  ): void;
  sendTo(clientId: string, msg: string, tag: string): void;
  info(message: string, tag?: string): void;
  error(message: string, tag?: string): void;
  warn(message: string, tag?: string): void;
  debug(message: string, tag?: string): void;
  verbose(message: string, tag?: string): void;
  complete(): void;
}

//# sourceMappingURL=logger.custom.d.ts.map

export declare class BrowserHelper {
  private broweres;
  newBrowser({
    logger,
    headless,
    timeout = 60000,
    domain,
    retry,
  }: {
    logger: any;
    headless: boolean;
    timeout: number;
    domain?: string;
    retry?: number;
  }): Promise<{
    bs: Browser;
    page: import('puppeteer').Page;
  }>;
  close(): Promise<void>;
}
//# sourceMappingURL=browser-helper.d.ts.map
