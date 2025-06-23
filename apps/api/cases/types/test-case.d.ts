import { Page } from "puppeteer";
export declare class TestCase {
    private logger;
    private page;
    test(): Promise<void>;
    constructor();
    setLogger(logger: any): void;
    setPage(page: Page): void;
    print(msg: string): void;
}
export declare function Regist(): ClassDecorator;
export declare function main(logger: any, page?: any): Promise<void>;
