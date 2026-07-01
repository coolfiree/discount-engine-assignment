import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

function groupTextItemsByLine(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines = []
  const tolerance = 2.5

  for (const item of sorted) {
    const existing = lines.find((line) => Math.abs(line.y - item.y) <= tolerance)
    if (existing) {
      existing.items.push(item)
      existing.y = (existing.y + item.y) / 2
      continue
    }

    lines.push({ y: item.y, items: [item] })
  }

  return lines.map((line) => ({
    y: line.y,
    items: line.items.sort((a, b) => a.x - b.x),
  }))
}

function extractCellText(items, start, end) {
  return items
    .filter((item) => item.x >= start && item.x < end)
    .map((item) => item.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseMoney(text) {
  const match = text.match(/([\d,]+(?:\.\d+)?)/)
  if (!match) return null
  return Number(match[1].replace(/,/g, ''))
}

function splitLineByLargestGaps(lineItems) {
  if (lineItems.length < 4) {
    return null
  }

  const sorted = [...lineItems].sort((a, b) => a.x - b.x)
  const gaps = []

  for (let index = 0; index < sorted.length - 1; index += 1) {
    gaps.push({
      index: index + 1,
      size: sorted[index + 1].x - sorted[index].x,
    })
  }

  const splitPoints = gaps
    .filter((gap) => gap.size > 12)
    .sort((a, b) => b.size - a.size)
    .slice(0, 3)
    .map((gap) => gap.index)
    .sort((a, b) => a - b)

  if (splitPoints.length < 3) {
    return null
  }

  const segments = []
  let startIndex = 0

  for (const splitIndex of splitPoints) {
    segments.push(sorted.slice(startIndex, splitIndex))
    startIndex = splitIndex
  }

  segments.push(sorted.slice(startIndex))

  if (segments.length !== 4 || segments.some((segment) => segment.length === 0)) {
    return null
  }

  return segments.map((segment) => segment.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim())
}

export async function extractCartItemsFromPdf(arrayBuffer) {
  const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  const items = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()

    const textItems = content.items
      .map((item) => ({
        text: item.str.trim(),
        x: item.transform[4],
        y: item.transform[5],
      }))
      .filter((item) => item.text)

    const lines = groupTextItemsByLine(textItems)
    const headerLine = lines.find((line) => {
      const joined = line.items.map((item) => item.text.toLowerCase()).join(' ')
      return joined.includes('product') && joined.includes('brand') && joined.includes('platform') && joined.includes('base')
    })

    if (!headerLine) {
      continue
    }

    const headerItems = headerLine.items
    const baseHeaderItem = headerItems.find((item) => item.text.toLowerCase().includes('base'))
    const columns = {
      product: headerItems.find((item) => item.text.toLowerCase() === 'product')?.x,
      brand: headerItems.find((item) => item.text.toLowerCase() === 'brand')?.x,
      platform: headerItems.find((item) => item.text.toLowerCase() === 'platform')?.x,
      base: baseHeaderItem?.x,
    }

    const orderedColumns = [columns.product, columns.brand, columns.platform, columns.base].filter((value) => value !== undefined)

    if (orderedColumns.length < 4) {
      continue
    }

    const bodyLines = lines.filter((line) => line.y < headerLine.y - 1)

    for (const line of bodyLines) {
      const structuredCells = [
        extractCellText(line.items, orderedColumns[0], orderedColumns[1]),
        extractCellText(line.items, orderedColumns[1], orderedColumns[2]),
        extractCellText(line.items, orderedColumns[2], orderedColumns[3]),
        extractCellText(line.items, orderedColumns[3], Number.POSITIVE_INFINITY),
      ]

      const fallbackCells = splitLineByLargestGaps(line.items)
      const cells = structuredCells.every((cell) => cell) ? structuredCells : fallbackCells

      if (!cells || cells.some((cell) => !cell)) {
        continue
      }

      const basePrice = parseMoney(cells[3])
      if (!basePrice) {
        continue
      }

      items.push({
        itemId: `PDF-${String(items.length + 1).padStart(2, '0')}`,
        product: cells[0],
        brand: cells[1],
        platform: cells[2],
        basePrice: Math.round(basePrice),
      })
    }

    if (items.length > 0) {
      break
    }
  }

  return items
}
