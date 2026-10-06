"""
Tkinter GUI for the Face Recognition IoT Security System.

Shows the live camera feed plus the status panel required by the project
spec (FR-07): camera connection, ESP32 connection, face detection,
identity, security state, and alarm state. Also supports enrolling new
faces and viewing the recent access log - both stored entirely in
Supabase, nothing is written to the local disk.
"""
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
from PIL import Image, ImageTk
import cv2
import threading
import time

import config
from face_engine import FaceEngine
from cloud_client import CloudClient
from esp32_client import ESP32Client

STATUS_COLORS = {
    "AUTHORIZED": "#4ade80",
    "UNKNOWN": "#f87171",
    "NO_FACE": "#94a3b8",
    "ERROR": "#facc15",
}


class SecurityApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Face Recognition Security System")
        self.geometry("980x600")
        self.configure(bg="#111827")

        self.running = False
        self.cap = None
        self.last_sent_status = None
        self.camera_fail_count = 0

        self.cloud = CloudClient()
        self.engine = FaceEngine()
        self.esp32 = ESP32Client()

        self._build_ui()
        self._load_known_faces()
        self._load_logs()
        self._poll_esp32()

    # ---------------- UI layout ----------------
    def _build_ui(self):
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass

        main = ttk.Frame(self)
        main.pack(fill="both", expand=True, padx=12, pady=12)

        left = ttk.Frame(main)
        left.pack(side="left", fill="both", expand=True)

        self.video_label = ttk.Label(left, background="#000000")
        self.video_label.pack()

        panel = tk.Frame(left, bg="#1f2937", padx=14, pady=10)
        panel.pack(fill="x", pady=10)

        self.fields = {}
        rows = [
            ("Camera Status", "camera"),
            ("ESP32 Status", "esp32"),
            ("Face Status", "face"),
            ("Identity", "identity"),
            ("Security", "security"),
            ("Alarm", "alarm"),
        ]
        for i, (label_text, key) in enumerate(rows):
            tk.Label(panel, text=label_text + ":", fg="#9ca3af", bg="#1f2937",
                     font=("Segoe UI", 10, "bold"), width=14, anchor="w").grid(
                row=i, column=0, sticky="w", pady=2)
            val = tk.Label(panel, text="-", fg="white", bg="#1f2937",
                            font=("Segoe UI", 10, "bold"), anchor="w")
            val.grid(row=i, column=1, sticky="w", pady=2)
            self.fields[key] = val

        btn_row = ttk.Frame(left)
        btn_row.pack(pady=6)
        ttk.Button(btn_row, text="Start Monitoring", command=self.start).grid(row=0, column=0, padx=4)
        ttk.Button(btn_row, text="Stop", command=self.stop).grid(row=0, column=1, padx=4)
        ttk.Button(btn_row, text="Enroll New Face", command=self.enroll_face).grid(row=0, column=2, padx=4)
        ttk.Button(btn_row, text="Reset Alarm", command=self.reset_alarm).grid(row=0, column=3, padx=4)

        right = ttk.Frame(main, width=300)
        right.pack(side="right", fill="y")
        ttk.Label(right, text="Recent Access Log", font=("Segoe UI", 12, "bold")).pack(pady=(0, 6))
        self.log_list = tk.Listbox(right, width=42, height=30, font=("Consolas", 9))
        self.log_list.pack(fill="y", expand=True)
        ttk.Button(right, text="Refresh Log", command=self._load_logs).pack(pady=6)

    # ---------------- Cloud data ----------------
    def _load_known_faces(self):
        try:
            names, encodings = self.cloud.get_all_encodings()
            self.engine.refresh_known_faces(names, encodings)
        except Exception as e:
            messagebox.showerror("Cloud error", f"Couldn't load enrolled faces:\n{e}")

    def _load_logs(self):
        try:
            logs = self.cloud.get_recent_logs()
            self.log_list.delete(0, tk.END)
            for entry in logs:
                ts = (entry.get("event_time") or "")[:19].replace("T", " ")
                identity = entry.get("identity") or "-"
                self.log_list.insert(
                    tk.END,
                    f"{ts}  {identity:<12} {entry['status']:<10} {entry['alarm']}"
                )
        except Exception:
            pass  # log panel is best-effort, never blocks the app

    # ---------------- ESP32 heartbeat ----------------
    def _poll_esp32(self):
        def check():
            online = self.esp32.ping()
            self.after(0, self._set_field, "esp32",
                       "CONNECTED" if online else "DISCONNECTED",
                       "#4ade80" if online else "#f87171")
        threading.Thread(target=check, daemon=True).start()
        self.after(5000, self._poll_esp32)

    # ---------------- Camera loop ----------------
    def start(self):
        if self.running:
            return
        self.cap = cv2.VideoCapture(config.CAMERA_INDEX)
        if not self.cap.isOpened():
            messagebox.showerror("Camera", "ERROR: Camera unavailable")
            self._set_field("camera", "ERROR", STATUS_COLORS["ERROR"])
            return

        self.running = True
        self.camera_fail_count = 0
        self._set_field("camera", "CONNECTED", "#4ade80")
        threading.Thread(target=self._camera_loop, daemon=True).start()

    def stop(self):
        self.running = False
        if self.cap:
            self.cap.release()
        self._set_field("camera", "STOPPED", "#9ca3af")

    def _camera_loop(self):
        while self.running:
            ok, frame = self.cap.read()
            if not ok:
                self.camera_fail_count += 1
                if self.camera_fail_count > 30:
                    self.after(0, self._handle_camera_error)
                    return
                time.sleep(0.05)
                continue
            self.camera_fail_count = 0

            try:
                results = self.engine.encode_frame(frame)
            except Exception:
                self.after(0, self._apply_status, "ERROR", "", frame)
                time.sleep(0.1)
                continue

            if not results:
                self.after(0, self._apply_status, "NO_FACE", "", frame)
            else:
                all_authorized = True
                names = []
                for encoding, (top, right, bottom, left) in results:
                    name, is_match = self.engine.identify(encoding)
                    names.append(name if is_match else "Unknown")
                    if not is_match:
                        all_authorized = False
                    color = (0, 200, 0) if is_match else (0, 0, 200)
                    cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
                    cv2.putText(frame, name or "Unknown", (left, top - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

                status = "AUTHORIZED" if all_authorized else "UNKNOWN"
                self.after(0, self._apply_status, status, ", ".join(names), frame)

            time.sleep(0.03)

    def _handle_camera_error(self):
        self.running = False
        self._set_field("camera", "ERROR", STATUS_COLORS["ERROR"])
        self._set_field("security", "ERROR", STATUS_COLORS["ERROR"])
        messagebox.showerror("Camera", "ERROR: Camera unavailable")

    def _apply_status(self, status, identity, frame):
        self._set_field("face", "NOT DETECTED" if status == "NO_FACE" else "DETECTED")
        self._set_field("identity", identity or "-")
        self._set_field("security", status, STATUS_COLORS.get(status, "white"))
        alarm = "ON" if status == "UNKNOWN" else "OFF"
        self._set_field("alarm", alarm, "#f87171" if alarm == "ON" else "#4ade80")
        self._render_frame(frame)

        if status != self.last_sent_status:
            esp32_ok = self.esp32.send_status(status)
            if not esp32_ok:
                self._set_field("esp32", "DISCONNECTED", "#f87171")
            self.cloud.log_access(identity, status, alarm)
            self.last_sent_status = status
            self._load_logs()

    def _set_field(self, key, text, color="white"):
        self.fields[key].config(text=text, fg=color)

    def _render_frame(self, frame):
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(rgb).resize((620, 420))
        imgtk = ImageTk.PhotoImage(image=img)
        self.video_label.imgtk = imgtk
        self.video_label.configure(image=imgtk)

    # ---------------- Manual reset ----------------
    def reset_alarm(self):
        self.esp32.send_status("RESET")
        self._set_field("alarm", "OFF", "#4ade80")
        self.last_sent_status = "RESET"

    # ---------------- Enrollment ----------------
    def enroll_face(self):
        name = simpledialog.askstring("Enroll New Face", "Employee name:")
        if not name:
            return

        cap = cv2.VideoCapture(config.CAMERA_INDEX)
        messagebox.showinfo("Enroll", "Look at the camera. Capturing in 3 seconds...")
        time.sleep(3)
        ok, frame = cap.read()
        cap.release()

        if not ok:
            messagebox.showerror("Enroll", "Couldn't access the camera.")
            return

        try:
            encoding = self.engine.encode_single_image(frame)
        except Exception as e:
            messagebox.showerror("Enroll", f"Recognition error:\n{e}")
            return

        if encoding is None:
            messagebox.showerror("Enroll", "Couldn't find exactly one clear face. Try again.")
            return

        try:
            self.cloud.add_employee(name, encoding)
            messagebox.showinfo("Enroll", f"{name} enrolled successfully.")
            self._load_known_faces()
        except Exception as e:
            messagebox.showerror("Cloud error", f"Couldn't save to Supabase:\n{e}")

    def on_close(self):
        self.running = False
        if self.cap:
            self.cap.release()
        self.destroy()
