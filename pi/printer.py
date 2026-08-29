import logging
import time
import subprocess
import os
import re
import tempfile
import platform

logger = logging.getLogger(__name__)

def print_job(job_id, file_info, supabase_client):
    """
    Downloads the file from Supabase Storage and sends it to the physical printer via CUPS
    """
    filename = file_info.get("filename")
    storage_path = file_info.get("storage_path")
    copies = file_info.get("copies", 1)
    sides = file_info.get("sides", "Single")
    color_mode = file_info.get("color_mode", "B&W")
    orientation = file_info.get("orientation", "Portrait")

    logger.info(f"============ PRINTING ============")
    logger.info(f"Job ID: {job_id}")
    logger.info(f"Filename: {filename}")
    logger.info(f"Settings: Copies={copies}, Sides={sides}, Color={color_mode}, Orientation={orientation}")
    
    # 1. Download the file from Supabase Storage
    logger.info(f"Downloading {storage_path} from Supabase...")
    
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
                safe_name = re.sub(r'[^a-zA-Z0-9.\-_]', '_', parts[-1])
                alt_storage_path = f"{parts[0]}/{safe_name}"
                logger.info(f"Retrying download with safe path: {alt_storage_path}")
                try:
                    response = supabase_client.storage.from_('documents').download(alt_storage_path)
                except Exception as e2:
                    logger.warning(f"Safe path download failed ({e2}). Querying bucket directory...")
                    # Attempt 3: List files in the job folder to find the actual uploaded file
                    try:
                        file_list = supabase_client.storage.from_('documents').list(parts[0])
                        if file_list and len(file_list) > 0:
                            actual_name = file_list[0].get('name')
                            matched_path = f"{parts[0]}/{actual_name}"
                            logger.info(f"Found file in folder: {matched_path}. Downloading...")
                            response = supabase_client.storage.from_('documents').download(matched_path)
                        else:
                            raise e2
                    except Exception:
                        raise e2
            else:
                raise e
        
        # Save locally
        local_filepath = os.path.join(tempfile.gettempdir(), filename)
        with open(local_filepath, "wb") as f:
            f.write(response)
            
        # Manually rotate image if landscape
        if orientation.lower() == "landscape" and filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            try:
                from PIL import Image
                with Image.open(local_filepath) as img:
                    img_rotated = img.rotate(90, expand=True)
                    img_rotated.save(local_filepath)
                logger.info("Successfully rotated image to Landscape using Pillow.")
                orientation = "portrait"
            except ImportError:
                logger.warning("Pillow not installed! Could not physically rotate image.")
            except Exception as e:
                logger.warning(f"Error rotating image: {e}")
                
        logger.info(f"File downloaded to {local_filepath}")
        
        # 2. Print depending on OS
        if platform.system() == "Windows":
            logger.info("Windows detected. Opening default print dialog...")
            os.startfile(local_filepath, "print")
            logger.info("Print command sent to Windows spooler!")
        else:
            printer_name = os.getenv("PRINTER_NAME", "test_printer")
            logger.info(f"Sending to CUPS printer: {printer_name}...")
            
            copies_num = int(copies) if copies else 1
            
            # Construct CUPS command with options
            lp_cmd = ["lp", "-d", printer_name]
            
            # Copies
            lp_cmd.extend(["-n", str(copies_num)])
            
            # Sides (Duplex)
            if sides.lower() == "double":
                lp_cmd.extend(["-o", "sides=two-sided-long-edge"])
            else:
                lp_cmd.extend(["-o", "sides=one-sided"])
                
            # Color Mode
            if color_mode.lower() == "color":
                lp_cmd.extend(["-o", "print-color-mode=color"])
            else:
                lp_cmd.extend(["-o", "print-color-mode=monochrome"])

            # Orientation
            if orientation.lower() == "landscape":
                lp_cmd.extend(["-o", "landscape", "-o", "orientation-requested=4"])
            else:
                lp_cmd.extend(["-o", "portrait", "-o", "orientation-requested=3"])

            # Page Ranges
            pages_selected = file_info.get("pages_selected")
            if pages_selected and str(pages_selected).lower() != "all":
                lp_cmd.extend(["-o", f"page-ranges={pages_selected}"])

            # Add fit-to-page so images rotate and fit properly
            lp_cmd.extend(["-o", "fit-to-page"])

            # Add filepath at the very end
            lp_cmd.append(local_filepath)
            
            logger.info(f"Executing: {' '.join(lp_cmd)}")
            result = subprocess.run(
                lp_cmd,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                logger.info(f"CUPS Output: {result.stdout.strip()}")
                logger.info("Print job sent to printer queue successfully!")
            else:
                logger.error(f"CUPS Error: {result.stderr.strip()}")
                logger.info("Retrying with standard fallback command...")
                fallback_cmd = ["lp", "-d", printer_name, "-n", str(copies_num), "-o", "fit-to-page", local_filepath]
                fallback_res = subprocess.run(fallback_cmd, capture_output=True, text=True)
                if fallback_res.returncode == 0:
                    logger.info(f"Fallback CUPS Output: {fallback_res.stdout.strip()}")
                    logger.info("Fallback print job succeeded!")
                else:
                    logger.error(f"Fallback CUPS Error: {fallback_res.stderr.strip()}")
            
    except Exception as e:
        logger.error(f"Failed to print job: {str(e)}")
        
    logger.info(f"==================================")
