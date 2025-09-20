# utils.py
import os
import bcrypt
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}

def hash_password(plain_password: str) -> str:
    """Return bcrypt hash (utf-8 string)"""
    hashed = bcrypt.hashpw(plain_password.encode('utf-8'), bcrypt.gensalt())
    return hashed.decode('utf-8')

def check_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against stored bcrypt hash"""
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except ValueError:
        return False

def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def save_uploaded_file(file_storage, upload_folder: str) -> str:
    """
    Saves FileStorage to upload_folder, returns saved filename (not full path).
    Ensures filename is safe and avoids overwriting existing files by appending numbers.
    """
    os.makedirs(upload_folder, exist_ok=True)
    filename = secure_filename(file_storage.filename)
    if not filename:
        raise ValueError("Invalid filename")

    base, ext = os.path.splitext(filename)
    candidate = filename
    i = 1
    while os.path.exists(os.path.join(upload_folder, candidate)):
        candidate = f"{base}_{i}{ext}"
        i += 1

    save_path = os.path.join(upload_folder, candidate)
    file_storage.save(save_path)
    return candidate
