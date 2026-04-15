📖 Vega‑Next Desktop –
markdown
# 🎬 Vega‑Next Desktop

**Vega‑Next** is a modern, cross‑platform media streaming application that aggregates content from multiple community‑maintained providers. It offers a sleek, Netflix‑like interface for browsing movies, series, and live streams, with advanced features like offline downloads, external player support, Discord Rich Presence, and seamless cross‑device synchronisation.

Built with **React**, **Electron**, and **React Native Web**, Vega‑Next works on Windows, macOS, and Linux.

<p align="center">
  <img src="https://img.shields.io/badge/version-0.0.1-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="platform">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs welcome">
</p>

---

## ✨ Features

- **Multi‑Provider Support** – Install and switch between different content sources seamlessly.
- **Rich Metadata** – Automatically fetches posters, backdrops, cast, ratings, and synopsis from TMDB and Cinemeta.
- **Smart Search** – Search across all installed providers with live suggestions and history.
- **Continue Watching** – Resume any movie or episode exactly where you left off.
- **Offline Downloads** – Download episodes or movies for offline viewing.
- **External Player Integration** – Play streams directly in VLC, MPC‑HC, or any system media player.
- **Discord Rich Presence** – Show your friends what you’re watching in real time.
- **Watch Together** – Sync playback with friends using shareable links (Pusher‑based).
- **Customisable Themes** – Choose from preset colour schemes or create your own.
- **Subtitle Support** – Load external `.srt` / `.vtt` files or search OpenSubtitles directly.
- **Responsive UI** – Works flawlessly on desktop and adapts to smaller screens.

---

## 🛠️ Technology Stack

| Category            | Technologies                                                                                         |
|---------------------|------------------------------------------------------------------------------------------------------|
| **Frontend**        | React 19, Video.js, HLS.js, Lucide Icons, CSS‑in‑JS                                                   |
| **State Management**| Zustand (with persistence)                                                                            |
| **Data Fetching**   | TanStack Query (React Query)                                                                          |
| **Desktop Runtime** | Electron 41                                                                                           |
| **Build Tool**      | Vite 8                                                                                                |
| **Package Manager** | npm                                                                                                   |
| **Styling**         | Inline styles + global CSS                                                                            |
| **Networking**      | Axios, Cheerio (HTML scraping), custom extractors                                                     |

---

## 🧠 Architecture Overview

Vega‑Next follows a **modular, provider‑driven architecture**. The core application is unaware of any specific content source; instead, it communicates with **providers** through a standardised interface (`ProviderManager`). Each provider is a JavaScript module that knows how to scrape metadata, list categories, and extract video streams from a particular website or API.

### Data Flow (Simplified)
User → UI Component → Custom Hook (React Query) → ProviderManager → Active Provider → Website / API
↓
Stream / Metadata / Posts

text

- **Home Screen** fetches catalogues from the active provider and renders horizontal sliders.
- **Info Screen** retrieves detailed metadata (enriched with TMDB/Cinemeta) and displays cast, seasons, and episodes.
- **Player** uses Video.js + HLS.js to play streams. In Electron, custom headers (Referer, Origin) are injected via the main process to bypass hotlink protection.
- **Downloads** are handled by the Electron main process with progress events sent back to the renderer.
- **All persistent data** (watch history, downloads, settings) is stored in `localStorage` via Zustand stores.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- (For desktop builds) **Electron** dependencies – see [Electron docs](https://www.electronjs.org/docs/latest/development/build-instructions-gn)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/DHR-Store/Vega-Next-desktop.git
   cd Vega-Next-desktop
Install dependencies

bash
npm install
Run in development mode (web only)

bash
npm run dev
This starts the Vite dev server at http://localhost:5173. You can test the UI, but Electron‑specific features (downloads, external players, header injection) won't work.

Run in Electron with hot‑reload

bash
npm run electron:dev
This concurrently starts the Vite server and launches an Electron window. Changes to the source will reload the app automatically.

Building for Production
Web build (static files)

bash
npm run build
Output is in the dist/ folder.

Electron distributable (Windows NSIS installer)

bash
npm run electron:build
The packaged app will be placed in the release/ directory.

⚙️ Configuration
Environment Variables
Create a .env file in the root with the following variables:

env
VITE_TMDB_API_KEY=your_tmdb_api_key_here
VITE_PUSHER_APP_KEY=your_pusher_key
VITE_PUSHER_CLUSTER=ap2
TMDB API Key – Used for fetching cast images and search suggestions. Get one at themoviedb.org.

Pusher – Required for the Watch Together feature. Obtain credentials from pusher.com.

🔌 Provider System
Providers are the heart of Vega‑Next. Each provider exports a set of functions:

Function	Description
GetHomePosts	Returns an array of catalogues with posts for the home screen.
GetMetaData	Fetches detailed information about a movie/series (title, synopsis, IMDb).
GetStream	Extracts playable video URLs and subtitle tracks from a content page.
GetEpisodeLinks	(For series) Returns a list of seasons and episodes.
GetSearchPosts	Performs a search and returns matching posts.
Adding a New Provider
Create a new JavaScript file in src/lib/providers/ (e.g., myProvider.js).

Export an object that implements the required functions.

Use the ProviderContext (passed as an argument) to access axios, cheerio, getBaseUrl, and built‑in extractors.

Add your provider to the providers list in the central repository or install it manually via Extensions.

📖 Usage Guide
Navigating the App
Bottom Navigation Bar – Switch between Home, Search, Watchlist, and Settings.

Provider Drawer – Click the hamburger menu (☰) in the top‑left of the Home screen to change the active provider.

Hero Section – Auto‑rotates featured content. Use the search icon to quickly find a movie or paste a direct link.

Continue Watching – Displays items you've recently started. Long‑press (or right‑click) to enter selection mode and remove multiple items.

Playing Content
Click on any poster to open the Info Screen.

For series, select a season and episode.

Press the Play button next to an episode.

In the player, you can:

Switch audio tracks and subtitles.

Adjust playback speed.

Change the stream server/quality.

Download the episode.

Cast to an external player.

Downloading for Offline Viewing
On the Info Screen (or Season List), click the Download icon next to an episode.

Choose a server from the bottom sheet.

The download progress appears on the episode button. Long‑press to cancel.

Downloaded files are saved in VegaDownloads (configurable) and can be played directly from the app.

🤝 Contributing
We welcome contributions! Please follow these steps:

Fork the repository.

Create a feature branch: git checkout -b feature/amazing-feature.

Commit your changes: git commit -m 'Add amazing feature'.

Push to the branch: git push origin feature/amazing-feature.

Open a Pull Request.

📄 License
Distributed under the MIT License. See LICENSE for more information.

🙏 Acknowledgements
Stremio – Inspiration for the provider system and Cinemeta API.

TMDB – Metadata and images.

Video.js and HLS.js – Robust video playback.

Lucide – Beautiful icons.

📬 Contact & Support
Issues & Feature Requests: GitHub Issues

Discord Community: Join our Discord

Developer: DHR-Store

<p align="center"> Made with ❤️ by the Vega‑Next team </p> ```
