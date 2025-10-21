# Fog Companion

## About

Fog Companion is an Overwolf application for the game Dead by Daylight (DBD), designed to assist competitive players. It provides various in-game tools and features to enhance the gameplay experience.

The application is built with React, TypeScript, and Vite, and it leverages the Overwolf platform to provide in-game overlays and interact with game events.

## Features

- **Map Callouts:** Displays map images with callouts to help with team communication.
- **Game Modes:**
  - **1v1 Mode:** A special mode for 1v1 matches, with dedicated timers and controls.
  - **Scrim/Tournament Mode:** A mode tailored for scrims and tournaments.
- **In-Game Timers:** Timers to track various in-game events.
- **Customizable Hotkeys:** A rich set of customizable hotkeys to control the application's features without leaving the game.
- **Map Browser:** An in-game browser to view all available maps and their variations.

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

- `background`: A background window that runs persistently.
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
    git clone <repository-url>
    ```
2.  **Install dependencies:**
    ```bash
    yarn install
    ```
    or
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This will build the application and watch for file changes.

4.  **Load the extension in Overwolf:**
    - Open the Overwolf settings.
    - Go to the "Support" tab and click on "Development options".
    - In the "My Apps" tab, click on "Load unpacked extension" and select the `dist` folder in the project directory.

### Building for Production

To create a production build, run:

```bash
npm run build:prod
```

This will create a production-ready build in the `dist` folder.

### Packaging for Overwolf

To create an Overwolf package (`.opk`), run:

```bash
npm run build:opk
```

This will create an `.opk` file in the `dist` folder, which can be used to distribute the application.

## License

This project is licensed under the [GPL-3.0-only](LICENSE) license.
