// Bento UI 主题常量
// 基于 HamsterStore 开发文档 §6.1 Bento UI 设计规范

// 主色系
export const COLORS = {
    primary: { r: 0.145, g: 0.388, b: 0.922 },      // #2563EB
    secondary: { r: 0.063, g: 0.725, b: 0.506 },     // #10B981
    neutral: { r: 0.118, g: 0.161, b: 0.231 },       // #1E293B
    white: { r: 1.0, g: 1.0, b: 1.0 },               // #FFFFFF
    bg: { r: 0.945, g: 0.953, b: 0.965 },             // #F1F3F6
    bgCard: { r: 1.0, g: 1.0, b: 1.0 },               // card white
    text: { r: 0.118, g: 0.161, b: 0.231 },           // #1E293B
    textSecondary: { r: 0.392, g: 0.451, b: 0.510 },  // #647387
    divider: { r: 0.878, g: 0.886, b: 0.902 },        // #E0E2E6
    error: { r: 0.937, g: 0.267, b: 0.267 },          // #EF4444
    star: { r: 0.961, g: 0.725, b: 0.141 },           // #F5B924
};

// 圆角
export const RADIUS = {
    card: 16,
    smallCard: 12,
    button: 10,
};

// 间距
export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
};

// 字体大小
export const FONT = {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 22,
    title: 28,
};

// 阴影（用背景色暗化模拟）
export const SHADOW = {
    card: { r: 0.92, g: 0.93, b: 0.95 },
    elevated: { r: 0.85, g: 0.87, b: 0.92 },
};