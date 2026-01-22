export default {
  // This is the list of languages your application supports
  supportedLngs: ["en", "ro"],
  // This is the language you want to use in case
  // if the user language is not in the supportedLngs
  fallbackLng: "ro",
  // The default namespace of i118next is "translation", but you can change it here
  defaultNS: "common",
  // Disabling suspense is recommended by i18next-react
  react: { useSuspense: false },
};
