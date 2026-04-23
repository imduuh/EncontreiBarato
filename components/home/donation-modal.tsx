"use client"

import { useCallback, useState } from "react"
import { Copy, HeartHandshake } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const DONATION_PIX_DESCRIPTION = "Doação Encontrei Barato"
const DONATION_PIX_CODE =
  "00020126360014BR.GOV.BCB.PIX0114+55149970408105204000053039865802BR5901N6001C62190515ENCONTREIBARATO63046C03"

type DonationModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DonationModal({ open, onOpenChange }: DonationModalProps) {
  const [pixCopied, setPixCopied] = useState(false)

  const handleCopyPixCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(DONATION_PIX_CODE)
      setPixCopied(true)
      window.setTimeout(() => setPixCopied(false), 2500)
    } catch {
      setPixCopied(false)
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[min(92vw,28rem)] max-w-[min(92vw,28rem)] flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/96 p-0 shadow-[0_30px_120px_-42px_rgba(0,0,0,0.95)]">
        <div className="bg-gradient-to-br from-primary/12 via-slate-950 to-primary/4 px-5 py-5 sm:px-6">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <HeartHandshake className="size-6" />
          </div>

          <DialogHeader className="gap-2 text-left">
            <DialogTitle className="pr-8 text-xl leading-tight text-white">
              Apoie o Encontrei Barato, se fizer sentido para você.
            </DialogTitle>
            <DialogDescription className="text-sm leading-7 text-slate-300">
              Este projeto é mantido de forma voluntária, sem publicidade e sem gerar receita.
              Se ele te ajuda no dia a dia e você quiser colaborar, pode usar o PIX copia e cola
              abaixo.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="rounded-[1.5rem] border border-primary/15 bg-primary/8 p-4">
            <p className="text-sm font-semibold text-white">{DONATION_PIX_DESCRIPTION}</p>
            <p className="mt-1 text-xs leading-6 text-slate-300">
              Copie o código abaixo e conclua a doação no app do seu banco, se quiser contribuir.
            </p>

            <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Código PIX
              </p>
              <p className="mt-2 break-all font-mono text-xs leading-6 text-slate-100">
                {DONATION_PIX_CODE}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-slate-950/88 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={handleCopyPixCode} className="rounded-xl">
              <Copy className="size-4" />
              {pixCopied ? "Código copiado" : "Copiar código PIX"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
