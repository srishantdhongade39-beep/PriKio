import { PDFDocument } from 'pdf-lib'

/**
 * Fast client-side page count extraction for PDFs using pdf-lib with regex fallback.
 */
export async function getPdfPageCount(file: File | Blob | ArrayBuffer): Promise<number> {
  try {
    const arrayBuffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
    const count = pdfDoc.getPageCount()
    return count > 0 ? count : 1
  } catch (err) {
    console.warn("pdf-lib page count parsing fallback:", err)
    try {
      const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
      const text = new TextDecoder('latin1').decode(buffer)
      const matches = text.match(/\/Type\s*\/Page\b/g)
      return matches && matches.length > 0 ? matches.length : 1
    } catch {
      return 1
    }
  }
}

/**
 * Converts image files (JPG, PNG, JPEG, WEBP) directly into a standardized A4 PDF Blob on the client.
 * This skips server-side ConvertAPI network overhead completely and executes in ~20-50ms.
 */
export async function convertImageToPdfBlob(file: File): Promise<{ blob: Blob; fileName: string; pageCount: number }> {
  try {
    const pdfDoc = await PDFDocument.create()
    let arrayBuffer = await file.arrayBuffer()
    
    const isPng = file.type === 'image/png' || /\.png$/i.test(file.name)
    const isJpg = file.type === 'image/jpeg' || file.type === 'image/jpg' || /\.(jpe?g)$/i.test(file.name)
    
    let image: any
    
    if (isPng) {
      image = await pdfDoc.embedPng(arrayBuffer)
    } else if (isJpg) {
      image = await pdfDoc.embedJpg(arrayBuffer)
    } else {
      // For webp or other image formats, convert to PNG via offscreen canvas first
      const pngBlob = await convertImageToCanvasPng(file)
      arrayBuffer = await pngBlob.arrayBuffer()
      image = await pdfDoc.embedPng(arrayBuffer)
    }
    
    // Standard A4 dimensions in points: 595.28 x 841.89
    const a4Width = 595.28
    const a4Height = 841.89
    
    const margin = 20
    const maxWidth = a4Width - margin * 2
    const maxHeight = a4Height - margin * 2
    
    const imgWidth = image.width
    const imgHeight = image.height
    
    // Scale proportionally to fit on A4
    const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1)
    const scaledWidth = imgWidth * scale
    const scaledHeight = imgHeight * scale
    
    const x = (a4Width - scaledWidth) / 2
    const y = (a4Height - scaledHeight) / 2
    
    const page = pdfDoc.addPage([a4Width, a4Height])
    page.drawImage(image, {
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
    })
    
    const pdfBytes = await pdfDoc.save()
    const pdfBlob = new Blob([pdfBytes as any], { type: 'application/pdf' })
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
    const pdfFileName = `${baseName}.pdf`
    
    return {
      blob: pdfBlob,
      fileName: pdfFileName,
      pageCount: 1
    }
  } catch (error) {
    console.error("Client-side image-to-PDF conversion error:", error)
    // Fallback: return raw blob as-is if canvas/pdf embedding fails
    return {
      blob: file,
      fileName: file.name,
      pageCount: 1
    }
  }
}

/**
 * Helper to convert unusual image formats to standard PNG using HTML5 Canvas.
 */
function convertImageToCanvasPng(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error("Canvas context unavailable"))
        return
      }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Canvas toBlob failed"))
      }, 'image/png')
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}
