# Fog Companion

## About

Fog Companion is an Overwolf application for the game Dead by Daylight (DBD), designed to assist competitive players. It provides various in-game tools and features to enhance the comp gameplay loop.

The application is built with React, TypeScript, and Vite, and it leverages the Overwolf platform to provide in-game overlays and integration with the game.

## Features

- **Map Callouts:** Displays map images for callouts to help with team communication.
  - **Map Browser:** An in-game browser to view all available maps and their variations.
- **Game Modes:**
  - **1v1 Mode:** A special mode for 1v1 matches, with dedicated timers and controls. Ingame without the need for an external app or smartphone. Start/End chase with common gestures (Crouch, Swing, Bump, Emote).
  - **Scrim/Tournament Mode:** A mode tailored for scrims and tournaments. Not yet available.
- **Smart-Features:**
  - Leverages screenshots and OCR to detect the current state of the game.
  - Lock/Unlock gestures to start/stop chase by detecting Menu/Ingame.
  - Detect killers starting 1v1 chase with M2 instead of M1 (Blight, Nurse).
- **Customizable Hotkeys:** A rich set of customizable hotkeys to control the application's features without leaving the game.

## Tech Stack

- **Framework:** [React](https://reactjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **UI Library:** [Material-UI](https://mui.com/)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **OCR:** [Tesseract.js](https://tesseract.projectnaptha.com/)
- **Platform:** [Overwolf](https://overwolf.com/)

## Project Structure

The application is a multi-window Overwolf app with the following windows:

- `background`: A background window that runs persistently. From here all the OCR logic is called.
- `in_game`: The main window of the application.
- `mode_1v1`: A window for the "1v1" mode.
- `callouts`: A window for displaying map callouts.
- `debug`: A window for debugging purposes.

The map images are located in the `public/img/maps` directory. A script (`tools/generate-map-directory.ts`) runs at build time to generate a TypeScript file (`src/generated-map-directory.ts`) that exports a directory of all available maps.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/) (or npm)
- [Overwolf](https://www.overwolf.com/app/Overwolf-Overwolf)

### Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/DieserMerlin/Fog-Companion.git
    ```
2.  **Install dependencies:**
    ```bash
    yarn install
    ```
3.  **Run the development server:**
    ```bash
    yarn dev
    ```
    This will build the application and watch for file changes.

4.  **Load the extension in Overwolf:**
    - Open the Overwolf settings.
    - Go to the "Support" tab and click on "Development options".
    - In the "My Apps" tab, click on "Load unpacked extension" and select the `dist` folder in the project directory.

### Building for Production

To create a production build, run:

```bash
yarn build:prod
```

This will create a production-ready build in the `dist` folder.

### Packaging for Overwolf

To create an Overwolf package (`.opk`), run:

```bash
yarn build:opk
```

This will create an `.opk` file in the `dist` folder, which can be used to distribute the application.

## License

This project is licensed under the [GPL-3.0-only](LICENSE) license.
