import { create } from 'zustand'

export const useDocumentStore = create((set) => ({
  currentPage: 1,
  setCurrentPage: (currentPage) => set({ currentPage }),
}))
