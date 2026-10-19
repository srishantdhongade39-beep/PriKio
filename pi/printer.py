import logging
import time
import subprocess
import os
import re
import tempfile
import sys
import platform

logger = logging.getLogger(__name__)

_CAPS_CACHE = {}

def tile_image_on_a4(img, pages_per_sheet, is_grayscale=False):
    """
    Tiles an image onto a standard A4 canvas (150 DPI: 1240 x 1754).
    Supports 2-up (2x1), 4-up (2x2), 6-up (3x2), and 9-up (3x3).
    Converts to grayscale if requested.
    """
    from PIL import Image, ImageOps
    A4_W, A4_H = 1240, 1754
    
    if is_grayscale:
        canvas = Image.new("L", (A4_W, A4_H), color=255)
        img = ImageOps.grayscale(img)
    else:
        canvas = Image.new("RGB", (A4_W, A4_H), color=(255, 255, 255))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
            
    if pages_per_sheet == 2:
        cols, rows = 2, 1
    elif pages_per_sheet == 4:
        cols, rows = 2, 2
    elif pages_per_sheet == 9:
        cols, rows = 3, 3
    elif pages_per_sheet == 6:
        cols, rows = 3, 2
    else:
        cols, rows = 1, 1

    cell_w = A4_W // cols
    cell_h = A4_H // rows
    margin = 20

    max_w = max(10, cell_w - margin * 2)
    max_h = max(10, cell_h - margin * 2)

    ratio = min(max_w / img.width, max_h / img.height)
    scaled_w = max(1, int(img.width * ratio))
    scaled_h = max(1, int(img.height * ratio))
    scaled = img.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)

    for r in range(rows):
        for c in range(cols):
            cx = c * cell_w + (cell_w - scaled_w) // 2
            cy = r * cell_h + (cell_h - scaled_h) // 2
            canvas.paste(scaled, (cx, cy))

    return canvas

def parse_page_ranges(range_str, max_pages):
    """
    Parses strings like '1-9', '1,3,5-7' into a sorted list of unique 0-indexed page numbers.
    Excludes out-of-bounds pages.
    """
    if not range_str or str(range_str).strip().lower() in ("all", ""):
        return list(range(max_pages))
    
    pages = set()
    parts = str(range_str).replace(" ", "").split(",")
    for part in parts:
        if not part:
            continue
        if "-" in part:
            subparts = part.split("-")
            if len(subparts) == 2 and subparts[0].isdigit() and subparts[1].isdigit():
                start = int(subparts[0])
                end = int(subparts[1])
                if start <= end:
                    for p in range(start, end + 1):
                        if 1 <= p <= max_pages:
                            pages.add(p - 1)
                else:
                    for p in range(end, start + 1):
                        if 1 <= p <= max_pages:
                            pages.add(p - 1)
        elif part.isdigit():
            p = int(part)
            if 1 <= p <= max_pages:
                pages.add(p - 1)
                
    return sorted(list(pages))

