# H5 Voice Assistant — SPEC.md

## 1. Concept & Vision

一款可以在手机浏览器直接打开的语音助手页面。按住说话 → 大模型思考 → 语音回复 + 文字同步显示。像在跟一个聪明又温柔的 AI 对话，交互自然流畅，视觉上像一颗有生命力的"能量球"。

关键词：**极简、流畅、有温度、科技感**

---

## 2. Design Language

### Aesthetic Direction
**深空科技感** — 深色背景配流动光晕，像在操作一个太空舱控制台。球体是视觉焦点，呼吸式动画传递"活着"的感觉。

### Color Palette
| Role | Color | Usage |
|------|-------|-------|
| Background | `#0d0d1a` | 页面背景 |
| Surface | `#16162a` | 卡片、面板 |
| Primary | `#7c3aed` | 主按钮、高亮 |
| Primary Glow | `#a78bfa` | 光晕、发光效果 |
| Accent | `#06b6d4` | 录音时的波形、次要强调 |
| Text Primary | `#f1f5f9` | 主要文字 |
| Text Secondary | `#94a3b8` | 次要说明文字 |
| Success | `#10b981` | 静音/成功状态 |
| Danger | `#ef4444` | 取消、错误 |

### Typography
- **Primary**: `Geist` (Google Fonts fallback: `Inter`) — 数字感、现代
- **Fallback**: `system-ui, -apple-system, sans-serif`
- **Scale**: 12 / 14 / 16 / 20 / 28 / 40px

### Spatial System
- Base unit: 8px
- Card padding: 24px
- Section gap: 32px
- Border radius: 16px (cards), 50% (orb), 12px (buttons)

### Motion Philosophy
- **Orb 呼吸动画**: scale 1→1.08→1, 2.5s ease-in-out infinite（待机时）
- **Orb 脉冲**: 录音时 scale + glow 同步扩大，带 ring 扩散波纹
- **文字出现**: 逐字 fade-in + translateY(8px→0), 30ms/字
- **设置面板**: slide-up from bottom, 300ms cubic-bezier(0.32, 0.72, 0, 1)
- **波形可视化**: 录音时实时 canvas 绘制音频振幅

### Visual Assets
- Icons: Lucide Icons (CDN)
- 装饰: CSS radial-gradient + SVG noise texture overlay
- 无需外部图片，全部用代码生成

---

## 3. Layout & Structure

```
┌─────────────────────────────────┐
│  🔇  设置 ⚙️                     │  ← 顶栏（固定）
├─────────────────────────────────┤
│                                 │
│        ┌───────────┐            │
│        │   ORB     │            │  ← 核心交互区（居中，可呼吸）
│        │  ●●●●●●   │            │
│        └───────────┘            │
│                                 │
│    "长按说话，松开发送"            │  ← 提示文字
│                                 │
├─────────────────────────────────┤
│  ┌─────────────────────────┐    │
│  │ 🗣️ 你说的内容...          │    │  ← 用户消息（语音识别后显示）
│  ├─────────────────────────┤    │
│  │ 🤖 AI 回复文字...        │    │  ← AI 消息（打字机效果）
│  │  🔊 播放进度条            │    │
│  └─────────────────────────┘    │  ← 对话区（可滚动）
└─────────────────────────────────┘
```

- 顶栏: 40px，固定在顶部，含静音按钮和设置入口
- 主交互区: 上下居中，orb 直径 160px
- 对话区: 固定在底部，高度 35vh，可滚动
- 移动端安全: 适配 safe-area-inset-bottom

### Responsive
- 优先适配 375px~430px 宽度（手机竖屏）
- Orb 尺寸根据屏幕等比缩放（min 120px, max 180px）
- 对话气泡最大宽度 85%

---

## 4. Features & Interactions

### 4.1 语音输入
- **触发方式**: 长按 orb 区域开始录音
- **反馈**: orb 放大 + 颜色变 Accent + 周围 ring 扩散波纹 + 波形动画
- **结束**: 松开手指自动发送；或点击取消（显示 X 动画）
- **最大录音时长**: 60s（超时自动停止并发送）
- **无声音检测**: 录音中若 3s 无声音则提示"没检测到声音"
- **错误处理**: 麦克风权限拒绝 → 显示引导开启权限的提示

### 4.2 语音识别 (STT)
- 优先使用浏览器 Web Speech API (`SpeechRecognition`)
- 备用: 发送音频到后端 `/api/stt` 处理
- 识别结果实时显示在用户气泡中（类似打字效果）

