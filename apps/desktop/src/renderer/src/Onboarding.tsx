import { useState } from "react";
import { PolypusMascot } from "./PolypusMascot";

const DONE_KEY = "polypus.onboardingDone";

export function needsOnboarding(): boolean {
  return localStorage.getItem(DONE_KEY) === null;
}

export function Onboarding({ onDone }: { onDone: () => void }): JSX.Element {
  const [step, setStep] = useState(0);
  const totalSteps = 3;

  const finish = (): void => {
    localStorage.setItem(DONE_KEY, "1");
    onDone();
  };

  const chooseFolder = async (): Promise<void> => {
    await window.polypus?.chooseFolder();
    finish();
  };

  return (
    <div className="onboarding-overlay">
      <div
        className="onboarding-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        {/* Step indicator */}
        <div className="onboarding-steps" aria-label={`Passo ${step + 1} de ${totalSteps}`}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`onboarding-step-dot${i === step ? " onboarding-step-dot--active" : ""}`}
            />
          ))}
        </div>

        {step === 0 && (
          <>
            <PolypusMascot size="lg" state="idle" />
            <h2 id="onboarding-title" className="onboarding-title">
              Bem-vindo ao Polypus 🐙
            </h2>
            <p className="onboarding-desc">
              Um agente de IA local que funciona com qualquer modelo — Anthropic, OpenRouter, Ollama.
              Sem telemetria. Seus dados ficam aqui.
            </p>
            <div className="onboarding-actions">
              <button className="btn-ghost" onClick={finish}>Pular</button>
              <button className="btn" onClick={() => setStep(1)}>Começar →</button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 id="onboarding-title" className="onboarding-title">Configure seu agente</h2>
            <p className="onboarding-desc">
              Adicione sua chave de API nas configurações para começar. Você pode usar OpenRouter
              (acesso a centenas de modelos), Anthropic ou Ollama (local, sem custo).
            </p>
            <div className="onboarding-actions">
              <button className="btn-ghost" onClick={() => setStep(0)}>← Voltar</button>
              <button className="btn" onClick={() => setStep(2)}>Próximo →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 id="onboarding-title" className="onboarding-title">Escolha um projeto</h2>
            <p className="onboarding-desc">
              Selecione a pasta do projeto onde o agente vai trabalhar. Você pode trocar a qualquer
              momento pela barra superior.
            </p>
            <div className="onboarding-actions">
              <button className="btn-ghost" onClick={finish}>Pular</button>
              <button className="btn" onClick={() => void chooseFolder()}>
                📁 Escolher pasta
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