def get_printer_capabilities(printer_name=None):
    """
    Introspects the connected printer using `lpoptions -p <printer> -l`.
    Discovers whether the printer supports Duplex, Color, and the exact PPD option syntax.
    Results are cached in memory for zero-latency lookups.
    """
    if not printer_name:
        printer_name = os.getenv("PRINTER_NAME", "L3250-Series")

    if printer_name in _CAPS_CACHE:
        return _CAPS_CACHE[printer_name]

    caps = {
        "printer_name": printer_name,
        "supports_duplex": False,
        "duplex_flag": None,
        "supports_color": True,
        "color_flag_color": ["-o", "Ink=COLOR", "-o", "print-color-mode=color"],
        "color_flag_mono": ["-o", "Ink=MONO", "-o", "ColorModel=Gray", "-o", "print-color-mode=monochrome"],
        "supports_a4": True,
    }

    if sys.platform != "win32":
        try:
            res = subprocess.run(["lpoptions", "-p", printer_name, "-l"], capture_output=True, text=True)
            if res.returncode == 0:
                output = res.stdout
                output_lower = output.lower()
                
                # 1. Discover Duplex capability & syntax
                has_duplex = False
                for line in output.splitlines():
                    lower = line.lower()
                    if lower.startswith("duplex") or lower.startswith("sides"):
                        if "two-sided" in lower or "duplexnotumble" in lower:
                            caps["supports_duplex"] = True
                            if "two-sided-long-edge" in lower:
                                caps["duplex_flag"] = ["-o", "sides=two-sided-long-edge"]
                            else:
                                caps["duplex_flag"] = ["-o", "Duplex=DuplexNoTumble"]
                            has_duplex = True
                            break
                if not has_duplex:
                    caps["supports_duplex"] = False
                    caps["duplex_flag"] = None

                # 2. Discover Color capability & exact driver syntax (case-insensitive & multi-driver support)
                if "ink" in output_lower and "mono" in output_lower:
                    # Epson ESC/P-R driver (e.g. L3250 Series: *Ink/Ink: COLOR MONO)
                    caps["supports_color"] = "color" in output_lower
                    caps["color_flag_color"] = ["-o", "Ink=COLOR", "-o", "print-color-mode=color"]
                    caps["color_flag_mono"] = ["-o", "Ink=MONO", "-o", "print-color-mode=monochrome"]
                elif "colormodel" in output_lower:
                    # Gutenprint / PostScript driver (e.g. ColorModel: RGB Gray)
                    caps["supports_color"] = "rgb" in output_lower or "cmyk" in output_lower
                    caps["color_flag_color"] = ["-o", "ColorModel=RGB", "-o", "print-color-mode=color"]
                    caps["color_flag_mono"] = ["-o", "ColorModel=Gray", "-o", "ColorModel=Grayscale", "-o", "print-color-mode=monochrome"]
                elif "print-color-mode" in output_lower:
                    # Standard IPP Everywhere driver
                    caps["supports_color"] = "color" in output_lower
                    caps["color_flag_color"] = ["-o", "print-color-mode=color"]
                    caps["color_flag_mono"] = ["-o", "print-color-mode=monochrome"]
                else:
                    caps["supports_color"] = True
                    caps["color_flag_color"] = ["-o", "Ink=COLOR", "-o", "ColorModel=RGB", "-o", "print-color-mode=color"]
                    caps["color_flag_mono"] = ["-o", "Ink=MONO", "-o", "ColorModel=Gray", "-o", "print-color-mode=monochrome"]

                # 3. Discover A4 capability
                caps["supports_a4"] = "a4" in output_lower
                logger.info(f"Discovered Printer Capabilities for {printer_name}: Duplex={caps['supports_duplex']}, Color={caps['supports_color']}")
        except Exception as e:
            logger.warning(f"Could not query printer options via lpoptions: {e}")

    _CAPS_CACHE[printer_name] = caps
    return caps

