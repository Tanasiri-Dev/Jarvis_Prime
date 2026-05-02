export const localeOptions = [
  { id: "en", label: "English", shortLabel: "EN", htmlLang: "en" },
  { id: "th", label: "ไทย", shortLabel: "TH", htmlLang: "th" },
  { id: "zh-CN", label: "中文", shortLabel: "中文", htmlLang: "zh-CN" },
] as const;

export type Locale = (typeof localeOptions)[number]["id"];

export type TranslationKey =
  | "app.brand.subtitle"
  | "app.nav.command"
  | "app.nav.tools"
  | "app.nav.holidays"
  | "app.nav.meetingRoom"
  | "app.nav.diagnostics"
  | "app.route.command.title"
  | "app.route.command.eyebrow"
  | "app.route.tools.title"
  | "app.route.tools.eyebrow"
  | "app.route.holidays.title"
  | "app.route.holidays.eyebrow"
  | "app.route.meetingRoom.title"
  | "app.route.meetingRoom.eyebrow"
  | "app.route.diagnostics.title"
  | "app.route.diagnostics.eyebrow"
  | "app.sidebar.hide"
  | "app.sidebar.show"
  | "app.theme.label"
  | "app.theme.dark"
  | "app.theme.white"
  | "app.language.label"
  | "app.session.viewerPrototype"
  | "app.command.eyebrow"
  | "app.command.title"
  | "app.command.description"
  | "app.command.modules"
  | "app.command.initializing"
  | "app.command.apiTarget"
  | "app.footer.kicker"
  | "app.footer.copy"
  | "app.footer.linksLabel"
  | "app.footer.copyright";

type TranslationDictionary = Record<TranslationKey, string>;

