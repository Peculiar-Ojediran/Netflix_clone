# Streamline Netflix Clone

A web application that replicates the basic functionalities of Netflix, allowing users to browse and view TV shows.

## Tech Stack

- React
- Vite
- TMDB API
- CSS custom properties
- Lucide React icons

## Run Locally

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Add your TMDB API key:

```bash
VITE_TMDB_API_KEY=your_tmdb_api_key_here
```

Then run the app:

```bash
npm install
npm run dev
```

Then open the local URL printed in your terminal.

## Production Build

```bash
npm run build
```
The app links to trailers, official pages, and TMDB details. It does not host or embed unauthorized copyrighted episodes.