### 4.3 LLM 处理
- 发送识别文本到后端 `/api/chat`
- 请求体: `{ text: "用户说的话" }`
- 返回: `{ reply: "AI回复文字", audioUrl: "音频文件URL" }`
- 加载中: orb 旋转 + 文字 "思考中..."
- 错误时: orb 抖动 + 显示错误消息

### 4.4 语音回复 (TTS)
- AI 回复文字同时:
  1. 文字区开始逐字打字机动画
  2. 自动播放返回的音频（若 `audioUrl` 存在）
  3. 音频播放时 orb 跟随音量大小有轻微跳动
- 音频播放控制: 进度条可拖动，暂停/继续按钮

### 4.5 声音设置
- **音量调节**: 滑块 0~100%，实时生效
- **静音切换**: 开关按钮，静音时显示 🔇 并禁用音频播放
- **语速调节**: 滑块 0.5x~2.0x（影响 TTS 参数）
- 设置保存在 `localStorage`

### 4.6 对话历史
- 本次会话内的对话记录（不持久化）
- 新对话自动清空历史
- 点击历史消息可重新播放对应音频

---

## 5. Component Inventory

### 5.1 VoiceOrb（核心按钮）
- **待机**: 紫色球体，呼吸动画，光晕模糊
- **录音中**: Accent 色，ring 扩散动画，canvas 波形
- **处理中**: 旋转光环 + 加载文字
- **错误**: 抖动动画 + 红色闪光

### 5.2 MessageBubble（消息气泡）
- **用户消息**: 右侧，Primary 背景色，带语音图标
- **AI消息**: 左侧，Surface 背景色，带机器人图标
- **加载中**: 三个点跳动动画
- **打字中**: 光标闪烁

### 5.3 AudioPlayer（音频播放器）
- 进度条: 自定义样式（Primary 色滑块）
- 时间显示: `0:00 / 0:12` 格式
- 按钮: 播放/暂停，快进5s，快退5s
- 波形预览: 静态 CSS 波形条

### 5.4 SettingsPanel（设置面板）
- 从底部 slide-up 弹出
- 半透明遮罩层
- 包含: 音量滑块、语速滑块、静音开关
- 关闭按钮或点击遮罩关闭

### 5.5 Toast（提示）
- 居中显示，2s 自动消失
- 类型: success（绿）、error（红）、info（蓝）

---

## 6. Technical Approach

### Frontend
- **纯 HTML/CSS/JS**（无框架，体积小，加载快）
- Web Speech API: 语音识别
- Web Audio API: 音频播放和可视化
- Canvas API: 录音波形绘制
- CSS Variables: 主题控制
- localStorage: 设置持久化

### Backend (Node.js + Express)
```
/api/chat     POST  { text } → { reply, audioUrl }
/api/tts      POST  { text } → audio/mp3
/api/stt      POST  audio blob → { text }
/api/health   GET   → { status: "ok" }
```

### 依赖
- `express` — HTTP 服务
- `multer` — 接收音频文件
- `node-fetch` / 内置 fetch — 调用 Volcengine ARK API
- `dotenv` — 环境变量

### TTS 方案
优先使用 **Volcengine TTS API**（与 ARK 模型同体系），备用 CosyVoice 或 OpenAI TTS。

### 环境变量
```
ARK_API_KEY=xxx
ARK_ENDPOINT=https://ark.cn-beijing.volces.com/api/v3/
TTS_API_KEY=xxx
TTS_ENDPOINT=xxx
PORT=3000
```

---

## 7. File Structure

```
h5-voice-assistant/
├── SPEC.md
├── package.json
├── .env.example
├── server/
│   ├── index.js          # Express 入口
│   ├── routes/
│   │   ├── chat.js       # /api/chat
│   │   └── tts.js        # /api/tts
│   ├── services/
│   │   ├── ark.js        # ARK 大模型调用
│   │   └── tts.js        # TTS 调用
│   └── uploads/          # 临时音频文件
└── public/
    ├── index.html        # 主页面
    ├── css/
    │   └── style.css     # 样式
    └── js/
        ├── app.js        # 主逻辑
        ├── recorder.js   # 录音模块
        ├── stt.js        # 语音识别
        ├── player.js     # 音频播放
        └── ui.js         # UI 交互
```
