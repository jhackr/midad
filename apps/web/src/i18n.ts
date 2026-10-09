// Interface strings. Arabic is the reference language; every key must exist
// in both dictionaries (TypeScript enforces it through `Strings`).
//
// The interface speaks through icons and state; words appear as tooltips on
// hover, as one-word labels on the main actions, and as explanations behind
// the small "!" marks. Keep every string short.

import type { WarningKind } from './engine/types';

export type Lang = 'ar' | 'en';

const ar = {
  appName: 'مداد',
  tagline: 'محرر الخط العربي',
  loading: 'يجهّز المحرك والخطوط…',
  loadFailed: 'تعذّر تشغيل المحرك',
  loadFailedHint: 'ابنِ ملفات WebAssembly بالأمر npm run build:wasm ثم أعد تحميل الصفحة.',
  moreInfo: 'شرح',
  undo: 'تراجع',
  redo: 'إعادة',
  zoomIn: 'تكبير',
  zoomOut: 'تصغير',
  fit: 'ملاءمة الورقة',
  guides: 'الميزان',
  guidesHint: 'سُلّم النقاط وخط السطر',
  file: 'ملف',
  newDoc: 'جديد',
  openDoc: 'فتح…',
  saveDoc: 'حفظ',
  exportDoc: 'تصدير',
  exportSvg: 'SVG',
  exportSvgNote: 'متجه',
  exportPng: 'PNG',
  exportPngNote: 'صورة شفافة',
  openFailed: 'لم يُفتح الملف: ليس مشروع مداد صالحًا أو كُتب لخط غير محمّل.',
  text: 'النص',
  textPlaceholder: 'اكتب العبارة هنا',
  sheetHelp:
    'انقر حرفًا لتعديله، واسحبه لتحريكه. اسحب المعيّن الذهبي على الوصلة لمدّها. للتكبير: Ctrl مع العجلة، أو إصبعان على الجوال.',
  letter: 'الحرف',
  prevLetter: 'الحرف السابق',
  nextLetter: 'الحرف التالي',
  close: 'إغلاق',
  shapes: 'أشكال',
  original: 'الشكل الأصلي',
  noShapes: 'لا يقدّم هذا الخط شكلًا آخر لهذا الحرف في هذا الموضع.',
  kashida: 'مدّ',
  kashidaHint: 'مدّ الوصلة بعد هذا الحرف. كل معيّن نقطة قلم واحدة. اسحب على الصف أو على المعيّن الذهبي في الورقة.',
  kashidaUnavailable: 'لا تقبل وصلة هذا الحرف مدًّا في هذا الخط.',
  position: 'إزاحة',
  positionHint: 'تُقاس الإزاحة بالنقاط: نقطة القلم المعيّنة التي يقيس بها الخطاط. يمكنك أيضًا سحب الحرف أو استعمال الأسهم.',
  horizontal: 'أفقيًا',
  vertical: 'رأسيًا',
  less: 'أنقص',
  more: 'زِد',
  dots: 'نقطة',
  size: 'حجم',
  rotation: 'ميل',
  resetLetter: 'أعد الحرف كما كان',
  resetAll: 'أزل كل التعديلات',
  modified: 'معدَّل',
  piece: 'القطعة',
  pieceSettings: 'تنسيق القطعة',
  styleOptions: 'خيارات الخط',
  layout: 'محاذاة',
  alignRight: 'يمين',
  alignCenter: 'وسط',
  alignLeft: 'يسار',
  lineSpacing: 'تباعد الأسطر',
  shortcuts: 'الاختصارات',
  license: 'الرخصة',
  switchLang: 'English',
  langShort: 'EN',
  kashidaRefused: 'لا تقبل هذه الوصلة مدًّا في هذا الخط.',
  kashidaLimit: 'بلغت هذه الكلمة أقصى عدد من المدود يسمح به الخط.',
  savedLocally: 'يُحفظ عملك تلقائيًا في هذا المتصفح.',
  warnings: 'تنبيهات',
  dismiss: 'إخفاء',
} as const;

export type Strings = { [K in keyof typeof ar]: string };

