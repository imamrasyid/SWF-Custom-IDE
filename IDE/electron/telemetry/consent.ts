import Store from 'electron-store'

const store = new Store<{ telemetryOptOut: boolean }>({
  name: 'wayangide-settings',
  defaults: { telemetryOptOut: false },
})

export function isTelemetryOptOut(): boolean {
  return store.get('telemetryOptOut', false)
}

export function setTelemetryOptOut(optOut: boolean): void {
  store.set('telemetryOptOut', optOut)
}

export function getTelemetryConsent(): boolean {
  return !isTelemetryOptOut()
}
