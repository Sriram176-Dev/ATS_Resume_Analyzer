import { useEffect } from "react";
import { APP_NAME } from "../config";

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | ${APP_NAME}` : `${APP_NAME}: check how applicant tracking systems read your resume`;
  }, [title]);
}
