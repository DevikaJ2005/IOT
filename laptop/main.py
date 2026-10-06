"""
Entry point. Run this to launch the Face Recognition Security System.
"""
from gui import SecurityApp

if __name__ == "__main__":
    app = SecurityApp()
    app.protocol("WM_DELETE_WINDOW", app.on_close)
    app.mainloop()
