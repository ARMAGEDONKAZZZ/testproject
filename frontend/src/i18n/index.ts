import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ru from "./ru.json";
import en from "./en.json";

// Kazakh is left as a thin stub for now — see
// specs/001-neuratop-mvp/research.md "Internationalization": RU/EN are the
// fully-specified languages; the app is built string-key based from day one
// so KZ can be filled in later without a rewrite.
const kz = ru;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
      kz: { translation: kz },
    },
    fallbackLng: "ru",
    supportedLngs: ["ru", "en", "kz"],
    interpolation: { escapeValue: false },
  });

export default i18n;
