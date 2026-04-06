import { create } from 'zustand';
import type {
  ConversationMessage,
  PanelType,
  MindFlowSettings,
} from '../core/types';
import { KnowledgeGraph } from '../core/graph/KnowledgeGraph';
import { AIExtractor } from '../core/extraction/AIExtractor';

interface MindFlowStore {
  graph: KnowledgeGraph;
  aiExtractor: AIExtractor | null;
  messages: ConversationMessage[];
  markdownTree: string;
  generating: boolean;
  aiNotes: string;

  sidebarOpen: boolean;
  activePanel: PanelType;
  settings: MindFlowSettings;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActivePanel: (panel: PanelType) => void;
  updateMessages: (messages: ConversationMessage[]) => void;
  generateMindMap: () => Promise<void>;
  updateSettings: (settings: Partial<MindFlowSettings>) => void;
  loadSettings: () => Promise<void>;
  reset: () => void;
}

export const useMindFlowStore = create<MindFlowStore>(
  (set, get) => ({
    graph: new KnowledgeGraph(),
    aiExtractor: null,
    messages: [],
    markdownTree: '',
    generating: false,
    aiNotes: '',

    sidebarOpen: false,
    activePanel: 'mindmap',
    settings: {
      autoExpand: true,
      theme: 'auto',
      exportFormat: 'obsidian',
      extractionMode: 'api',
      apiProvider: 'anthropic',
    },

    toggleSidebar: () =>
      set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    setSidebarOpen: (open) => set({ sidebarOpen: open }),

    setActivePanel: (panel) => set({ activePanel: panel }),

    updateMessages: (messages) => {
      set({ messages });
    },

    generateMindMap: async () => {
      const { messages, settings } = get();
      if (messages.length === 0) {
        return;
      }

      set({ generating: true });

      const graph = new KnowledgeGraph();
      let tree: string | null = null;

      try {
        const aiExtractor = new AIExtractor(settings.apiProvider);
        tree = await aiExtractor.generateMarkdownTree(messages);
        set({ aiExtractor });
      } catch (e) {
        // Silent fail
      }

      set({
        graph,
        markdownTree: tree ?? '',
        generating: false,
        aiNotes: '',
      });
    },

    updateSettings: (partial) => {
      set((state) => {
        const newSettings = { ...state.settings, ...partial };
        const providerChanged = partial.apiProvider && partial.apiProvider !== state.settings.apiProvider;
        return {
          settings: newSettings,
          aiExtractor: providerChanged ? null : state.aiExtractor,
        };
      });
      // Persist to chrome.storage
      try {
        const { settings } = get();
        chrome.storage.local.set({
          mindflow_api_provider: settings.apiProvider,
        });
      } catch { /* not in extension context */ }
    },

    loadSettings: async () => {
      try {
        const result = await chrome.storage.local.get([
          'mindflow_api_provider',
        ]);
        set((state) => ({
          settings: {
            ...state.settings,
            apiProvider: result.mindflow_api_provider ?? 'anthropic',
          },
        }));
      } catch { /* not in extension context */ }
    },

    reset: () =>
      set({
        graph: new KnowledgeGraph(),
        aiExtractor: null,
        messages: [],
        markdownTree: '# MindFlow\n## Waiting for conversation...',
      }),
  })
);