const dictionaries: Record<Locale, TranslationDictionary> = {
  en: {
    "app.brand.subtitle": "Engineering assistant",
    "app.nav.command": "Command",
    "app.nav.tools": "Tools",
    "app.nav.holidays": "Holidays",
    "app.nav.meetingRoom": "Meeting Room",
    "app.nav.diagnostics": "Diagnostics",
    "app.route.command.title": "Command Center",
    "app.route.command.eyebrow": "Phase 0 foundation",
    "app.route.tools.title": "Engineering Tools",
    "app.route.tools.eyebrow": "Worker-backed utilities",
    "app.route.holidays.title": "Public Holidays",
    "app.route.holidays.eyebrow": "Planner calendar",
    "app.route.meetingRoom.title": "Meeting Room",
    "app.route.meetingRoom.eyebrow": "Planner calendar",
    "app.route.diagnostics.title": "Diagnostics",
    "app.route.diagnostics.eyebrow": "Parallel runtime",
    "app.sidebar.hide": "Hide sidebar",
    "app.sidebar.show": "Show sidebar",
    "app.theme.label": "Theme",
    "app.theme.dark": "Dark",
    "app.theme.white": "White",
    "app.language.label": "Language",
    "app.session.viewerPrototype": "Viewer prototype",
    "app.command.eyebrow": "Today",
    "app.command.title": "Build the reliable core first.",
    "app.command.description": "React shell, worker rendering, and clean module boundaries.",
    "app.command.modules": "Registered modules",
    "app.command.initializing": "initializing",
    "app.command.apiTarget": "API target",
    "app.footer.kicker": "AI Code with Human Control",
    "app.footer.copy": "Worker-first tools for manufacturing engineers, planners, and factory teams.",
    "app.footer.linksLabel": "Jarvis Prime links",
    "app.footer.copyright": "(C) 2026 Tanasiri-Jarvis Prime. All Right Reserve.",
  },
  th: {
    "app.brand.subtitle": "ผู้ช่วยงานวิศวกรรม",
    "app.nav.command": "ศูนย์สั่งการ",
    "app.nav.tools": "เครื่องมือ",
    "app.nav.holidays": "วันหยุด",
    "app.nav.meetingRoom": "ห้องประชุม",
    "app.nav.diagnostics": "วินิจฉัยระบบ",
    "app.route.command.title": "ศูนย์สั่งการ",
    "app.route.command.eyebrow": "โครงสร้าง Phase 0",
    "app.route.tools.title": "เครื่องมือวิศวกรรม",
    "app.route.tools.eyebrow": "ยูทิลิตีที่ทำงานผ่าน Worker",
    "app.route.holidays.title": "วันหยุดราชการ",
    "app.route.holidays.eyebrow": "ปฏิทินสำหรับ Planner",
    "app.route.meetingRoom.title": "ห้องประชุม",
    "app.route.meetingRoom.eyebrow": "ปฏิทินสำหรับ Planner",
    "app.route.diagnostics.title": "วินิจฉัยระบบ",
    "app.route.diagnostics.eyebrow": "ระบบรันไทม์แบบขนาน",
    "app.sidebar.hide": "ซ่อนแถบเมนู",
    "app.sidebar.show": "แสดงแถบเมนู",
    "app.theme.label": "ธีม",
    "app.theme.dark": "มืด",
    "app.theme.white": "สว่าง",
    "app.language.label": "ภาษา",
    "app.session.viewerPrototype": "โหมดผู้ชมต้นแบบ",
    "app.command.eyebrow": "วันนี้",
    "app.command.title": "สร้างแกนหลักให้เชื่อถือได้ก่อน",
    "app.command.description": "React shell, worker rendering และขอบเขต module ที่ชัดเจน",
    "app.command.modules": "โมดูลที่ลงทะเบียน",
    "app.command.initializing": "กำลังเริ่มต้น",
    "app.command.apiTarget": "API เป้าหมาย",
    "app.footer.kicker": "AI Code with Human Control",
    "app.footer.copy": "เครื่องมือแบบ Worker-first สำหรับวิศวกร Planner และทีมโรงงาน",
    "app.footer.linksLabel": "ลิงก์ Jarvis Prime",
    "app.footer.copyright": "(C) 2026 Tanasiri-Jarvis Prime. All Right Reserve.",
  },
  "zh-CN": {
    "app.brand.subtitle": "工程助理",
    "app.nav.command": "指挥中心",
    "app.nav.tools": "工具",
    "app.nav.holidays": "假日",
    "app.nav.meetingRoom": "会议室",
    "app.nav.diagnostics": "诊断",
    "app.route.command.title": "指挥中心",
    "app.route.command.eyebrow": "Phase 0 基础",
    "app.route.tools.title": "工程工具",
    "app.route.tools.eyebrow": "Worker 支撑的工具",
    "app.route.holidays.title": "公共假日",
    "app.route.holidays.eyebrow": "计划日历",
    "app.route.meetingRoom.title": "会议室",
    "app.route.meetingRoom.eyebrow": "计划日历",
    "app.route.diagnostics.title": "诊断",
    "app.route.diagnostics.eyebrow": "并行运行时",
    "app.sidebar.hide": "隐藏侧边栏",
    "app.sidebar.show": "显示侧边栏",
    "app.theme.label": "主题",
    "app.theme.dark": "深色",
    "app.theme.white": "浅色",
    "app.language.label": "语言",
    "app.session.viewerPrototype": "查看者原型",
    "app.command.eyebrow": "今天",
    "app.command.title": "先构建可靠核心",
    "app.command.description": "React shell、Worker 渲染和清晰的模块边界。",
    "app.command.modules": "已注册模块",
    "app.command.initializing": "初始化中",
    "app.command.apiTarget": "API 目标",
    "app.footer.kicker": "AI Code with Human Control",
    "app.footer.copy": "面向制造工程师、计划员和工厂团队的 Worker-first 工具。",
    "app.footer.linksLabel": "Jarvis Prime 链接",
    "app.footer.copyright": "(C) 2026 Tanasiri-Jarvis Prime. All Right Reserve.",
  },
};

export function isLocale(value: string | null): value is Locale {
  return localeOptions.some((option) => option.id === value);
}

export function createTranslator(locale: Locale) {
  return (key: TranslationKey): string => dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
}

export function getHtmlLang(locale: Locale): string {
  return localeOptions.find((option) => option.id === locale)?.htmlLang ?? "en";
}
