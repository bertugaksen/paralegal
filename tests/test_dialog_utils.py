"""
Unit tests for core/dialog_utils.py
Tests Tkinter file dialog helpers, thread safety (_DIALOG_LOCK),
and Windows window focus attributes (topmost, lift, focus_force, update).
"""

import os
from unittest.mock import patch, MagicMock
from core import dialog_utils


class TestDialogUtils:
    """Test suite for Tkinter dialog utilities."""

    @patch("core.dialog_utils.filedialog.askopenfilename")
    @patch("core.dialog_utils.tk.Tk")
    def test_ask_open_filename(self, mock_tk_cls, mock_askopenfilename):
        mock_root = MagicMock()
        mock_tk_cls.return_value = mock_root
        mock_askopenfilename.return_value = "C:/test/sample.pdf"

        result = dialog_utils.ask_open_filename("pdf")

        assert result == "C:/test/sample.pdf"
        mock_root.withdraw.assert_called_once()
        mock_root.attributes.assert_called_once_with("-topmost", True)
        mock_root.lift.assert_called_once()
        mock_root.focus_force.assert_called_once()
        assert mock_root.update.call_count >= 1
        mock_root.destroy.assert_called_once()

    @patch("core.dialog_utils.filedialog.askopenfilename")
    @patch("core.dialog_utils.tk.Tk")
    def test_ask_open_filename_cancelled(self, mock_tk_cls, mock_askopenfilename):
        mock_root = MagicMock()
        mock_tk_cls.return_value = mock_root
        mock_askopenfilename.return_value = ""

        result = dialog_utils.ask_open_filename("pdf")

        assert result is None
        mock_root.destroy.assert_called_once()

    @patch("core.dialog_utils.filedialog.askopenfilenames")
    @patch("core.dialog_utils.tk.Tk")
    def test_ask_open_filenames(self, mock_tk_cls, mock_askopenfilenames):
        mock_root = MagicMock()
        mock_tk_cls.return_value = mock_root
        mock_askopenfilenames.return_value = ("C:/test/1.pdf", "C:/test/2.pdf")

        result = dialog_utils.ask_open_filenames()

        assert result == ["C:/test/1.pdf", "C:/test/2.pdf"]
        mock_root.withdraw.assert_called_once()
        mock_root.attributes.assert_called_once_with("-topmost", True)
        mock_root.lift.assert_called_once()
        mock_root.focus_force.assert_called_once()
        assert mock_root.update.call_count >= 1
        mock_root.destroy.assert_called_once()

    @patch("core.dialog_utils.filedialog.asksaveasfilename")
    @patch("core.dialog_utils.tk.Tk")
    def test_ask_saveas_filename(self, mock_tk_cls, mock_asksaveasfilename):
        mock_root = MagicMock()
        mock_tk_cls.return_value = mock_root
        mock_asksaveasfilename.return_value = "C:/test/anonim.pdf"

        result = dialog_utils.ask_saveas_filename("anonim.pdf")

        assert result == "C:/test/anonim.pdf"
        mock_root.withdraw.assert_called_once()
        mock_root.attributes.assert_called_once_with("-topmost", True)
        mock_root.lift.assert_called_once()
        mock_root.focus_force.assert_called_once()
        assert mock_root.update.call_count >= 1
        mock_root.destroy.assert_called_once()

    @patch("core.dialog_utils.filedialog.askdirectory")
    @patch("core.dialog_utils.tk.Tk")
    def test_ask_directory(self, mock_tk_cls, mock_askdirectory):
        mock_root = MagicMock()
        mock_tk_cls.return_value = mock_root
        mock_askdirectory.return_value = "C:/test/export"

        result = dialog_utils.ask_directory()

        assert result == "C:/test/export"
        mock_root.withdraw.assert_called_once()
        mock_root.attributes.assert_called_once_with("-topmost", True)
        mock_root.lift.assert_called_once()
        mock_root.focus_force.assert_called_once()
        assert mock_root.update.call_count >= 1
        mock_root.destroy.assert_called_once()

    def test_open_directory_in_explorer_nonexistent(self):
        result = dialog_utils.open_directory_in_explorer("C:/nonexistent_path_12345")
        assert result is False

    @patch("core.dialog_utils.subprocess.Popen")
    def test_open_directory_in_explorer_existing_directory(self, mock_popen, tmp_path):
        result = dialog_utils.open_directory_in_explorer(str(tmp_path))
        assert result is True
        mock_popen.assert_called_once()
        args = mock_popen.call_args[0][0]
        assert args[0] == "explorer.exe"
        assert os.path.normpath(args[1]) == os.path.normpath(str(tmp_path))

    @patch("core.dialog_utils.subprocess.Popen")
    def test_open_directory_in_explorer_existing_file(self, mock_popen, tmp_path):
        dummy_file = tmp_path / "test.txt"
        dummy_file.write_text("hello")
        result = dialog_utils.open_directory_in_explorer(str(dummy_file))
        assert result is True
        mock_popen.assert_called_once()
        args = mock_popen.call_args[0][0]
        assert args[0] == "explorer.exe"
        assert args[1] == "/select,"
        assert os.path.normpath(args[2]) == os.path.normpath(str(dummy_file))

    @patch("core.dialog_utils.filedialog.askopenfilename")
    @patch("core.dialog_utils.tk.Tk")
    def test_ask_open_filename_all_file_types(self, mock_tk_cls, mock_ask):
        mock_root = MagicMock()
        mock_tk_cls.return_value = mock_root
        mock_ask.return_value = "C:/test/file.docx"

        for ftype in ["image", "excel", "word", "converter", "all_supported", "pdf", "unknown"]:
            dialog_utils.ask_open_filename(file_type=ftype)
            assert mock_ask.called
            title = mock_ask.call_args[1].get("title")
            filetypes = mock_ask.call_args[1].get("filetypes")
            assert title == "Belge Seçin"
            assert isinstance(filetypes, list)
            assert len(filetypes) >= 1

    def test_dialog_thread_lock_serialization(self):
        import threading
        import time

        active_threads = []
        max_concurrent = 0
        lock_check = threading.Lock()

        def mock_ask(*args, **kwargs):
            nonlocal max_concurrent
            with lock_check:
                active_threads.append(1)
                if len(active_threads) > max_concurrent:
                    max_concurrent = len(active_threads)
            time.sleep(0.02)
            with lock_check:
                active_threads.pop()
            return "C:/fake/path.pdf"

        with patch("core.dialog_utils.tk.Tk"), patch(
            "core.dialog_utils.filedialog.askopenfilename", side_effect=mock_ask
        ):
            threads = [
                threading.Thread(target=dialog_utils.ask_open_filename)
                for _ in range(5)
            ]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

        assert max_concurrent == 1, f"Expected 1 concurrent dialog, got {max_concurrent}"
