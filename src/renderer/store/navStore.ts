/**
 * Tiny navigation store — lets any component trigger a view change + 
 * pre-select an artist/album without prop-drilling through AppLayout.
 */
import { create } from 'zustand'
import type { ViewType } from '../types'

interface NavStore {
  view: ViewType
  setView: (v: ViewType) => void
  navigateTo: (v: ViewType) => void   // alias for clarity at call sites
}

export const useNavStore = create<NavStore>((set) => ({
  view: 'artists',
  setView: (v) => set({ view: v }),
  navigateTo: (v) => set({ view: v }),
}))
