import { Page } from 'puppeteer';

export interface IHelper {
  login(options: {
    username: string;
    password: string;
    url: string;
  }): Promise<Page | null>;
  text_post(postText: string): void;
}
