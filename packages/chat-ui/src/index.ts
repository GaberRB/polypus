/** Public surface of the shared Polypus chat UI. */
export { Chat } from "./components/Chat.js";
export type { ChatLabels } from "./components/Chat.js";
export { ChoiceCard } from "./components/ChoiceCard.js";
export { ConfirmCard } from "./components/ConfirmCard.js";
export { DiffViewer, isDiff } from "./components/DiffViewer.js";
export { UsageBar } from "./components/UsageBar.js";
export { ControlsBar, MODE_META } from "./components/ControlsBar.js";
export { PolypusMascot } from "./components/PolypusMascot.js";
export { ThinkingBlock } from "./components/ThinkingBlock.js";
export { ModelBrowser } from "./components/ModelBrowser.js";
export {
  reduce,
  initialState,
  lockAsk,
  hasPendingAsk,
  lockConfirm,
  hasPendingConfirm,
  type Msg,
  type ToolItem,
  type AskPrompt,
  type ConfirmPrompt,
  type ChatState,
  type Usage,
} from "./reducer.js";
export type {
  ChatTransport,
  StreamEvent,
  Mode,
  Profile,
  RunControls,
  ModelPrice,
  FileEntry,
  AgentInfo,
  OpenRouterModelInfo,
} from "./transport.js";
