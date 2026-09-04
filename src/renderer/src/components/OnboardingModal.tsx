import React, { useState } from 'react';
import { ArrowRight, Check, Shield, Wifi, ClipboardList } from 'lucide-react';
import { translations } from '../i18n/translations';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (settings: { enableHistory: boolean; enableLanSync: boolean }) => void;
  t: typeof translations['en'];
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
  t,
}) => {
  const [step, setStep] = useState<number>(1);
  const [enableHistory, setEnableHistory] = useState<boolean>(true);
  const ot = t.onboarding;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-md rounded-2xl glass-modal overflow-hidden p-6 text-center animate-slide-up border border-zinc-700/60 shadow-2xl">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          <div
            className={`h-1.5 rounded-full transition-all ${
              step === 1 ? 'w-6 bg-indigo-500' : 'w-1.5 bg-zinc-700'
            }`}
          ></div>
          <div
            className={`h-1.5 rounded-full transition-all ${
              step === 2 ? 'w-6 bg-indigo-500' : 'w-1.5 bg-zinc-700'
            }`}
          ></div>
          <div
            className={`h-1.5 rounded-full transition-all ${
              step === 3 ? 'w-6 bg-indigo-500' : 'w-1.5 bg-zinc-700'
            }`}
          ></div>
        </div>

        {/* STEP 1: WELCOME */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto shadow-glow shadow-indigo-500/30 border border-indigo-500/40 bg-zinc-900">
              <img src="/icon.png" alt="XClip Logo" className="w-full h-full object-cover" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-zinc-100">{ot.step1Title}</h2>
              <p className="text-sm font-semibold text-indigo-400">{ot.step1Subtitle}</p>
              <p className="text-xs text-zinc-400 mt-2 max-w-xs mx-auto">
                {ot.step1Desc}
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={() => setStep(2)}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
              >
                <span>{ot.getStarted}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CLIPBOARD HISTORY */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-indigo-400">
              <ClipboardList className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-zinc-100">{ot.step2Title}</h2>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                {ot.step2Desc}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-left text-xs text-zinc-400 space-y-1.5 max-w-xs mx-auto">
              <div className="flex items-center gap-2 text-zinc-300">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{ot.step2Feature1}</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{ot.step2Feature2}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => {
                  setEnableHistory(false);
                  setStep(3);
                }}
                className="w-1/2 py-2.5 px-4 rounded-xl text-zinc-400 hover:bg-zinc-800 text-xs font-medium transition-colors"
              >
                {ot.skip}
              </button>
              <button
                onClick={() => {
                  setEnableHistory(true);
                  setStep(3);
                }}
                className="w-1/2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                {ot.enable}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: LAN SYNC */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-emerald-400">
              <Wifi className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-zinc-100">{ot.step3Title}</h2>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                {ot.step3Desc}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-left text-xs text-zinc-400 space-y-1.5 max-w-xs mx-auto">
              <div className="flex items-center gap-2 text-zinc-300">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>{ot.step3Feature1}</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>{ot.step3Feature2}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => {
                  onComplete({ enableHistory, enableLanSync: false });
                }}
                className="w-1/2 py-2.5 px-4 rounded-xl text-zinc-400 hover:bg-zinc-800 text-xs font-medium transition-colors"
              >
                {ot.later}
              </button>
              <button
                onClick={() => {
                  onComplete({ enableHistory, enableLanSync: true });
                }}
                className="w-1/2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                {ot.enableLanSync}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
