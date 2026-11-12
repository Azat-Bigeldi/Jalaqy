import { Banner } from "@/components/ui";
import { t } from "@/i18n";

/** Плашка на входе и регистрации, когда на хостинге не заданы ключи базы. */
export function NotConfigured() {
  return (
    <Banner tone="danger" title={t.ui.notConfiguredTitle} role="alert">
      {t.ui.notConfiguredText}
    </Banner>
  );
}
