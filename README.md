# osu! Replay Bot

A lightweight, high-precision C++ tool that decodes osu! `.osr` replay files and replays cursor movements and button presses (Z, X, and mouse clicks) in real time with frame-perfect synchronization.

---

## What It Does

1. **Decodes `.osr` Replay Files**: Parses the binary replay format, decompresses LZMA-compressed movement frames, and extracts mouse coordinates, timestamps, and key states.
2. **Replays Cursor Movements**: Accurately maps the 512×384 osu! playfield to your monitor resolution (Fullscreen, Borderless, or Windowed) and interpolates cursor positions at 1000Hz for smooth motion.
3. **Simulates Clicks & Keypresses**: Presses keyboard keys (default `Z` and `X`) and mouse buttons (Left/Right Click) using Windows hardware scan codes, perfectly matching the original play.
4. **Automatic Memory Synchronization**: Hooks directly into `osu!.exe`'s internal audio clock (`PlayTime`) and game state (`Status`). The bot starts automatically when the beatmap begins, with zero delay and no manual input needed.

---

## How It Works

- **Binary & LZMA Parsing**: Reads replay metadata (player, mods, score) and decompresses the raw frame stream using an embedded LZMA SDK decoder. Initial osu! marker frames `(256, -500)` and negative intro offsets are cleaned and normalized.
- **Direct Audio Clock Sync**: Scans osu!'s process memory using AOB pattern matching for the song audio clock pointer (`5E 5F 5D C3 A1 ?? ?? ?? ?? 89 ?? 04`) and game state pointer (`48 83 F8 04 73 1E`). This ensures:
  - **Variable load times don't matter**: Playback tracks the music track directly.
  - **Skip intro (`Space`) supported**: Jumps forward instantly if the intro is skipped.
  - **Pauses & Restarts supported**: Pauses when the game pauses, and restarts automatically on quick-retries.
- **Hardware Scan Code Input**: Keypresses and mouse clicks are dispatched using the Windows `SendInput` API with hardware scan codes (`KEYEVENTF_SCANCODE`) so DirectInput/DirectX games receive inputs reliably.
- **1000Hz Interpolation Loop**: Linear interpolation between replay frames combined with sub-millisecond precision timing (`QueryPerformanceCounter`) provides smooth, lag-free cursor movement.

---

## How to Build

### Requirements
- **CMake** (3.15+)
- **C++17 Compiler** (e.g. MinGW-w64 / GCC / Clang / MSVC)

### Build Commands

Open PowerShell in the project directory and run:

```powershell
# Configure build with MinGW
& "C:\Program Files\CMake\bin\cmake.exe" -B build -S . -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release

# Compile
& "C:\Program Files\CMake\bin\cmake.exe" --build build
```

*(If `cmake` is added to your system PATH, you can simply run `cmake -B build ...`)*

The compiled binary will be located at:
`build\osu_replaybot.exe`

---

## How to Use

### 1. Full-Auto Mode (Recommended)

Simply start the program with your replay file:

```powershell
.\build\osu_replaybot.exe "path\to\your_replay.osr"
```

1. Launch the bot.
2. Open osu! and enter or watch the beatmap.
3. The bot will automatically detect gameplay, hook the audio clock, and replay movements and clicks in perfect sync.
4. Press **ESC** at any time to abort playback or exit.

---

### Command-Line Options

| Option | Description | Example |
|---|---|---|
| `--k1 <key>` | Set custom Key 1 keybind (default: `Z`) | `--k1 c` |
| `--k2 <key>` | Set custom Key 2 keybind (default: `X`) | `--k2 v` |
| `--no-buttons` | Disable button pressing (cursor movement only) | `--no-buttons` |
| `--f2` | Use manual `F2` hotkey sync instead of memory sync | `--f2` |
| `--delay <ms>` | Use window title detection with a fixed millisecond delay | `--delay 1500` |
| `--manual` | Offline test mode with 3s countdown (no osu! required) | `--manual` |
| `--no-memory` | Disable memory scanner and use window title detection | `--no-memory` |

---

## Project Structure

```text
osu replaybot/
├── CMakeLists.txt        # CMake build configuration
├── README.md             # Project documentation
├── osr_parser.h/.cpp     # Binary .osr parser and LZMA decompression
├── memory_reader.h/.cpp  # osu! memory scanner and audio clock reader
├── main.cpp              # Playback engine, coordinate mapping, input simulation
└── lzma/                 # Embedded LZMA C decoder (from LZMA SDK)
```

