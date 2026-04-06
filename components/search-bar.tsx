"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MapPin, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getSupportedLocationsByState, getSupportedStates } from "@/lib/regions"

interface SearchBarProps {
  onSearch: (params: { query: string; city: string; state: string; locationKey: string }) => void
  isLoading: boolean
}

const supportedStates = getSupportedStates()

function getDefaultState(): string {
  return supportedStates.includes("SP") ? "SP" : (supportedStates[0] || "")
}

function getDefaultCity(state: string): string {
  const locations = getSupportedLocationsByState(state)
  const bauruLocation = locations.find((location) => location.city === "Bauru")
  return bauruLocation?.city || locations[0]?.city || ""
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [state, setState] = useState(getDefaultState)
  const supportedLocations = useMemo(() => getSupportedLocationsByState(state), [state])
  const [city, setCity] = useState(() => getDefaultCity(getDefaultState()))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!supportedLocations.some((location) => location.city === city)) {
      setCity(getDefaultCity(state))
    }
  }, [city, state, supportedLocations])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmedQuery = query.trim()
    const trimmedState = state.trim().toUpperCase()
    const selectedLocation =
      supportedLocations.find((location) => location.city === city) || supportedLocations[0]

    if (trimmedQuery.length >= 3 && selectedLocation && trimmedState.length === 2) {
      onSearch({
        query: trimmedQuery,
        city: selectedLocation.city,
        state: trimmedState,
        locationKey: selectedLocation.key,
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col gap-2">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Buscar produto (ex: Nutella 650g)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-10 text-base"
            disabled={isLoading}
            autoFocus
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={isLoading || query.trim().length < 3 || !city}
        >
          {isLoading ? "Buscando..." : "Comparar"}
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_104px] gap-3">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={isLoading || supportedLocations.length === 0}
            className="h-10 w-full rounded-lg border border-input bg-transparent pl-10 pr-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
            aria-label="Cidade"
          >
            {supportedLocations.map((location) => (
              <option key={location.key} value={location.city}>
                {location.city}
              </option>
            ))}
          </select>
        </div>

        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          disabled={isLoading || supportedStates.length === 0}
          className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
          aria-label="Estado"
        >
          {supportedStates.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      </div>
    </form>
  )
}
