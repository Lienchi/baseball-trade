// 檢舉原因白名單：前端選單與 API 驗證共用
export const REPORT_REASONS = ['加價轉售', '疑似詐騙', '內容不實', '其他'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]
