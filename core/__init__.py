"""
Paralegal - Core Package
"""
from .converter import ImageConverter
from .excel_converter import ExcelConverter
from .word_converter import WordConverter
from .msg_converter import MsgConverter, EmailConverter
from .pdf_merger import PDFMerger
from .kvkk_detector import KVKKDetector, KVKKEntity
from .redactor import PDFRedactor

__all__ = [
    "ImageConverter",
    "ExcelConverter",
    "WordConverter",
    "MsgConverter",
    "EmailConverter",
    "PDFMerger",
    "KVKKDetector",
    "KVKKEntity",
    "PDFRedactor",
]
