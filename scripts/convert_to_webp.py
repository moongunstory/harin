import os
from PIL import Image

image_dir = r"c:\Users\moong\Desktop\harin\web\assets\MBTI"

for filename in os.listdir(image_dir):
    if filename.lower().endswith(".png") or filename.lower().endswith(".jpg"):
        filepath = os.path.join(image_dir, filename)
        new_filepath = os.path.join(image_dir, os.path.splitext(filename)[0] + ".webp")
        
        try:
            img = Image.open(filepath)
            img.save(new_filepath, "webp", quality=80)
            print(f"Converted {filename} to WebP.")
            # Delete original to save space
            os.remove(filepath)
        except Exception as e:
            print(f"Error converting {filename}: {e}")

print("All done!")
