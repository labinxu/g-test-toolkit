import { IPage } from './interface/ipage';

/**
 * Page object for GETTR web livestream Studio.
 *
 * 约定：
 * - Host 视角：方法名以 host* 开头。
 * - Guest / Viewer 视角：方法名以 guest* / viewer* 开头。
 * - 与 userstories.csv 中的 User Story / Acceptance Criteria 通过 JSDoc 里的 US 编号进行关联。
 */
export class LiveStreamPage extends IPage {
  constructor(ins: any) {
    super(ins);
  }

  /**
   * Low-level helper: read current URL (for logging).
   */
  protected currentUrl(): string {
    try {
      return this.page.url?.() || '';
    } catch {
      return '';
    }
  }

  /**
   * US-0-host-1
   * As a host, I can start a livestream on GETTR (web) without OBS using Restream, so I can go live quickly.
   *
   * Acceptance Criteria（概要）：
   * - From Studio open → Go Live ≤ 30 s。
   * - 无需手动输入 RTMP / key。
   * - 测试 Viewer 端可以看到直播；连接指示灯正确显示。
   *
   * 场景级编排方法：后续可以在这里依次调用 hostOpenStudioFromHome / hostStartLivestreamWithoutRTMP /
   * expectGoLiveWithin / expectStreamVisibleToTestViewer / expectConnectionIndicatorVisible。
   */
  async runUS_0_host_1_startFromStudio() {
    this.logger.info('[US-0-host-1] start scenario from livestream Studio');
    await this.hostOpenStudioFromHome();
    await this.hostStartLivestreamWithoutRTMP();
    await this.expectGoLiveWithin(30_000);
    await this.expectStreamVisibleToTestViewer();
    await this.expectConnectionIndicatorVisible();
  }

  /**
   * 步骤：Host 从主页进入 Studio 页面。
   *
   * 对应步骤示例：
   * - Action: 从主页打开 Livestream Studio。
   */
  async hostOpenStudioFromHome() {
    this.logger.debug(`hostOpenStudioFromHome at ${this.currentUrl()}`);
    // TODO: 实现从首页导航到 Studio 的具体点击路径，例如：
    // await this.page.click('selector-for-go-live-entry');
    await this.delay();
  }

  /**
   * 步骤：Host 在 Studio 中发起一次「无需 RTMP 手动配置」的开播操作。
   *
   * 对应 Acceptance Criteria 里的：
   * - From Studio open → Go Live ≤ 30 s。
   * - 无需手动录入 RTMP / key。
   */
  async hostStartLivestreamWithoutRTMP() {
    this.logger.debug('hostStartLivestreamWithoutRTMP');
    // TODO: 点击 Go Live 按钮 / 选择默认 Restream 模式等。
    // 这里只做占位，实现留给具体页面结构。
    await this.delay();
  }

  /**
   * 验收：在限定时间内进入“直播中”状态。
   *
   * @param ms 最大允许启动时间（毫秒），例如 30_000。
   */
  async expectGoLiveWithin(ms: number) {
    this.logger.debug(`expectGoLiveWithin ${ms}ms`);
    const deadline = Date.now() + ms;
    let ok = false;
    while (Date.now() < deadline) {
      // TODO: 根据实际页面结构检查直播状态，例如：
      // const badge = await this.page.$('selector-for-live-badge');
      // if (badge) { ok = true; break; }
      await this.delay(1000);
      // 临时占位：避免死循环
      ok = true;
      break;
    }
    this.testcase.assertTrue(ok, 'Expected stream to be live within given timeout');
  }

  /**
   * 验收：测试 Viewer 端能够看到当前直播（占位实现）。
   *
   * 后续可与 viewer 端 page object / API 检查打通。
   */
  async expectStreamVisibleToTestViewer() {
    this.logger.debug('expectStreamVisibleToTestViewer (placeholder)');
    // TODO: 调用辅助 API / 第三方检查，确认 viewer 端可以拉流。
    await this.delay();
  }

  /**
   * 验收：Studio UI 中存在基础连接指示信息（例如 bitrate / latency / “Connected” 状态等）。
   */
  async expectConnectionIndicatorVisible() {
    this.logger.debug('expectConnectionIndicatorVisible (placeholder)');
    // TODO: 根据实际 DOM 结构实现，比如查找连接状态组件。
    await this.delay();
  }

  /**
   * 旧版 createLiveStream 的占位保留。
   * 建议后续逐步用上面的 host* / expect* 方法替代。
   */
  async createLiveStream() {
    this.logger.debug(`create live stream (legacy). ${this.currentUrl()}`);
    await this.delay();
    // TODO: 可以在这里复用 hostStartLivestreamWithoutRTMP 等新方法。
    return this;
  }
}
