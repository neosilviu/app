import { Link, useParams } from "react-router";
import { Button } from "~/components/ui/button";
import { useConfig } from "~/hooks/useConfig";
import { FileQuestion } from "lucide-react";
import { getLocalizedPath } from "~/lib/core";

export default function NotFound() {
  const { lang } = useParams();
  const { uiConfig } = useConfig();

  const primaryColor = uiConfig.brand?.primary || 'indigo';
  const accentColor = uiConfig.brand?.accent || 'indigo';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-slate-50 dark:bg-slate-950">
      <div className={`w-24 h-24 bg-${primaryColor}/10 rounded-full flex items-center justify-center mb-6`}>
        <FileQuestion className={`w-12 h-12 text-${primaryColor}`} />
      </div>
      <h1 className="text-6xl font-bold text-slate-900 dark:text-white mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">Page Not Found</h2>
      <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md">
        Oops! The page you are looking for doesn't exist or has been moved to another location.
      </p>
      <Button asChild className={`bg-${primaryColor} hover:bg-${accentColor} text-white px-8 py-6 rounded-xl font-bold shadow-lg transition-all`}>
        <Link to={getLocalizedPath("/", lang)}>Back to Dashboard</Link>
      </Button>
    </div>
  );
}
