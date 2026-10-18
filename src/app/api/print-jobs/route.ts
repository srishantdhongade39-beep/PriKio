import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parsePageRangeToSet } from '@/lib/pageRangeUtils'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    if (!body.jobId) {
      // Fallback for any old flows
      return NextResponse.json({
        data: { id: `job_dummy_${Date.now()}`, ...body, status: 'pending' }
      })
    }

    const supabase = await createClient()

    // Get the existing print job to preserve storage paths
    const { data: existingJob, error: fetchError } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('id', body.jobId)
      .single()

    if (fetchError || !existingJob) {
      return NextResponse.json({ error: 'Print job not found' }, { status: 404 })
    }

    const existingFilesList: any[] = Array.isArray(existingJob.files) ? existingJob.files : []

    // Validate file formats before processing
    for (const bodyFile of (body.files || [])) {
      const ext = bodyFile.fileName?.split('.').pop()?.toLowerCase();
      if (ext !== 'pdf' && ext !== 'jpg' && ext !== 'jpeg' && ext !== 'png' && ext !== 'webp') {
        return NextResponse.json(
          { error: `File ${bodyFile.fileName} is not a supported format. Please upload a PDF or Image.` },
          { status: 400 }
        );
      }
    }

    // Build the new files array from the body payload which contains all uploaded files
    const newFiles = (body.files || []).map((bodyFile: any) => {
      const fileCopies = Math.max(1, bodyFile.copies || body.copies || 1)
      const fileColorMode = (bodyFile.colorMode || body.colorMode) === 'color' ? 'Color' : 'B&W'
      const fileSides = (bodyFile.layout || bodyFile.sides || body.sides) === 'duplex' ? 'Double' : 'Single'
      const fileOrientation = (bodyFile.orientation || body.orientation || 'portrait').toLowerCase() === 'landscape' ? 'Landscape' : 'Portrait'

      // Problem #16: Flexible file matching by file_id, storage_path, or base filename
      const existingFile = existingFilesList.find((f: any) =>
        (f.file_id && (f.file_id === bodyFile.id || f.file_id === bodyFile.file_id)) ||
        f.filename === bodyFile.fileName ||
        (f.storage_path && (bodyFile.storagePath || bodyFile.storage_path) && (f.storage_path === bodyFile.storagePath || f.storage_path === bodyFile.storage_path)) ||
        (f.filename && bodyFile.fileName && f.filename.split('.')[0] === bodyFile.fileName.split('.')[0])
      )

      // Problem #16: Safe storage path resolution checking all camelCase & snake_case variants
      const rawStoragePath = existingFile?.storage_path || bodyFile.storagePath || bodyFile.storage_path || ''
      const cleanStoragePath = rawStoragePath ? rawStoragePath.replace(/[^a-zA-Z0-9.\-\/_]/g, '_') : ''

      // Problem #18: Accurate per-file subtotal_paise calculation
      const nUp = bodyFile.pages_per_sheet || bodyFile.pagesPerSheet || 1
      const isRepeat = Boolean(bodyFile.repeat_on_sheet || bodyFile.repeatOnSheet || false) && nUp > 1
      const sidesPerSheet = fileSides === 'Double' ? 2 : 1
      const pageRangeStr = bodyFile.pageRange || bodyFile.pagesToPrint || 'All'
      const docPageCount = bodyFile.pageCount || existingFile?.page_count || 1
      const selectedPagesCount = parsePageRangeToSet(pageRangeStr, docPageCount).size
      const sheetsPerCopy = isRepeat
        ? Math.max(1, Math.ceil(selectedPagesCount / sidesPerSheet))
        : Math.max(1, Math.ceil(selectedPagesCount / (nUp * sidesPerSheet)))
      const totalSheets = sheetsPerCopy * fileCopies
      const pricePerSheet = fileColorMode === 'Color' ? 3 : 1
      const accurateCostPaise = totalSheets * pricePerSheet * 100

      const subtotalPaise = typeof bodyFile.cost === 'number'
        ? Math.round(bodyFile.cost * 100)
        : accurateCostPaise

      return {
        file_id: existingFile?.file_id || bodyFile.id || crypto.randomUUID(),
        filename: bodyFile.fileName,
        storage_path: cleanStoragePath,
        pages_selected: pageRangeStr,
        copies: fileCopies,
        color_mode: fileColorMode,
        paper_size: 'A4',
        sides: fileSides,
        orientation: fileOrientation,
        pages_per_sheet: nUp,
        repeat_on_sheet: isRepeat,
        subtotal_paise: subtotalPaise
      }
    })

    const totalCalculatedPaise = newFiles.reduce((acc: number, f: any) => acc + (f.subtotal_paise || 0), 0) + 200 // + 200 paise kiosk platform fee

    const finalTotalAmountPaise = typeof body.total_amount === 'number'
      ? Math.round(body.total_amount * 100)
      : (totalCalculatedPaise || existingJob.total_amount_paise)

    const { data: updatedJob, error: updateError } = await supabase
      .from('print_jobs')
      .update({
         files: newFiles,
         total_amount_paise: finalTotalAmountPaise
      })
      .eq('id', body.jobId)
      .select()
      .single()

    if (updateError) {
      throw new Error(updateError.message)
    }
    
    return NextResponse.json({
      data: updatedJob
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return NextResponse.json({ data: [] })
}
