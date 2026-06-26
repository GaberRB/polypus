import { createContext, useCallback, useReducer } from "react";
import ReactDOM from "react-dom";

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

type Action =
  | { kind: "add"; toast: Toast }
  | { kind: "remove"; id: number };

function reducer(state: Toast[], action: Action): Toast[] {
  if (action.kind === "add") return [...state, action.toast];
  return state.filter((t) => t.id !== action.id);
}

let nextId = 1;

export interface ToastAPI {
  success(msg: string): void;
  error(msg: string): void;
  info(msg: string): void;
}

export const ToastContext = createContext<ToastAPI>({
  success: () => undefined,
  error: () => undefined,
  info: () => undefined,
});

export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [toasts, dispatch] = useReducer(reducer, []);

  const push = useCallback((message: string, type: Toast["type"]) => {
    const id = nextId++;
    dispatch({ kind: "add", toast: { id, message, type } });
    setTimeout(() => dispatch({ kind: "remove", id }), 4000);
  }, []);

  const api: ToastAPI = {
    success: (msg) => push(msg, "success"),
    error: (msg) => push(msg, "error"),
    info: (msg) => push(msg, "info"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {ReactDOM.createPortal(
        <div className="toast-stack" role="log" aria-live="assertive" aria-atomic="false">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast--${t.type}`} role="alert">
              {t.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
