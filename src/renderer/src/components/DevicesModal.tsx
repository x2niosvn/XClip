import React, { useState } from 'react';
import {
  X,
  Laptop,
  CheckCircle2,
  ShieldCheck,
  Trash2,
  Wifi,
  Key,
} from 'lucide-react';
import { Device } from '../../../shared/types';
import { translations } from '../i18n/translations';

interface DevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  discoveredDevices: Device[];
  trustedDevices: Device[];
  localInfo: { id: string; name: string; port: number };
  onInitiatePairing: (deviceId: string) => Promise<{ success: boolean; code?: string; error?: string }>;
  onConfirmPairing: (deviceId: string, code: string) => Promise<boolean>;
  onCancelPairing: (deviceId: string) => Promise<boolean>;
  onRemoveDevice: (deviceId: string) => Promise<boolean>;
  incomingPairing: { deviceId: string; deviceName: string; code: string } | null;
  onDismissIncomingPairing: () => void;
  t: typeof translations['en'];
}

export const DevicesModal: React.FC<DevicesModalProps> = ({
  isOpen,
  onClose,
  discoveredDevices,
  trustedDevices,
  localInfo,
  onInitiatePairing,
  onConfirmPairing,
  onCancelPairing,
  onRemoveDevice,
  incomingPairing,
  onDismissIncomingPairing,
  t,
}) => {
  const [pairingDeviceId, setPairingDeviceId] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isPairingLoading, setIsPairingLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartPairing = async (device: Device) => {
    setPairingDeviceId(device.id);
    setIsPairingLoading(true);
    setErrorMessage(null);

    const res = await onInitiatePairing(device.id);
    setIsPairingLoading(false);

    if (res.success && res.code) {
      setGeneratedCode(res.code);
    } else {
      setErrorMessage(res.error || 'Failed to initiate pairing');
    }
  };

  const handleConfirmIncoming = async () => {
    if (!incomingPairing) return;
    const success = await onConfirmPairing(incomingPairing.deviceId, incomingPairing.code);
    if (success) {
      onDismissIncomingPairing();
    }
  };

  const dt = t.devicesModal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg rounded-xl glass-modal overflow-hidden animate-slide-up border border-zinc-700/60 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 leading-tight">{dt.title}</h2>
              <p className="text-[11px] text-zinc-400">{dt.subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title={dt.cancel}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Incoming Pairing Dialog Overlay */}
          {incomingPairing && (
            <div className="p-4 rounded-xl bg-indigo-950/50 border border-indigo-500/40 shadow-glow shadow-indigo-500/10 animate-fade-in space-y-3">
              <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                {dt.newDeviceFound}
              </div>

              <div>
                <p className="text-sm text-zinc-200 font-medium">
                  💻 <span className="text-white">{incomingPairing.deviceName}</span>
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">{dt.pairPrompt}</p>
              </div>

              <div className="bg-zinc-900/90 rounded-lg p-3 text-center border border-indigo-500/30">
                <span className="text-[11px] text-zinc-400 block mb-1">{dt.pairingCode}</span>
                <span className="text-xl font-bold font-mono tracking-widest text-indigo-300">
                  {incomingPairing.code}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={async () => {
                    await onCancelPairing(incomingPairing.deviceId);
                    onDismissIncomingPairing();
                  }}
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:bg-zinc-800 transition-colors"
                >
                  {dt.cancel}
                </button>
                <button
                  onClick={handleConfirmIncoming}
                  className="px-4 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> {dt.pairDevice}
                </button>
              </div>
            </div>
          )}

          {/* Outgoing Pairing In-Progress Box */}
          {pairingDeviceId && generatedCode && (
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">{dt.pairingInProgress}</span>
                <button
                  onClick={() => {
                    setPairingDeviceId(null);
                    setGeneratedCode(null);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {dt.cancel}
                </button>
              </div>

              <p className="text-xs text-zinc-400">
                {dt.confirmCodePrompt}
              </p>

              <div className="bg-zinc-950 rounded-lg p-3 text-center border border-zinc-800">
                <span className="text-2xl font-bold font-mono tracking-widest text-indigo-400">
                  {generatedCode}
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {errorMessage}
            </div>
          )}

          {/* Local Device Identity */}
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"></div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-200">{localInfo.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                    {t.thisDevice}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {localInfo.id} · Port {localInfo.port}
                </span>
              </div>
            </div>
          </div>

          {/* Paired / Trusted Devices */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
                {dt.pairedDevices} ({trustedDevices.length})
              </span>
            </div>

            {trustedDevices.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-zinc-800 text-center">
                <p className="text-xs text-zinc-500">{dt.noPaired}</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  {dt.noPairedDesc}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {trustedDevices.map((dev) => (
                  <div
                    key={dev.id}
                    className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">{dev.name}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">
                          {dev.id.slice(0, 14)}… · AES-256
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                        {t.settingsModal.pairedCount}
                      </span>
                      <button
                        onClick={async () => {
                          const confirmMsg = dt.confirmRemovePrompt || 'Hủy ghép nối thiết bị này?';
                          if (confirm(`${confirmMsg}\n• ${dev.name}`)) {
                            setRemovingId(dev.id);
                            try {
                              await onRemoveDevice(dev.id);
                            } finally {
                              setRemovingId(null);
                            }
                          }
                        }}
                        disabled={removingId === dev.id}
                        className="p-1.5 rounded-md hover:bg-red-500/20 text-zinc-400 hover:text-red-300 transition-colors disabled:opacity-50"
                        title={dt.removeDevice}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discovered LAN Peers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
                {dt.availableOnLan} ({discoveredDevices.filter((d) => !trustedDevices.some((t) => t.id === d.id)).length})
              </span>
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Wifi className="w-3 h-3 text-indigo-400" />
                <span>{dt.mdnsActive}</span>
              </div>
            </div>

            {discoveredDevices.filter((d) => !trustedDevices.some((t) => t.id === d.id)).length === 0 ? (
              <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 text-center">
                <p className="text-xs text-zinc-400 font-medium">{dt.lookingForDevices}</p>
                <p className="text-[11px] text-zinc-600 mt-1 max-w-sm mx-auto">
                  {dt.lookingForDevicesDesc}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {discoveredDevices
                  .filter((d) => !trustedDevices.some((t) => t.id === d.id))
                  .map((dev) => (
                    <div
                      key={dev.id}
                      className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full border border-zinc-500"></div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-200">{dev.name}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">
                            {dev.ip}:{dev.port} · {dev.id.slice(0, 12)}…
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleStartPairing(dev)}
                        disabled={isPairingLoading}
                        className="px-3 py-1 rounded-md text-xs font-medium bg-zinc-800 hover:bg-indigo-600 text-zinc-200 hover:text-white transition-colors flex items-center gap-1.5"
                      >
                        <Key className="w-3 h-3 text-indigo-400" />
                        {dt.pair}
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between text-[11px] text-zinc-500">
          <span>{dt.lanOnlyNotice}</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
          >
            {dt.done}
          </button>
        </div>
      </div>
    </div>
  );
};
