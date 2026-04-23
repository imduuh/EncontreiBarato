import { OBA_LOCATION_SEEDS } from "@/lib/oba-locations"

export interface SearchLocationInput {
  city: string
  state: string
  key?: string
}

export interface SupportedLocation extends SearchLocationInput {
  key: string
  label: string
  referenceCep?: string
  enabledMarketIds: string[]
  referenceLocationKey?: string
}

export interface SearchRegion extends SearchLocationInput {
  key: string
  label: string
  normalizedCity: string
  normalizedState: string
  isSupported: boolean
  referenceCep: string | null
  enabledMarketIds: string[]
  referenceLocationKey?: string
  message?: string
}

type RawLocation = SupportedLocation

const CITY_REFERENCE_KEYS: Record<string, string> = {
  "americana|SP": "americana-centro-sp",
  "barueri|SP": "barueri-alphaville-farm-sp",
  "bauru|SP": "bauru-vila-aviacao-sp",
  "brasilia|DF": "brasilia-araucarias-df",
  "campinas|SP": "campinas-galleria-sp",
  "goiania|GO": "goiania-setor-bueno-go",
  "ribeirao preto|SP": "ribeirao-preto-sp",
  "sao paulo|SP": "sao-paulo-moema-sp",
  "sao jose dos campos|SP": "sao-jose-dos-campos-sp",
  "sorocaba|SP": "sorocaba-centro-sp",
}

const BASE_LOCATIONS: RawLocation[] = [
  {
    key: "pocos-de-caldas-mg",
    label: "Poços de Caldas, MG",
    city: "Poços de Caldas",
    state: "MG",
    referenceCep: "37704355",
    enabledMarketIds: ["sanmichel"],
  },
  {
    key: "jau-sp",
    label: "Jau, SP",
    city: "Jau",
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

const OBA_LOCATIONS: RawLocation[] = OBA_LOCATION_SEEDS.map((location) => ({
  key: location.key,
  label: location.label,
  city: location.city,
  state: location.state,
  referenceCep: location.referenceCep,
  enabledMarketIds: location.enabledMarketIds ?? ["oba"],
}))

const RAW_SUPPORTED_LOCATIONS: RawLocation[] = [
  ...BASE_LOCATIONS,
  ...OBA_LOCATIONS,
]

const SUPPORTED_LOCATIONS: SupportedLocation[] = buildSupportedLocations(RAW_SUPPORTED_LOCATIONS)

function buildSupportedLocations(locations: RawLocation[]): SupportedLocation[] {
  const grouped = new Map<string, RawLocation[]>()

  for (const location of locations) {
    const cityKey = getCityStateKey(location.city, location.state)
    const current = grouped.get(cityKey) ?? []
    current.push(location)
    grouped.set(cityKey, current)
  }

  return [...grouped.entries()]
    .map(([cityStateKey, group]) => {
      const preferredRawLocation = pickRepresentativeLocation(cityStateKey, group)
      const [city, state] = cityStateKey.split("|")
      const enabledMarketIds = [...new Set(group.flatMap((location) => location.enabledMarketIds))].sort()

      return {
        key: `${normalizeCity(city)}-${normalizeState(state)}`,
        label: `${preferredRawLocation.city}, ${preferredRawLocation.state}`,
        city: preferredRawLocation.city,
        state: preferredRawLocation.state,
        referenceCep: preferredRawLocation.referenceCep,
        enabledMarketIds,
        referenceLocationKey: preferredRawLocation.key,
      }
    })
    .sort((a, b) => {
      if (a.state !== b.state) {
        return a.state.localeCompare(b.state, "pt-BR")
      }

      if (a.city === "Bauru" && a.state === "SP") {
        return -1
      }

      if (b.city === "Bauru" && b.state === "SP") {
        return 1
      }

      return a.city.localeCompare(b.city, "pt-BR")
    })
}

function pickRepresentativeLocation(cityStateKey: string, locations: RawLocation[]): RawLocation {
  const preferredKey = CITY_REFERENCE_KEYS[cityStateKey]
  if (preferredKey) {
    const preferredLocation = locations.find((location) => location.key === preferredKey)
    if (preferredLocation) {
      return preferredLocation
    }
  }

  const obaLocation = locations.find((location) => location.enabledMarketIds.includes("oba"))
  return obaLocation ?? locations[0]
}

function formatSupportedLocationsSummary(): string {
  return `${SUPPORTED_LOCATIONS.length} cidades`
}

function getCityStateKey(city: string, state: string): string {
  return `${normalizeCity(city)}|${normalizeState(state)}`
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
  if (input.key) {
    const supportedByKey = SUPPORTED_LOCATIONS.find((location) => location.key === input.key)

    if (supportedByKey) {
      return {
        ...supportedByKey,
        normalizedCity: normalizeCity(supportedByKey.city),
        normalizedState: normalizeState(supportedByKey.state),
        isSupported: true,
        referenceCep: supportedByKey.referenceCep || null,
      }
    }
  }

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
    message: `Ainda nao atendemos ${cityLabel} - ${stateLabel}. No momento, o comparador possui ${formatSupportedLocationsSummary()} habilitadas.`,
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
    .sort((a, b) => {
      if (a === "Bauru" && normalizedState === "SP") {
        return -1
      }

      if (b === "Bauru" && normalizedState === "SP") {
        return 1
      }

      return a.localeCompare(b, "pt-BR")
    })
}

export function getSupportedLocationsByState(state: string): SupportedLocation[] {
  const normalizedState = normalizeState(state)

  return SUPPORTED_LOCATIONS
    .filter((location) => normalizeState(location.state) === normalizedState)
    .sort((a, b) => {
      if (a.city === "Bauru" && normalizedState === "SP") {
        return -1
      }

      if (b.city === "Bauru" && normalizedState === "SP") {
        return 1
      }

      return a.city.localeCompare(b.city, "pt-BR")
    })
}
