export type ActionParamDef = {
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
};

export type StepCheckRuleType =
  | 'element-visible'
  | 'element-hidden'
  | 'url-contains'
  | 'url-equals';

export type StepCheckRule = {
  type: StepCheckRuleType;
  locator?: string;
  expectedUrl?: string;
  timeoutMs?: number;
};

export type CallStepDef = {
  targetActionKey: string;
  args?: string[];
  sortOrder?: number;
};

export type PageActionDef = {
  key: string;
  label: string;
  method: string;
  kind: 'action' | 'assert' | 'call';
  actionType?: 'click' | 'input' | 'drag';
  params?: ActionParamDef[];
  defaultExpected?: string;
  locator?: string;
  returnTarget?: string;
  callSteps?: CallStepDef[];
};

export type PageDef = {
  key: string;
  label: string;
  module: string;
  className: string;
  varName: string;
  actions: PageActionDef[];
};

export type ActionCatalog = {
  platform: string;
  pages: PageDef[];
};

export type StepBindingV1 = {
  ver: 1;
  platform: string;
  pageKey: string;
  actionKey: string;
  args?: { name: string; value: string }[];
  checkRule?: StepCheckRule;
};

export const GETTR_WEB_ACTION_CATALOG: ActionCatalog = {
  platform: 'gettr-web',
  pages: [
    {
      key: 'home',
      label: '首页（Web）',
      module: 'gettr-web-lib',
      className: 'HomePage',
      varName: 'home',
      actions: [
        {
          key: 'gotoLoginPage',
          label: '从首页进入登录页',
          method: 'gotoLoginPage',
          kind: 'action',
          defaultExpected: '进入登录页面',
        },
        {
          key: 'gotoSignUpPage',
          label: '从首页进入注册页',
          method: 'gotoSignUpPage',
          kind: 'action',
          defaultExpected: '进入注册页面',
        },
        {
          key: 'gotoProfilePage',
          label: '从首页进入个人主页',
          method: 'gotoProfilePage',
          kind: 'action',
          defaultExpected: '打开个人主页页面',
        },
        {
          key: 'post',
          label: '从首页发帖',
          method: 'post',
          kind: 'action',
          params: [
            {
              name: 'text',
              type: 'string',
              placeholder: '帖子内容，例如：Hello GETTR',
              required: true,
            },
          ],
          defaultExpected: '帖子发送成功并出现在时间线中',
        },
      ],
    },
    {
      key: 'login',
      label: '登录页（Web）',
      module: 'gettr-web-lib',
      className: 'LoginPage',
      varName: 'login',
      actions: [
        {
          key: 'loginWithPassword',
          label: '使用账号密码登录',
          method: 'loginWithPassword',
          kind: 'action',
          params: [
            {
              name: 'username',
              type: 'string',
              placeholder: '用户名或邮箱',
              required: true,
            },
            {
              name: 'password',
              type: 'string',
              placeholder: '登录密码',
              required: true,
            },
          ],
          defaultExpected: '登录成功并进入首页',
        },
        {
          key: 'post',
          label: '校验登录后发帖提示',
          method: 'post',
          kind: 'assert',
          params: [
            {
              name: 'text',
              type: 'string',
              placeholder: '用于触发提示的帖子内容',
              required: true,
            },
          ],
          defaultExpected: '出现“Your post was sent.”提示',
        },
        {
          key: 'gotoLiveStreamPage',
          label: '从首页入口进入直播 Studio',
          method: 'gotoLiveStreamPage',
          kind: 'action',
          defaultExpected: '打开直播 Studio 页面',
        },
      ],
    },
    {
      key: 'live-stream',
      label: '直播 Studio（Web）',
      module: 'gettr-web-lib',
      className: 'LiveStreamPage',
      varName: 'live',
      actions: [
        {
          key: 'runUS_0_host_1_startFromStudio',
          label: 'US-0-host-1：从 Studio 开始整条链路',
          method: 'runUS_0_host_1_startFromStudio',
          kind: 'action',
          defaultExpected: '整条直播链路按验收标准运行通过',
        },
        {
          key: 'hostOpenStudioFromHome',
          label: '主播：从首页进入 Studio',
          method: 'hostOpenStudioFromHome',
          kind: 'action',
          defaultExpected: '成功进入直播 Studio 页面',
        },
        {
          key: 'hostStartLivestreamWithoutRTMP',
          label: '主播：在 Studio 中一键开播（无需手动 RTMP）',
          method: 'hostStartLivestreamWithoutRTMP',
          kind: 'action',
          defaultExpected: '直播启动成功，无需手动输入 RTMP/key',
        },
        {
          key: 'expectGoLiveWithin',
          label: '验收：在限定时间内进入“直播中”状态',
          method: 'expectGoLiveWithin',
          kind: 'assert',
          params: [
            {
              name: 'timeoutMs',
              type: 'number',
              placeholder: '最大等待时长（毫秒），例如 30000',
              required: true,
            },
          ],
          defaultExpected: '页面在设定时间内显示“直播中”或等效状态',
        },
        {
          key: 'expectStreamVisibleToTestViewer',
          label: '验收：测试观众端能看到直播',
          method: 'expectStreamVisibleToTestViewer',
          kind: 'assert',
          defaultExpected: '观众端可以正常看到直播画面',
        },
        {
          key: 'expectConnectionIndicatorVisible',
          label: '验收：Studio 中显示连接状态指示',
          method: 'expectConnectionIndicatorVisible',
          kind: 'assert',
          defaultExpected: 'Studio UI 中显示连接状态/bitrate 等基础信息',
        },
      ],
    },
    {
      key: 'profile',
      label: '个人主页（Web）',
      module: 'gettr-web-lib',
      className: 'ProfilePage',
      varName: 'profile',
      actions: [
        {
          key: 'deleteTopPost',
          label: '删除顶部一条帖子',
          method: 'deleteTopPost',
          kind: 'action',
          defaultExpected: '顶部帖子被删除，列表刷新后不再出现该帖子',
        },
      ],
    },
  ],
};
