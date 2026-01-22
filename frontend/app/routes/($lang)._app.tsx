import DashboardLayout from "~/components/layout/LayoutCore";
import { Outlet, useParams } from "react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function AppLayout() {
  const { lang } = useParams();
  const { i18n } = useTranslation();

  // Sincronizăm limba din URL cu instanța i18n
  useEffect(() => {
    if (lang && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
