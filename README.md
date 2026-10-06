# Face Recognition Based IoT Security System

Laptop webcam does face detection + recognition, sends the result to an
ESP32 over Wi-Fi, and the ESP32 drives a buzzer. No face data is stored
locally - face encodings and the access log both live in Supabase.

## Folder structure

```
esp32-face-security/
├── README.md
├── requirements.txt
├── .env.example          -> copy to .env and fill in your values
├── .gitignore
│
├── laptop/
│   ├── main.py            entry point - run this
│   ├── gui.py              Tkinter desktop UI
│   ├── face_engine.py      face detection/recognition (pre-trained, no training step)
│   ├── cloud_client.py     all Supabase reads/writes
│   ├── esp32_client.py     sends status to the ESP32, checks connectivity
│   └── config.py           loads settings from .env
│
├── esp32/
│   └── face_security/
│       └── face_security.ino
│
└── supabase/
    └── schema.sql          run once to create the two tables
```

**Note on the two changes from the original PRD folder layout:** `known_faces/`
and `logs/access_log.csv` are gone - encodings and access events go to
Supabase instead, per your "nothing locally" call. Everything else follows
the PRD's module split (laptop vs. ESP32 as separate, independent pieces).

## Before you start

- **Python 3.10 or 3.11** is the safe choice. `face_recognition` depends on
  `dlib`, which doesn't have prebuilt wheels for Python 3.13 yet - pip ends
  up compiling it from source, which is slow and frequently fails on
  Windows. If `python --version` shows 3.12/3.13, install 3.11 alongside it
  and use that for this project's virtual environment.
- **Arduino IDE 2.x** (or PlatformIO, if you already use it).
- **A 2.4GHz Wi-Fi network.** The ESP32 cannot join 5GHz networks. If your
  router broadcasts one merged SSID for both bands, check its settings -
  you may need a separate 2.4GHz network name.
- A free **Supabase** account.
- Your laptop and the ESP32 must be on the **same Wi-Fi network** so the
  HTTP calls between them can actually reach each other.

## Part A - Supabase setup

1. Create a free project at supabase.com and wait for it to finish
   provisioning (~2 minutes).
2. Open the **SQL Editor** (left sidebar) -> **New query**, paste in the
   entire contents of `supabase/schema.sql`, and click **Run**.
   This creates the `employees` and `access_log` tables *and* grants your
   app permission to use them (see the comment at the top of that file for
   why the grants are necessary - Supabase changed its defaults in 2026).
3. Go to **Project Settings -> API**. Copy:
   - **Project URL** -> this is `SUPABASE_URL`
   - **anon public** key -> this is `SUPABASE_KEY`

## Part B - Flash the ESP32

1. In Arduino IDE: **File -> Preferences**, and paste this into
   "Additional Boards Manager URLs":
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
2. **Tools -> Board -> Boards Manager**, search "esp32", install the
   package by **Espressif Systems**.
3. **Tools -> Board -> esp32 -> ESP32 Dev Module** (or the specific board
   you have), then **Tools -> Port** and pick the COM port / `/dev/tty*`
   your board shows up as once plugged in.
4. Open `esp32/face_security/face_security.ino`. Edit the top of the file:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const int   BUZZER_PIN    = 4;
   ```
   GPIO4 is a safe default. If you rewire it, avoid GPIO0, 2, 12, and 15 -
   these affect the board's boot mode and can cause upload/boot issues.
5. Wire the buzzer: **GPIO pin -> buzzer (+)**, **ESP32 GND -> buzzer (-)**.
6. Click **Upload**. If it fails to connect, hold the **BOOT** button on
   the board while upload starts (common on some ESP32 dev boards).
7. Open **Tools -> Serial Monitor**, set the baud rate to **115200**. After
   a few seconds you should see:
   ```
   Connecting to WiFi.....
   Connected! ESP32 IP address: 192.168.1.105
   HTTP server started
   ```
   Copy that IP address - you'll need it in the next part.

## Part C - Set up the laptop app

```
cp .env.example .env
```

Open `.env` and fill in `SUPABASE_URL`, `SUPABASE_KEY` (from Part A), and
`ESP32_IP` (from Part B, step 7).

```
cd laptop
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux
pip install -r ../requirements.txt
```

**If `pip install` hangs or fails on `dlib`:**
- Confirm you're on Python 3.10/3.11 (see "Before you start").
- Install `cmake` first: `pip install cmake`.
- On Windows, install "Desktop development with C++" via the
  [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
- Still stuck? Try the precompiled fallback: `pip install dlib-bin`.

### What each `.env` value does

| Variable | Meaning |
|---|---|
| `SUPABASE_URL` / `SUPABASE_KEY` | Your project's API URL and anon key |
| `ESP32_IP` / `ESP32_PORT` | Where the laptop sends status commands (port is `80` unless you changed it in the sketch) |
| `FACE_MATCH_TOLERANCE` | Lower = stricter matching. `0.6` is the library's default and a good starting point |
| `CAMERA_INDEX` | `0` is usually the built-in webcam; try `1` if you have an external camera plugged in and the wrong one opens |

## Running it

```
python main.py
```

1. Click **Enroll New Face** first, type a name, look at the camera - it
   captures one frame, generates the encoding, and pushes it to Supabase
   (the photo itself is discarded, never saved).
2. Click **Start Monitoring**. The status panel should read:
   ```
   Camera Status : CONNECTED
   ESP32 Status  : CONNECTED
   Face Status   : DETECTED
   Identity      : <your name>
   Security      : AUTHORIZED
   Alarm         : OFF
   ```
3. Have someone unenrolled step into frame - `Security` should flip to
   `UNKNOWN`, `Alarm` to `ON`, and the ESP32's buzzer should sound.

## How the status logic works

Matches the PRD's security logic and multi-face rule:

| Condition | Security | Buzzer |
|---|---|---|
| No face in frame | `NO_FACE` | OFF |
| All visible faces match enrolled people | `AUTHORIZED` | OFF |
| At least one visible face is unrecognized | `UNKNOWN` | ON |
| Camera or recognition failure | `ERROR` | OFF |

The **Reset Alarm** button sends the `RESET` command directly if you need
to silence the buzzer manually.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `ESP32 Status: DISCONNECTED` | Laptop and ESP32 aren't on the same network, `ESP32_IP` in `.env` is wrong, or the board lost power/Wi-Fi. Re-check the Serial Monitor IP. |
| Buzzer never sounds | Check `BUZZER_PIN` matches your wiring, and the buzzer's `+`/`-` aren't swapped. |
| Camera shows black / won't open | Another app (Zoom, Teams) may be holding the webcam. Close it, or try `CAMERA_INDEX=1`. |
| `Missing SUPABASE_URL / SUPABASE_KEY` error on launch | `.env` wasn't filled in, or you're running `python main.py` from outside the `laptop/` folder (it looks for `.env` one level up). |
| Supabase call fails with "permission denied" or table not found | The GRANT/RLS statements in `schema.sql` weren't run, or were run against a different project than the one in `SUPABASE_URL`. Re-run `schema.sql` in the right project. |
| `pip install` stuck on "Building wheel for dlib" | See the dlib section in Part C - almost always a Python-version or missing-build-tools issue. |
| Face never recognized, even for enrolled person | Try enrolling again in better lighting; loosen `FACE_MATCH_TOLERANCE` slightly (e.g. `0.65`). |

## Privacy

Only face *encodings* (a list of numbers) are stored, never raw photos or
video, and everything lives in Supabase rather than on disk - in line with
the PRD's privacy section. Treat your Supabase keys like passwords (that's
what `.gitignore` is for).
