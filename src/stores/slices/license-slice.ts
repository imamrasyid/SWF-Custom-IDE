import { StateCreator } from 'zustand'
import type { AppState } from '../app-store'

export interface LicenseSlice {
  licenseStatus: {
    isValid: boolean
    isActivated: boolean
    licenseId: string | null
    licenseType: string | null
    features: string[]
    activatedAt: number | null
    error: string | null
  }
  licenseInfo: {
    licenseId: string | null
    type: string | null
    features: string[]
    activatedAt: number | null
    deviceBound: boolean
  }
  licenseLoading: boolean
  showActivationScreen: boolean

  refreshLicenseStatus: () => Promise<void>
  activateLicenseKey: (key: string) => Promise<{ success: boolean; error: string | null }>
  deactivateLicenseKey: () => Promise<boolean>
  setShowActivationScreen: (show: boolean) => void
}

const DEFAULT_STATUS = {
  isValid: false,
  isActivated: false,
  licenseId: null,
  licenseType: null,
  features: [],
  activatedAt: null,
  error: null,
}

const DEFAULT_INFO = {
  licenseId: null,
  type: null,
  features: [],
  activatedAt: null,
  deviceBound: false,
}

export const createLicenseSlice: StateCreator<AppState, [], [], LicenseSlice> = (set) => ({
  licenseStatus: { ...DEFAULT_STATUS },
  licenseInfo: { ...DEFAULT_INFO },
  licenseLoading: true,
  showActivationScreen: false,

  refreshLicenseStatus: async () => {
    try {
      set({ licenseLoading: true })
      const status = await window.electronAPI.getLicenseStatus()
      const info = await window.electronAPI.getLicenseInfo()
      set({
        licenseStatus: status,
        licenseInfo: info,
        licenseLoading: false,
        showActivationScreen: !status.isValid,
      })
    } catch {
      set({
        licenseStatus: { ...DEFAULT_STATUS },
        licenseInfo: { ...DEFAULT_INFO },
        licenseLoading: false,
        showActivationScreen: true,
      })
    }
  },

  activateLicenseKey: async (key: string) => {
    try {
      const result = await window.electronAPI.activateLicense(key)
      if (result.success) {
        const status = await window.electronAPI.getLicenseStatus()
        const info = await window.electronAPI.getLicenseInfo()
        set({
          licenseStatus: status,
          licenseInfo: info,
          showActivationScreen: false,
        })
      }
      return result
    } catch {
      return { success: false, error: 'Activation failed unexpectedly' }
    }
  },

  deactivateLicenseKey: async () => {
    try {
      const result = await window.electronAPI.deactivateLicense()
      if (result) {
        set({
          licenseStatus: { ...DEFAULT_STATUS },
          licenseInfo: { ...DEFAULT_INFO },
          showActivationScreen: true,
        })
      }
      return result
    } catch {
      return false
    }
  },

  setShowActivationScreen: (show: boolean) => {
    set({ showActivationScreen: show })
  },
})
