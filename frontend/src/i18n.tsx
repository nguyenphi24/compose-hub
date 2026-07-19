import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type Language = "vi" | "en";

const messages = {
  vi: {
    "nav.dashboard": "Dashboard", "nav.newApplication": "Tạo Application",
    "language.label": "Ngôn ngữ",
    "dashboard.eyebrow": "SINGLE HOST MVP", "dashboard.title": "Dashboard",
    "dashboard.subtitle": "Quản lý application Docker Compose mà không cần SSH.",
    "dashboard.create": "+ Tạo Application", "dashboard.dockerHost": "Docker host",
    "dashboard.online": "Online", "dashboard.offline": "Offline", "dashboard.loading": "Đang tải...",
    "dashboard.containers": "Containers", "dashboard.totalContainers": "{count} tổng container",
    "dashboard.applications": "Applications", "dashboard.managed": "được quản lý bởi ComposeHub",
    "dashboard.resources": "Tài nguyên", "dashboard.sectionDescription": "Mỗi application bao gồm nhiều service liên quan.",
    "dashboard.emptyTitle": "Chưa có application", "dashboard.emptyDescription": "Tạo application đầu tiên để bắt đầu demo.",
    "dashboard.createNow": "Tạo ngay", "dashboard.noDescription": "Không có mô tả",
    "dashboard.serviceCount": "{count} service · {environment}",
    "common.cancel": "Hủy", "doctor.title": "Compose Doctor",
    "doctor.description": "Kiểm tra rủi ro trước khi deploy. Lỗi Critical sẽ chặn release.",
    "doctor.checking": "Đang kiểm tra...", "doctor.run": "Chạy kiểm tra",
    "doctor.empty": "Chưa có báo cáo. Chạy kiểm tra để xem deployment plan.",
    "plan.title": "Change Plan", "plan.description": "So sánh cấu hình mong muốn với release thành công đang chạy.",
    "plan.analyzing": "Đang phân tích...", "plan.refresh": "Làm mới plan", "plan.empty": "Chưa có Change Plan.",
    "plan.rollbackAvailable": "Có rollback snapshot", "plan.rollbackUnavailable": "Chưa có rollback snapshot",
    "release.title": "Release Timeline", "release.description": "Mỗi deploy lưu Compose snapshot để rollback không phụ thuộc UI hiện tại.",
    "release.empty": "Chưa có release. Deploy lần đầu để tạo snapshot.",
    "deploy.confirmTitle": "Xác nhận Change Plan", "deploy.rollbackReady": "Rollback sẵn sàng",
    "deploy.firstDeploy": "Chưa có rollback cho lần deploy đầu", "deploy.deploying": "Đang deploy...",
    "deploy.confirm": "Xác nhận Deploy", "rollback.rollingBack": "Đang rollback...", "rollback.confirm": "Xác nhận rollback",
    "app.builder": "APPLICATION BUILDER", "app.newTitle": "Tạo Application", "app.newDescription": "Khai báo ứng dụng bằng Blueprint hoặc giao diện thủ công.",
    "app.blueprints": "Kho Blueprint", "app.manual": "Tự cấu hình (Thủ công)", "app.general": "Thông tin chung",
    "app.name": "Tên application", "app.environment": "Môi trường", "app.description": "Mô tả", "app.services": "Services",
    "app.servicesDescription": "Cấu hình image, port, biến môi trường và volume.", "app.addService": "+ Thêm service",
    "app.creating": "Đang tạo...", "app.create": "Tạo Application", "app.createBlueprint": "Tạo từ Blueprint",
    "app.preview": "Xem trước compose.yaml", "app.realtime": "Cập nhật thời gian thực.", "app.previewHint": "Nhập thông tin để xem preview...",
    "app.loadingBlueprints": "Đang tải danh sách Blueprint...", "app.loadingPreview": "Đang tải preview...",
    "app.editTitle": "Chỉnh sửa Application", "app.editDescription": "Cập nhật cấu hình dịch vụ. Sau khi lưu, deploy để áp dụng thay đổi.",
    "app.back": "← Quay lại", "app.saving": "Đang lưu...", "app.save": "Lưu thay đổi",
    "detail.edit": "✏ Chỉnh sửa", "detail.delete": "🗑 Xóa", "detail.declared": "được khai báo", "detail.detected": "được phát hiện",
    "detail.status": "Trạng thái", "detail.dockerStatus": "theo Docker Engine", "detail.currentStatus": "Trạng thái hiện tại.",
    "detail.notDeployed": "Chưa deploy application.", "detail.noPublicPort": "Không public port", "detail.planning": "Đang lập plan...",
  },
  en: {
    "nav.dashboard": "Dashboard", "nav.newApplication": "New Application", "language.label": "Language",
    "dashboard.eyebrow": "SINGLE HOST MVP", "dashboard.title": "Dashboard",
    "dashboard.subtitle": "Manage Docker Compose applications without SSH.",
    "dashboard.create": "+ New Application", "dashboard.dockerHost": "Docker host",
    "dashboard.online": "Online", "dashboard.offline": "Offline", "dashboard.loading": "Loading...",
    "dashboard.containers": "Containers", "dashboard.totalContainers": "{count} containers total",
    "dashboard.applications": "Applications", "dashboard.managed": "managed by ComposeHub",
    "dashboard.resources": "Resources", "dashboard.sectionDescription": "Each application contains a group of related services.",
    "dashboard.emptyTitle": "No applications yet", "dashboard.emptyDescription": "Create your first application to get started.",
    "dashboard.createNow": "Create now", "dashboard.noDescription": "No description",
    "dashboard.serviceCount": "{count} service · {environment}",
    "common.cancel": "Cancel", "doctor.title": "Compose Doctor",
    "doctor.description": "Check deployment risks before release. Critical issues block deployment.",
    "doctor.checking": "Checking...", "doctor.run": "Run checks",
    "doctor.empty": "No report yet. Run checks to view the deployment plan.",
    "plan.title": "Change Plan", "plan.description": "Compare the desired configuration with the latest successful release.",
    "plan.analyzing": "Analyzing...", "plan.refresh": "Refresh plan", "plan.empty": "No Change Plan yet.",
    "plan.rollbackAvailable": "Rollback snapshot available", "plan.rollbackUnavailable": "No rollback snapshot",
    "release.title": "Release Timeline", "release.description": "Each deploy stores a Compose snapshot for rollback independent of the current UI state.",
    "release.empty": "No releases yet. Deploy once to create a snapshot.",
    "deploy.confirmTitle": "Confirm Change Plan", "deploy.rollbackReady": "Rollback ready",
    "deploy.firstDeploy": "No rollback available for the first deploy", "deploy.deploying": "Deploying...",
    "deploy.confirm": "Confirm Deploy", "rollback.rollingBack": "Rolling back...", "rollback.confirm": "Confirm rollback",
    "app.builder": "APPLICATION BUILDER", "app.newTitle": "New Application", "app.newDescription": "Define an application using a Blueprint or the manual builder.",
    "app.blueprints": "Blueprint Catalog", "app.manual": "Manual configuration", "app.general": "General information",
    "app.name": "Application name", "app.environment": "Environment", "app.description": "Description", "app.services": "Services",
    "app.servicesDescription": "Configure images, ports, environment variables, and volumes.", "app.addService": "+ Add service",
    "app.creating": "Creating...", "app.create": "Create Application", "app.createBlueprint": "Create from Blueprint",
    "app.preview": "compose.yaml preview", "app.realtime": "Updates in real time.", "app.previewHint": "Enter application details to see a preview...",
    "app.loadingBlueprints": "Loading Blueprints...", "app.loadingPreview": "Loading preview...",
    "app.editTitle": "Edit Application", "app.editDescription": "Update service configuration, then deploy to apply your changes.",
    "app.back": "← Back", "app.saving": "Saving...", "app.save": "Save changes",
    "detail.edit": "✏ Edit", "detail.delete": "🗑 Delete", "detail.declared": "declared", "detail.detected": "detected",
    "detail.status": "Status", "detail.dockerStatus": "reported by Docker Engine", "detail.currentStatus": "Current status.",
    "detail.notDeployed": "Application has not been deployed.", "detail.noPublicPort": "No public port", "detail.planning": "Preparing plan...",
  },
} as const;

type MessageKey = keyof typeof messages.vi;
type Variables = Record<string, string | number>;
type I18nValue = { language: Language; setLanguage: (value: Language) => void; t: (key: MessageKey, variables?: Variables) => string };
const I18nContext = createContext<I18nValue | null>(null);

function getInitialLanguage(): Language {
  const saved = localStorage.getItem("composehub.language");
  if (saved === "vi" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  useEffect(() => {
    localStorage.setItem("composehub.language", language);
    document.documentElement.lang = language;
  }, [language]);
  const value = useMemo<I18nValue>(() => ({
    language, setLanguage,
    t: (key, variables = {}) => Object.entries(variables).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), messages[language][key] as string),
  }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
