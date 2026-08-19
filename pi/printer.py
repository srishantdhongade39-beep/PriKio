import logging
import time
import subprocess
import os

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
        try:
            response = supabase_client.storage.from_('documents').download(storage_path)
        except Exception as e:
            error_str = str(e).lower()
            if "not found" in error_str or "404" in error_str or "not_found" in error_str:
                # Try replacing spaces and special characters with underscores like the web app does
                parts = storage_path.split('/')
                if len(parts) > 1:
                    import re
                    parts[-1] = re.sub(r'[^a-zA-Z0-9.\-_]', '_', parts[-1])
                    alt_storage_path = '/'.join(parts)
                    logger.warning(f"File not found. Retrying with safe path: {alt_storage_path}")
                    response = supabase_client.storage.from_('documents').download(alt_storage_path)
                else:
                    raise e
            else:
                raise e
        
        import tempfile
        import platform
        # Save locally
        local_filepath = os.path.join(tempfile.gettempdir(), filename)
        with open(local_filepath, "wb") as f:
            f.write(response)
            
        # Manually rotate image if landscape
        if orientation.lower() == "landscape" and filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            try:
                from PIL import Image
                with Image.open(local_filepath) as img:
                    # Rotate 90 degrees and expand bounding box
                    img_rotated = img.rotate(90, expand=True)
                    img_rotated.save(local_filepath)
                logger.info("Successfully rotated image to Landscape using Pillow.")
                # Change orientation back to portrait for CUPS so it doesn't double-rotate
                orientation = "portrait"
            except ImportError:
                logger.warning("Pillow not installed! Could not physically rotate image. Please run 'pip install Pillow'")
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
            
            # Construct CUPS command with options
            lp_cmd = ["lp", "-d", printer_name]
            
            # We removed copies from lp_cmd because we will just loop the command
            copies_num = int(copies) if copies else 1
            
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

            # Orientation (will be portrait if we already rotated it manually)
            if orientation.lower() == "landscape":
                lp_cmd.extend(["-o", "landscape", "-o", "orientation-requested=4"])
            else:
                lp_cmd.extend(["-o", "portrait", "-o", "orientation-requested=3"])

            # Page Ranges
            pages_selected = file_info.get("pages_selected")
            if pages_selected and str(pages_selected).lower() != "all":
                lp_cmd.extend(["-o", f"page-ranges={pages_selected}"])

            # Add fit-to-page so images actually rotate and fit properly
            lp_cmd.extend(["-o", "fit-to-page"])

            # Add the filepath at the end
            lp_cmd.append(local_filepath)

            # Run the lp command once with the native CUPS copies flag
            copies_num = int(copies) if copies else 1
            lp_cmd.extend(["-n", str(copies_num)])
            
            logger.info(f"Sending {copies_num} copies to CUPS...")
            result = subprocess.run(
                lp_cmd,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                logger.info(f"CUPS Output: {result.stdout.strip()}")
                logger.info("Print job sent to queue successfully!")
            else:
                logger.error(f"CUPS Error: {result.stderr.strip()}")
            
    except Exception as e:
        logger.error(f"Failed to print job: {str(e)}")
        
    logger.info(f"==================================")
