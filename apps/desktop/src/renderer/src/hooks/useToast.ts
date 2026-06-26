import { useContext } from "react";
import { ToastContext } from "../Toast";

export function useToast() {
  return useContext(ToastContext);
}
