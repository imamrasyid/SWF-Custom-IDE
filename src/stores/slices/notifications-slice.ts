import type { StateCreator } from 'zustand'
import type { AppState, AppNotification } from '../app-store'

export interface NotificationsSlice {
  notifications: AppNotification[]
  addNotification: (message: string, severity: AppNotification['severity']) => void
  clearNotifications: () => void
  markNotificationsAsRead: () => void
}

export const createNotificationsSlice: StateCreator<AppState, [], [], NotificationsSlice> = (set) => ({
  notifications: [],
  addNotification: (message, severity) => set((state) => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substring(7),
      message,
      severity,
      timestamp: Date.now(),
      read: false
    }
    // Limit to 50 notifications
    return { notifications: [newNotif, ...state.notifications].slice(0, 50) }
  }),
  clearNotifications: () => set({ notifications: [] }),
  markNotificationsAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true }))
  }))
})
