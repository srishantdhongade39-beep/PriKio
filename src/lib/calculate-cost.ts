export interface CostParams {
  files: { pageCount: number; pageRange: string }[]
  colorMode: 'bw' | 'color' | 'color-glossy'
  sides: 'simplex' | 'duplex'
  copies: number
  role?: string
}

export interface CostResult {
  sheetCount: number
  baseCost: number
  serviceFee: number
  discount: number
  total: number
}

function parsePageRange(rangeStr: string, totalPages: number): number {
  if (!rangeStr || rangeStr.toLowerCase() === 'all') return totalPages

  const pages = new Set<number>()
  const parts = rangeStr.split(',')
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number)
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          if (i >= 1 && i <= totalPages) pages.add(i)
        }
      }
    } else {
      const p = Number(part)
      if (!isNaN(p) && p >= 1 && p <= totalPages) pages.add(p)
    }
  }

  return pages.size > 0 ? pages.size : totalPages
}

export function calculateCost(params: CostParams): CostResult {
  let totalSheets = 0

  for (const file of params.files) {
    const actualPages = parsePageRange(file.pageRange, file.pageCount)
    if (params.sides === 'duplex') {
      totalSheets += Math.ceil(actualPages / 2)
    } else {
      totalSheets += actualPages
    }
  }

  totalSheets = totalSheets * params.copies

  let ratePerSheet = 2.00 // bw simplex
  if (params.colorMode === 'bw' && params.sides === 'duplex') ratePerSheet = 1.75
  else if (params.colorMode === 'color') ratePerSheet = 8.00
  else if (params.colorMode === 'color-glossy') ratePerSheet = 15.00

  const baseCost = totalSheets * ratePerSheet
  const serviceFee = 2.00

  let total = baseCost + serviceFee
  let discount = 0

  if (params.role === 'faculty') {
    discount = total * 0.10
    total -= discount
  }

  return {
    sheetCount: totalSheets,
    baseCost: Number(baseCost.toFixed(2)),
    serviceFee: Number(serviceFee.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    total: Number(total.toFixed(2))
  }
}