def print_job(job_id, file_info, supabase_client):
    """
    Downloads the file from Supabase Storage and sends it to the physical printer via CUPS.
    Returns True if successfully spooled, False if failed.
    """
    filename = file_info.get("filename", "document.pdf")
    storage_path = file_info.get("storage_path")
    copies = file_info.get("copies", 1)
    sides = file_info.get("sides", "Single")
    color_mode = file_info.get("color_mode", "B&W")
    orientation = file_info.get("orientation", "Portrait")
    pages_selected = file_info.get("pages_selected", "All")
    pages_per_sheet = int(file_info.get("pages_per_sheet") or file_info.get("number_up") or 1)
    repeat_on_sheet = bool(file_info.get("repeat_on_sheet", False))

    logger.info("============ PRINTING ============")
    logger.info(f"Job ID: {job_id}")
    logger.info(f"Filename: {filename}")
    logger.info(f"Settings: Copies={copies}, Sides={sides}, Color={color_mode}, Orientation={orientation}, Pages={pages_selected}, PagesPerSheet={pages_per_sheet}, RepeatOnSheet={repeat_on_sheet}")
    
    if not storage_path:
        logger.error(f"Missing storage_path in file_info for job {job_id}")
        return False

    # 1. Download the file from Supabase Storage with collision-safe local naming
    safe_name = re.sub(r'[^a-zA-Z0-9.\-_]', '_', filename)
    local_filepath = os.path.join(tempfile.gettempdir(), f"{job_id}_{safe_name}")
    logger.info(f"Downloading {storage_path} to {local_filepath}...")
    
    try:
        response = None
        # Attempt 1: Direct path
        try:
            response = supabase_client.storage.from_('documents').download(storage_path)
        except Exception as e:
            logger.warning(f"Direct download failed ({e}). Retrying with sanitized path...")
            # Attempt 2: Replace spaces and special characters with underscores
            parts = storage_path.split('/')
            if len(parts) > 1:
                alt_storage_path = f"{parts[0]}/{safe_name}"
                logger.info(f"Retrying download with safe path: {alt_storage_path}")
                try:
                    response = supabase_client.storage.from_('documents').download(alt_storage_path)
                except Exception as e2:
                    logger.warning(f"Safe path download failed ({e2}). Querying bucket directory...")
                    # Attempt 3: List files in the job folder to find the actual uploaded file
                    try:
                        file_list = supabase_client.storage.from_('documents').list(parts[0])
                        matched_name = None
                        if file_list and len(file_list) > 0:
                            # Match closest filename in directory
                            ext = os.path.splitext(filename)[1].lower()
                            for item in file_list:
                                item_name = item.get('name', '')
                                if item_name.lower().endswith(ext) or item_name == safe_name:
                                    matched_name = item_name
                                    break
                            if not matched_name:
                                matched_name = file_list[0].get('name')

                            matched_path = f"{parts[0]}/{matched_name}"
                            logger.info(f"Found file in folder: {matched_path}. Downloading...")
                            response = supabase_client.storage.from_('documents').download(matched_path)
                        else:
                            raise e2
                    except Exception:
                        raise e2
            else:
                raise e
        
        # Save locally
        with open(local_filepath, "wb") as f:
            f.write(response)
            
        is_image = filename.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'))
        is_pdf = filename.lower().endswith(('.pdf', '.ps'))
        is_grayscale = color_mode.lower() in ("bw", "b&w", "monochrome", "gray", "grayscale")
        is_tiled_canvas = False
        temp_files = {local_filepath}

        # 1a. Pre-process image (EXIF orientation, software grayscale, and generalized 2/4/9-up canvas tiling)
        if is_image:
            try:
                from PIL import Image, ImageOps
                with Image.open(local_filepath) as img:
                    # Automatically apply EXIF orientation tag from smartphones
                    img = ImageOps.exif_transpose(img)
                    
                    # Auto-rotate to match requested orientation
                    if orientation.lower() == "landscape" and img.height > img.width:
                        img = img.rotate(270, expand=True)
                        logger.info("Rotated portrait image to Landscape orientation.")
                    elif orientation.lower() == "portrait" and img.width > img.height:
                        img = img.rotate(270, expand=True)
                        logger.info("Rotated landscape image to Portrait orientation.")

                    # Generalized Repeat Mode (ID Cards / Tokens):
                    # Directly creates a pre-tiled A4 canvas (2-up, 4-up, 6-up, 9-up)
                    if repeat_on_sheet and pages_per_sheet in (2, 4, 6, 9):
                        tiled_canvas = tile_image_on_a4(img, pages_per_sheet, is_grayscale=is_grayscale)
                        tiled_pdf_path = os.path.splitext(local_filepath)[0] + "_tiled.pdf"
                        tiled_canvas.save(tiled_pdf_path, "PDF", resolution=150.0)
                        temp_files.add(tiled_pdf_path)
                        local_filepath = tiled_pdf_path
                        filename = os.path.basename(tiled_pdf_path)
                        is_image = False
                        is_pdf = True
                        is_tiled_canvas = True
                        pages_selected = "All"
                        logger.info(f"Generated {pages_per_sheet}-up pre-tiled A4 PDF for repeat mode: {local_filepath}")
                    else:
                        # Standard single-page image
                        if is_grayscale:
                            img = ImageOps.grayscale(img)
                            logger.info("Converted image to pure 8-bit Grayscale (mode L).")
                        elif img.mode in ("RGBA", "P"):
                            img = img.convert("RGB")
                        img.save(local_filepath, quality=95)
            except ImportError:
                logger.warning("Pillow not installed! Skipping image pre-processing.")
            except Exception as e:
                logger.warning(f"Error pre-processing image with Pillow: {e}")

        # 1b. Pre-process PDF (Page slicing, Page repetition, and pure DeviceGray conversion)
        if is_pdf:
            # Pre-slice exact requested pages directly in software (eliminates CUPS number-up page-ranges bugs)
            if pages_selected and str(pages_selected).strip().lower() != "all":
                clean_sel = str(pages_selected).strip()
                slice_success = False

                # Method A: pypdf slicing
                try:
                    from pypdf import PdfReader, PdfWriter
                    reader = PdfReader(local_filepath)
                    total_doc_pages = len(reader.pages)
                    selected_indices = parse_page_ranges(clean_sel, total_doc_pages)
                    
                    if 0 < len(selected_indices) < total_doc_pages:
                        writer = PdfWriter()
                        for idx in selected_indices:
                            writer.add_page(reader.pages[idx])
                        
                        sliced_pdf_path = os.path.splitext(local_filepath)[0] + "_sliced.pdf"
                        with open(sliced_pdf_path, "wb") as f_out:
                            writer.write(f_out)
                        
                        temp_files.add(sliced_pdf_path)
                        local_filepath = sliced_pdf_path
                        filename = os.path.basename(sliced_pdf_path)
                        pages_selected = "All"
                        slice_success = True
                        logger.info(f"Pre-sliced PDF from {total_doc_pages} pages down to {len(selected_indices)} pages (pages {clean_sel}): {local_filepath}")
                    elif len(selected_indices) == total_doc_pages:
                        pages_selected = "All"
                        slice_success = True
                except Exception as pypdf_slice_err:
                    logger.warning(f"pypdf slicing failed ({pypdf_slice_err}). Attempting Ghostscript fallback...")

                # Method B: Ghostscript contiguous range slicing fallback
                if not slice_success and sys.platform != "win32":
                    match = re.match(r"^(\d+)-(\d+)$", clean_sel)
                    if match:
                        try:
                            start_p, end_p = match.group(1), match.group(2)
                            sliced_pdf_path = os.path.splitext(local_filepath)[0] + "_sliced.pdf"
                            gs_slice_cmd = [
                                "gs", "-dNOPAUSE", "-dBATCH", "-sDEVICE=pdfwrite",
                                f"-dFirstPage={start_p}", f"-dLastPage={end_p}",
                                f"-sOutputFile={sliced_pdf_path}", local_filepath
                            ]
                            gs_res = subprocess.run(gs_slice_cmd, capture_output=True, text=True, timeout=15)
                            if gs_res.returncode == 0 and os.path.exists(sliced_pdf_path) and os.path.getsize(sliced_pdf_path) > 0:
                                temp_files.add(sliced_pdf_path)
                                local_filepath = sliced_pdf_path
                                filename = os.path.basename(sliced_pdf_path)
                                pages_selected = "All"
                                slice_success = True
                                logger.info(f"Pre-sliced PDF pages {start_p}-{end_p} via Ghostscript: {local_filepath}")
                        except Exception as gs_slice_err:
                            logger.warning(f"Ghostscript page slicing failed: {gs_slice_err}")

            # Multi-page repetition for 1-page PDFs with repeat mode enabled
            if repeat_on_sheet and pages_per_sheet in (2, 4, 6, 9) and not is_tiled_canvas:
                repeated_pdf_path = os.path.splitext(local_filepath)[0] + "_repeated.pdf"
                repeat_success = False

                # Method A: pypdf page duplication
                try:
                    from pypdf import PdfReader, PdfWriter
                    reader = PdfReader(local_filepath)
                    if len(reader.pages) > 0:
                        writer = PdfWriter()
                        target_page = reader.pages[0]
                        for _ in range(pages_per_sheet):
                            writer.add_page(target_page)
                        with open(repeated_pdf_path, "wb") as f_out:
                            writer.write(f_out)
                        temp_files.add(repeated_pdf_path)
                        local_filepath = repeated_pdf_path
                        filename = os.path.basename(repeated_pdf_path)
                        pages_selected = "All"
                        repeat_success = True
                        logger.info(f"Repeated PDF page 1 into {pages_per_sheet} pages via pypdf: {local_filepath}")
                except Exception as pypdf_err:
                    logger.warning(f"pypdf repetition failed ({pypdf_err}). Trying Ghostscript fallback...")

                # Method B: Native Ghostscript duplication (zero python dependencies required)
                if not repeat_success and sys.platform != "win32":
                    try:
                        gs_cmd = ["gs", "-dNOPAUSE", "-dBATCH", "-sDEVICE=pdfwrite", f"-sOutputFile={repeated_pdf_path}"] + [local_filepath] * pages_per_sheet
                        gs_res = subprocess.run(gs_cmd, capture_output=True, text=True, timeout=15)
                        if gs_res.returncode == 0 and os.path.exists(repeated_pdf_path):
                            temp_files.add(repeated_pdf_path)
                            local_filepath = repeated_pdf_path
                            filename = os.path.basename(repeated_pdf_path)
                            pages_selected = "All"
                            repeat_success = True
                            logger.info(f"Repeated PDF page 1 into {pages_per_sheet} pages via Ghostscript: {local_filepath}")
                    except Exception as gs_err:
                        logger.warning(f"Ghostscript repeat failed: {gs_err}")

            # Software Grayscale conversion for PDFs via Ghostscript on Linux
            if is_grayscale and sys.platform != "win32":
                try:
                    gray_pdf_path = os.path.splitext(local_filepath)[0] + "_gray.pdf"
                    gs_gray_cmd = [
                        "gs", "-sDEVICE=pdfwrite", "-dColorConversionStrategy=/Gray",
                        "-dProcessColorModel=/DeviceGray", "-dCompatibilityLevel=1.4",
                        "-dNOPAUSE", "-dBATCH", f"-sOutputFile={gray_pdf_path}", local_filepath
                    ]
                    gs_gray_res = subprocess.run(gs_gray_cmd, capture_output=True, text=True, timeout=15)
                    if gs_gray_res.returncode == 0 and os.path.exists(gray_pdf_path) and os.path.getsize(gray_pdf_path) > 0:
                        temp_files.add(gray_pdf_path)
                        local_filepath = gray_pdf_path
                        filename = os.path.basename(gray_pdf_path)
                        logger.info(f"Converted PDF to pure DeviceGray grayscale via Ghostscript: {local_filepath}")
                except Exception as gs_gray_err:
                    logger.warning(f"Ghostscript PDF grayscale conversion failed: {gs_gray_err}")

        logger.info(f"File ready for spooling: {local_filepath}")
        
        # 2. Build full CUPS options (shared across Windows simulation and Linux execution)
        printer_name = os.getenv("PRINTER_NAME", "L3250-Series")
        caps = get_printer_capabilities(printer_name)

        copies_num = max(1, int(copies) if copies else 1)
        
        # Common options - Strictly locked to standard A4 paper size (Problem #5)
        base_options = ["-n", str(copies_num), "-o", "fit-to-page"]
        if caps.get("supports_a4", True):
            base_options.extend(["-o", "media=A4", "-o", "PageSize=A4"])

        # Number-up (Pages per Sheet: 2, 4, 9) for sequential multi-page documents (skip if canvas was already tiled)
        if pages_per_sheet in (2, 4, 6, 9) and is_pdf and not is_tiled_canvas:
            base_options.extend(["-o", f"number-up={pages_per_sheet}", "-o", "number-up-layout=lrtb"])

        # Orientation
        if orientation.lower() == "landscape":
            base_options.extend(["-o", "landscape"])
        else:
            base_options.extend(["-o", "portrait"])

        # Color Mode using exact discovered syntax
        if is_grayscale or color_mode.lower() in ("bw", "b&w", "monochrome", "gray", "grayscale"):
            color_options = caps["color_flag_mono"]
        elif caps["supports_color"]:
            color_options = caps["color_flag_color"]
        else:
            color_options = caps["color_flag_mono"]

        # Duplex using exact discovered syntax (only if printer has hardware duplex)
        duplex_options = []
        if sides.lower() in ("double", "duplex") and caps["supports_duplex"] and caps["duplex_flag"]:
            duplex_options = caps["duplex_flag"]
        else:
            duplex_options = ["-o", "sides=one-sided"]

        # Page Ranges: strictly valid for multi-page PDFs (Problem #6 & #13 guard)
        page_range_options = []
        if is_pdf and pages_selected and str(pages_selected).lower() != "all":
            clean_range = str(pages_selected).strip()
            # Validate standard CUPS page-ranges format: digits, hyphens, and commas (e.g. "1-3,5,7-9")
            if clean_range and clean_range not in ("1", "1-1"):
                if re.match(r"^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$", clean_range):
                    page_range_options = ["-o", f"page-ranges={clean_range}"]
                else:
                    logger.warning(f"Invalid page-ranges syntax '{clean_range}' for CUPS. Printing all pages safely.")

        primary_cmd = ["lp", "-d", printer_name] + base_options + color_options + duplex_options + page_range_options + [local_filepath]

        # 3. Print depending on OS (Problem #8 Windows Simulation)
        if sys.platform == "win32":
            logger.info("🖥️ [WINDOWS TEST MODE SIMULATION]")
            logger.info(f"Target Printer: {printer_name} (Duplex={caps.get('supports_duplex')}, Color={caps.get('supports_color')}, A4={caps.get('supports_a4')})")
            logger.info(f"Simulated Linux CUPS Command: {' '.join(primary_cmd)}")
            logger.info("✅ Mock print successfully spooled (Windows development environment).")
            return True
        else:
            logger.info(f"Sending to CUPS printer: {printer_name}...")
            logger.info(f"Executing CUPS command: {' '.join(primary_cmd)}")
            result = subprocess.run(primary_cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info(f"CUPS Output: {result.stdout.strip()}")
                logger.info("Print job sent to printer queue successfully!")
                return True
            
            logger.warning(f"CUPS command failed: {result.stderr.strip()}")
            
            # Safe Fallback: Basic compatible command with strict A4 locking
            logger.info("Retrying with minimal standard fallback...")
            safe_fallback_cmd = ["lp", "-d", printer_name, "-n", str(copies_num), "-o", "media=A4", "-o", "PageSize=A4", "-o", "fit-to-page", local_filepath]
            fallback_res = subprocess.run(safe_fallback_cmd, capture_output=True, text=True)
            if fallback_res.returncode == 0:
                logger.info(f"Safe Fallback Output: {fallback_res.stdout.strip()}")
                return True
            else:
                logger.error(f"Safe Fallback CUPS Error: {fallback_res.stderr.strip()}")
                return False
            
    except Exception as e:
        logger.error(f"Failed to process or print job: {str(e)}")
        return False
    finally:
        # Problem #7: Clean up temporary files to prevent storage leak on Raspberry Pi
        if 'temp_files' in locals():
            for tmp_path in temp_files:
                try:
                    if tmp_path and os.path.exists(tmp_path):
                        os.remove(tmp_path)
                        logger.info(f"Cleaned up temp spool file: {tmp_path}")
                except Exception as clean_err:
                    logger.warning(f"Could not clean up temp file {tmp_path}: {clean_err}")
        logger.info("==================================")

