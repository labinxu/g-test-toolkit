declare namespace NodeJS {
  interface ProcessEnv {
    DB_HOST: string;
    DB_PORT: string;
    API_KEY: string;
    [key: string]: string | undefined;
  }
}
