"""
Paralegal - Yerel REST API Sunucusu Entegrasyon Testleri
Frontend ile backend arasındaki tüm API uç noktalarını doğrular.
"""

import json
import os
import threading
import time
import urllib.request
import urllib.parse
from pathlib import Path
import pytest
from server import start_server

PORT = 52419
BASE_URL = f"http://127.0.0.1:{PORT}"

@pytest.fixture(scope="module")
def api_server():
    server = start_server(PORT)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.5)
    yield BASE_URL
    server.shutdown()


def post_json(url: str, data: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def test_api_health(api_server):
    with urllib.request.urlopen(f"{api_server}/api/health") as resp:
        data = json.loads(resp.read().decode("utf-8"))
        assert data["status"] == "ok"
        assert data["offline"] is True


def test_api_load_and_scan_pdf(api_server, tmp_path):
    # Gerçek örnek belge
    sample_pdf = Path(__file__).parent.parent / "samples" / "ornekler" / "ornek_dava_dilekcesi.pdf"
    assert sample_pdf.exists()

    # 1. Load PDF
    meta = post_json(f"{api_server}/api/load-pdf", {"path": str(sample_pdf)})
    assert meta["total_pages"] >= 1
    assert meta["filename"] == "ornek_dava_dilekcesi.pdf"

    # 2. Render Page Image
    img_url = f"{api_server}/api/pdf-page-image?path={urllib.parse.quote(str(sample_pdf))}&page=0&dpi=72"
    with urllib.request.urlopen(img_url) as resp:
        assert resp.status == 200
        assert resp.headers.get("Content-Type") == "image/jpeg"
        content = resp.read()
        assert len(content) > 1000

    # 3. Scan PDF
    scan_res = post_json(f"{api_server}/api/scan-pdf", {
        "path": str(sample_pdf),
        "filters": {
            "names": True,
            "companies": True,
            "dockets": True,
            "tckn": True,
            "iban": True,
            "phone": True,
            "plate": True,
            "email": True
        }
    })
    assert scan_res["total"] > 0
    categories = {e["category"] for e in scan_res["entities"]}
    assert "TCKN" in categories or "KISI_ADI" in categories or "DOSYA_NO" in categories

    # 4. Search Text
    search_res = post_json(f"{api_server}/api/search-text", {
        "path": str(sample_pdf),
        "text": "Ahmet"
    })
    assert search_res["total"] >= 1

    # 5. Apply Redactions (kullanıcı tarafından onaylanan varlıklar)
    out_pdf = str(tmp_path / "redacted_output.pdf")
    entities_to_redact = [{**e, "approved": True} for e in scan_res["entities"][:3]]
    redact_res = post_json(f"{api_server}/api/apply-redactions", {
        "input_path": str(sample_pdf),
        "output_path": out_pdf,
        "redactions": entities_to_redact,
        "color": "black",
        "overlay": "none"
    })
    assert redact_res["success"] is True
    assert redact_res["redactions_applied"] >= 1
    assert os.path.exists(out_pdf)


def test_api_convert_images(api_server, tmp_path):
    sample_tiff = Path(__file__).parent.parent / "samples" / "ornekler" / "ornek_taranmis_delil.tiff"
    assert sample_tiff.exists()

    # 1. Thumbnail test
    thumb_url = f"{api_server}/api/image-thumbnail?path={urllib.parse.quote(str(sample_tiff))}&rotation=90"
    with urllib.request.urlopen(thumb_url) as resp:
        assert resp.status == 200
        assert resp.headers.get("Content-Type") == "image/jpeg"
        content = resp.read()
        assert len(content) > 100

    # 2. Convert with rotation test
    out_dir = str(tmp_path)
    conv_res = post_json(f"{api_server}/api/convert-images", {
        "input_paths": [str(sample_tiff)],
        "combine": False,
        "rotations": {str(sample_tiff): 90},
        "output_dir": out_dir
    })
    assert conv_res["success"] is True
    assert len(conv_res["output_paths"]) == 1
    assert os.path.exists(conv_res["output_paths"][0])


def test_api_convert_word(api_server, tmp_path):
    import docx
    sample_doc = str(tmp_path / "itiraz_dilekcesi.docx")
    d = docx.Document()
    d.add_heading("İSTANBUL 2. İCRA HUKUK MAHKEMESİ", level=1)
    d.add_paragraph("Borca ve yetkiye itirazlarımızın sunulmasıdır.")
    d.save(sample_doc)

    out_pdf = str(tmp_path / "itiraz_dilekcesi.pdf")
    res = post_json(f"{api_server}/api/convert-word", {
        "input_path": sample_doc,
        "output_path": out_pdf
    })
    assert res["success"] is True
    assert os.path.exists(out_pdf)


def test_api_hybrid_combine_word_and_image(api_server, tmp_path):
    import docx
    from PIL import Image

    doc_p = str(tmp_path / "dilekce_ek.docx")
    d = docx.Document()
    d.add_paragraph("Delil listesi ve açıklamaları.")
    d.save(doc_p)

    img_p = str(tmp_path / "delil_fotografi.png")
    im = Image.new("RGB", (300, 300), color=(180, 200, 220))
    im.save(img_p)

    conv_res = post_json(f"{api_server}/api/convert-images", {
        "input_paths": [doc_p, img_p],
        "combine": True,
        "output_dir": str(tmp_path)
    })
    assert conv_res["success"] is True
    assert len(conv_res["output_paths"]) == 1
    combined_pdf = conv_res["output_paths"][0]
    assert os.path.exists(combined_pdf)

    import pymupdf as fitz
    merged = fitz.open(combined_pdf)
    assert len(merged) >= 2
    merged.close()
