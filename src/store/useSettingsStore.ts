import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  apiKey: string;
  baseUrl: string;
  model: string;
  isDialogOpen: boolean;
  setSettings: (settings: Partial<Omit<SettingsState, 'isDialogOpen' | 'setSettings' | 'openDialog' | 'closeDialog'>>) => void;
  openDialog: () => void;
  closeDialog: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      isDialogOpen: false,
      setSettings: (settings) => set((state) => ({ ...state, ...settings })),
      openDialog: () => set({ isDialogOpen: true }),
      closeDialog: () => set({ isDialogOpen: false }),
    }),
    {
      name: 'northpath-settings',
      partialize: (state) => ({
        apiKey: state.apiKey,
        baseUrl: state.baseUrl,
        model: state.model,
      }),
    }
  )
);