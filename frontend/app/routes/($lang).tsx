import { Outlet, useParams, useNavigate, useLocation } from "react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import i18nConfig from "~/i18n";

export async function loader({ request, context, params }: any) {
  // console.log(`[LANG-ROUTE] Loader hit for: ${request.url} with params:`, params);
  return null;
}

export async function action({ request, context, params }: any) {
  return null;
}

export default function LangLayout() {
  const { lang } = useParams();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (lang && i18nConfig.supportedLngs.includes(lang) && i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  return <Outlet />;
}