const en: Strings = {
  appName: 'Midad',
  tagline: 'Arabic calligraphy editor',
  loading: 'Preparing the engine and styles…',
  loadFailed: 'The engine could not start',
  loadFailedHint: 'Build the WebAssembly files with npm run build:wasm, then reload.',
  moreInfo: 'Explain',
  undo: 'Undo',
  redo: 'Redo',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Fit the sheet',
  guides: 'Measure',
  guidesHint: 'Dot ladder and baseline',
  file: 'File',
  newDoc: 'New',
  openDoc: 'Open…',
  saveDoc: 'Save',
  exportDoc: 'Export',
  exportSvg: 'SVG',
  exportSvgNote: 'vector',
  exportPng: 'PNG',
  exportPngNote: 'transparent image',
  openFailed: 'The file was not opened: it is not a Midad piece, or its style is not loaded.',
  text: 'Text',
  textPlaceholder: 'Type the phrase here',
  sheetHelp:
    'Click a letter to edit it, drag it to move it. Drag the gold diamond on a join to stretch it. Zoom with Ctrl + wheel, or two fingers on a phone.',
  letter: 'Letter',
  prevLetter: 'Previous letter',
  nextLetter: 'Next letter',
  close: 'Close',
  shapes: 'Shapes',
  original: 'Original shape',
  noShapes: 'This style offers no other shape for this letter here.',
  kashida: 'Stretch',
  kashidaHint: 'Stretch the join after this letter. Each diamond is one pen dot. Drag along the row, or drag the gold diamond on the sheet.',
  kashidaUnavailable: 'The join after this letter cannot be stretched in this style.',
  position: 'Offset',
  positionHint: 'Offsets are measured in dots: the rhombic pen dot calligraphers measure with. You can also drag the letter or use the arrow keys.',
  horizontal: 'Horizontal',
  vertical: 'Vertical',
  less: 'Less',
  more: 'More',
  dots: 'dots',
  size: 'Size',
  rotation: 'Slant',
  resetLetter: 'Restore this letter',
  resetAll: 'Remove all changes',
  modified: 'Changed',
  piece: 'Piece',
  pieceSettings: 'Piece layout',
  styleOptions: 'Style options',
  layout: 'Align',
  alignRight: 'Right',
  alignCenter: 'Center',
  alignLeft: 'Left',
  lineSpacing: 'Line spacing',
  shortcuts: 'Shortcuts',
  license: 'License',
  switchLang: 'العربية',
  langShort: 'ع',
  kashidaRefused: 'This join cannot be stretched in this style.',
  kashidaLimit: 'This word already has as many stretches as the style allows.',
  savedLocally: 'Your work is saved automatically in this browser.',
  warnings: 'Warnings',
  dismiss: 'Dismiss',
};

export const dictionaries: Record<Lang, Strings> = { ar, en };

export const warningText: Record<Lang, Record<WarningKind, string>> = {
  ar: {
    stale_alternate: 'شكل اخترته لم يعد يناسب حرفه بعد تعديل النص، فعاد الحرف إلى أصله.',
    kashida_not_allowed: 'مدّ في وصلة لم تعد تقبله، فأُهمل.',
    kashida_limit: 'في الكلمة مدود أكثر مما يسمح به الخط، فطُبّق أولها فقط.',
    conflicting_alternates: 'اخترت شكلين داخل تركيب واحد، فطُبّق الأول.',
  },
  en: {
    stale_alternate: 'A shape you chose no longer fits its letter after the text changed; the letter is back to its original.',
    kashida_not_allowed: 'A stretch sits on a join that no longer accepts it and is ignored.',
    kashida_limit: 'A word has more stretches than the style allows; only the first ones apply.',
    conflicting_alternates: 'Two shapes were chosen inside one ligature; the first one applies.',
  },
};

export const shortcutList: Record<Lang, Array<[string, string]>> = {
  ar: [
    ['Tab', 'الحرف التالي'],
    ['Shift + Tab', 'الحرف السابق'],
    ['[  ]', 'الشكل السابق / التالي'],
    ['الأسهم', 'تحريك يسير'],
    ['Shift + الأسهم', 'تحريك نقطة كاملة'],
    ['Delete', 'إعادة الحرف'],
    ['Ctrl + Z', 'تراجع'],
    ['Ctrl + Shift + Z', 'إعادة'],
    ['Ctrl + S', 'حفظ المشروع'],
    ['+  −  0', 'تكبير / تصغير / ملاءمة'],
    ['Esc', 'إلغاء التحديد'],
  ],
  en: [
    ['Tab', 'Next letter'],
    ['Shift + Tab', 'Previous letter'],
    ['[  ]', 'Previous / next shape'],
    ['Arrows', 'Nudge'],
    ['Shift + Arrows', 'Move one dot'],
    ['Delete', 'Restore letter'],
    ['Ctrl + Z', 'Undo'],
    ['Ctrl + Shift + Z', 'Redo'],
    ['Ctrl + S', 'Save piece'],
    ['+  −  0', 'Zoom in / out / fit'],
    ['Esc', 'Clear selection'],
  ],
};

/** Map an engine rule error to a translated sentence when we recognise it. */
export function engineError(lang: Lang, message: string): string {
  const t = dictionaries[lang];
  if (message.includes('per word')) return t.kashidaLimit;
  if (message.includes('kashida is not allowed')) return t.kashidaRefused;
  return message;
}
