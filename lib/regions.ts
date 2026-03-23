export interface SearchLocationInput {
  city: string
  state: string
}

export interface SupportedLocation extends SearchLocationInput {
  key: string
  label: string
  referenceCep?: string
  enabledMarketIds: string[]
}

export interface SearchRegion extends SearchLocationInput {
  key: string
  label: string
  normalizedCity: string
  normalizedState: string
  isSupported: boolean
  referenceCep: string | null
  enabledMarketIds: string[]
  message?: string
}

const SUPPORTED_LOCATIONS: SupportedLocation[] = [
  {
    key: "bauru-sp",
    label: "Bauru, SP",
    city: "Bauru",
    state: "SP",
    referenceCep: "17014900",
    enabledMarketIds: ["barracao", "tenda", "samsclub", "tauste", "confianca", "atacadao"],
  },
  {
    key: "jau-sp",
    label: "Jaú, SP",
    city: "Jaú",
    state: "SP",
    referenceCep: "17201900",
    enabledMarketIds: ["barracao"],
  },
  {
    key: "pederneiras-sp",
    label: "Pederneiras, SP",
    city: "Pederneiras",
    state: "SP",
    referenceCep: "17280065",
    enabledMarketIds: ["barracao"],
  },
  {
    key: "potunduva-sp",
    label: "Potunduva, SP",
    city: "Potunduva",
    state: "SP",
    referenceCep: "17201900",
    enabledMarketIds: ["barracao"],
  },
  {
    key: "arealva-sp",
    label: "Arealva, SP",
    city: "Arealva",
    state: "SP",
    referenceCep: "17160021",
    enabledMarketIds: ["barracao"],
  },
]

function formatSupportedLocationsList(): string {
  return SUPPORTED_LOCATIONS.map((location) => location.label).join(", ")
}

export function normalizeCity(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

export function normalizeState(value: string): string {
  return value.trim().toUpperCase()
}

export function resolveSearchRegion(input: SearchLocationInput): SearchRegion {
  const normalizedCity = normalizeCity(input.city)
  const normalizedState = normalizeState(input.state)

  const supportedLocation = SUPPORTED_LOCATIONS.find((location) => (
    normalizeCity(location.city) === normalizedCity
    && normalizeState(location.state) === normalizedState
  ))

  if (supportedLocation) {
    return {
      ...supportedLocation,
      normalizedCity,
      normalizedState,
      isSupported: true,
      referenceCep: supportedLocation.referenceCep || null,
    }
  }

  const stateLabel = normalizedState || "UF nao informada"
  const cityLabel = input.city.trim() || "cidade nao informada"

  return {
    city: input.city.trim(),
    state: normalizedState,
    key: `${normalizedCity || "unknown-city"}-${normalizedState || "unknown-state"}`,
    label: `${cityLabel}, ${stateLabel}`,
    normalizedCity,
    normalizedState,
    isSupported: false,
    referenceCep: null,
    enabledMarketIds: [],
    message: `Ainda nâo atendemos ${cityLabel} - ${stateLabel}. No momento, as localidades habilitadas sâo: ${formatSupportedLocationsList()}.`,
  }
}

export function getSupportedLocations(): SupportedLocation[] {
  return SUPPORTED_LOCATIONS
}

export function getSupportedStates(): string[] {
  return [...new Set(SUPPORTED_LOCATIONS.map((location) => location.state))].sort()
}

export function getSupportedCitiesByState(state: string): string[] {
  const normalizedState = normalizeState(state)

  return SUPPORTED_LOCATIONS
    .filter((location) => normalizeState(location.state) === normalizedState)
    .map((location) => location.city)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
}
