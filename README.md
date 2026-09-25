# TrafficTimer

TrafficTimer is a minimalist, full-screen countdown timer with traffic-light color cues. It is designed for talks, workshops, meetings, performances, and any setting where the remaining time needs to be understood at a glance.

Created by [Jim Wong](https://jimjwong.com) with AI.

## Features

- Configurable total, amber, and red times
- Large responsive `MM:SS` or `HH:MM:SS` display
- Green, amber, and red full-screen states
- Flashing negative overtime display
- Gentle ten-second completion chime
- Fullscreen mode and screen wake lock support
- Keyboard-accessible controls
- No dependencies, build step, tracking, or external assets

## Run locally

Open `index.html` directly in a modern browser.

To serve it over a local network, run a static server from the project directory. For example:

```bash
python -m http.server 9000 --bind 0.0.0.0
```

Then open `http://localhost:9000`. Other devices can use the host computer's LAN or Tailscale IP followed by `:9000`.

## Time format

Each field uses a fixed `HH:MM:SS` display. Type digits as you would on a calculator: new digits enter from the right and shift left while the colons remain fixed. For example, typing `800` produces `00:08:00`, and typing `081922` produces `08:19:22`.

For a 15-minute session that turns amber with 10 minutes remaining and red with 1 minute remaining:

```text
Total time: 00:15:00
Amber at:  00:10:00
Red at:    00:01:00
```

## Project structure

```text
index.html   Page structure and controls
styles.css   Responsive layout and color states
script.js    Timer, fullscreen, wake lock, and sound behavior
```

## Contributing

Issues and pull requests are welcome. Please keep changes focused, accessible, dependency-free where practical, and suitable for both desktop and mobile displays.

## License

TrafficTimer is free software licensed under the [GNU General Public License v3.0](LICENSE).

Copyright (C) 2026 Jim Wong.
