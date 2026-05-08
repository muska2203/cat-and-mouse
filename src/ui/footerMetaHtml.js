import { APP_ANALYTICS_NOTE, APP_DEVELOPER_NAME, APP_VERSION } from "../app-config.js?v=0.5.0-pre-alpha";

export function buildFooterMetaHtml() {
  return `
    <div class="cm-meta-footer" aria-label="Информация о версии и аналитике">
      <div class="cm-meta-footer__line">
        <span class="cm-meta-footer__value">v. ${APP_VERSION} Разработчик: ${APP_DEVELOPER_NAME}</span>
      </div>
      <p class="cm-meta-footer__note">${APP_ANALYTICS_NOTE}</p>
    </div>
  `;
}
