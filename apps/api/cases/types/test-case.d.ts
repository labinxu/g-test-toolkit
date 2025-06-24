import { Page } from 'puppeteer';
import { CustomLogger } from 'src/logger/logger.custom';
import { AndroidService } from 'src/mobile/android/android.service';
export declare class TestCase {
  private logger;
  private p;
  private phoneSn;
  private screenOnKeyWords;
  private screenPwd;
  private swipeCordForScreenOn;
  private androidService;
  test(): Promise<void>;
  constructor();
  setLogger(logger: CustomLogger): void;
  setPage(page: Page): void;
  page(): Page;
  print(msg: string): void;
  dumpxml(): Promise<void>;
  mobileClick(attribute: string, text: string): Promise<void>;
  configurePhone(
    sn: string,
    chkwords: string,
    passwoard: string,
    swipeCord: string,
  ): void;
  screenOn(): Promise<void>;
  setAndroidService(service: AndroidService): void;

  /// page fuction
  click(selector: string, options?: Readonly<ClickOptions>): Promise<void>;
  $<Selector extends string>(
    selector: Selector,
  ): Promise<ElementHandle<NodeFor<Selector>> | null>;

  $$<Selector extends string>(
    selector: Selector,
    options?: QueryOptions,
  ): Promise<Array<ElementHandle<NodeFor<Selector>>>>;

  $eval<
    Selector extends string,
    Params extends unknown[],
    Func extends EvaluateFuncWith<NodeFor<Selector>, Params> = EvaluateFuncWith<
      NodeFor<Selector>,
      Params
    >,
  >(
    selector: Selector,
    pageFunction: Func | string,
    ...args: Params
  ): Promise<Awaited<ReturnType<Func>>>;

  $$eval<
    Selector extends string,
    Params extends unknown[],
    Func extends EvaluateFuncWith<
      Array<NodeFor<Selector>>,
      Params
    > = EvaluateFuncWith<Array<NodeFor<Selector>>, Params>,
  >(
    selector: Selector,
    pageFunction: Func | string,
    ...args: Params
  ): Promise<Awaited<ReturnType<Func>>>;

  goto(url: string, options?: GoToOptions): Promise<HTTPResponse | null>;
  type(
    selector: string,
    text: string,
    options?: Readonly<KeyboardTypeOptions>,
  ): Promise<void>;
}
export declare function Regist(): ClassDecorator;
export declare function main(
  logger: CustomLogger,
  service?: AndroidService,
  page?: Page,
): Promise<void>;
//# sourceMappingURL=test-case.d.ts.map
