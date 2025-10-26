import { NextResponse } from 'next/server';

// Simple mock snapshot for the Android Inspector prototype
export async function GET() {
  // Mock a 1080x1920 logical screen with two elements
  const screen = { width: 1080, height: 1920 };
  const nodes = [
    {
      nodeId: 'n1',
      class: 'android.widget.TextView',
      text: '欢迎使用',
      resourceId: 'com.example:id/title',
      contentDesc: '',
      clickable: false,
      bounds: { x1: 80, y1: 140, x2: 1000, y2: 240 },
    },
    {
      nodeId: 'n2',
      class: 'android.widget.Button',
      text: '登录',
      resourceId: 'com.example:id/btn_login',
      contentDesc: 'login-button',
      clickable: true,
      bounds: { x1: 140, y1: 760, x2: 940, y2: 880 },
    },
    {
      nodeId: 'n3',
      class: 'android.widget.EditText',
      text: '',
      resourceId: 'com.example:id/input_username',
      contentDesc: 'username',
      clickable: true,
      bounds: { x1: 120, y1: 520, x2: 960, y2: 620 },
    },
  ];

  return NextResponse.json({
    screenshotUrl: '/window.svg',
    screen,
    nodes,
    takenAt: Date.now(),
  });
}

