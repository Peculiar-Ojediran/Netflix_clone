import React, { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  Calendar,
  Check,
  ExternalLink,
  Play,
  Search,
  Sparkles,
  Star,
  TrendingUp
} from "lucide-react";

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const API_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/original";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80";
const ACCENTS = ["#f43f5e", "#38bdf8", "#a3e635", "#facc15", "#c084fc", "#14b8a6", "#fb7185"];
const FALLBACK_GENRES = ["All", "Action & Adventure", "Comedy", "Crime", "Drama", "Documentary", "Mystery", "Sci-Fi & Fantasy"];

function tmdbUrl(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "en-US");
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function fetchTmdb(path, params) {
  const response = await fetch(tmdbUrl(path, params));
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`);
  }
  return response.json();
}

function normalizeShow(show, genreMap, index = 0) {
  const genreNames = show.genre_ids?.length
    ? show.genre_ids.map((id) => genreMap.get(id)).filter(Boolean)
    : show.genres?.map((genre) => genre.name) || [];

  const title = show.name || show.original_name || show.title || "Untitled";
  const yearValue = show.first_air_date || show.release_date;
  const rating = show.vote_average ? Number(show.vote_average).toFixed(1) : null;

  return {
    id: show.id,
    title,
    type: "TV Series",
    genre: genreNames[0] || "TV",
    genres: genreNames.length ? genreNames : ["TV"],
    year: yearValue ? new Date(yearValue).getFullYear() : "TBA",
    match: show.vote_average ? Math.round(show.vote_average * 10) : Math.max(70, 96 - index),
    rating: rating ? `${rating}/10` : "Unrated",
    duration: show.number_of_seasons ? `${show.number_of_seasons} season${show.number_of_seasons === 1 ? "" : "s"}` : "Series",
    rank: index + 1,
    image: show.backdrop_path || show.poster_path ? `${IMAGE_BASE}${show.backdrop_path || show.poster_path}` : FALLBACK_IMAGE,
    poster: show.poster_path ? `${IMAGE_BASE}${show.poster_path}` : `${IMAGE_BASE}${show.backdrop_path}`,
    accent: ACCENTS[index % ACCENTS.length],
    description: show.overview || "No official TMDB overview is available yet.",
    tags: genreNames.slice(0, 3),
    network: show.networks?.map((network) => network.name).join(", ") || "Network details on TMDB",
    schedule: show.status || "Status TBA",
    sourceUrl: `https://www.themoviedb.org/tv/${show.id}`,
    officialSite: show.homepage,
    trailerUrl: findTrailerUrl(show.videos?.results)
  };
}

function findTrailerUrl(videos = []) {
  const trailer = videos.find((video) => video.site === "YouTube" && video.type === "Trailer") ||
    videos.find((video) => video.site === "YouTube");
  return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : "";
}

function App() {
  const [query, setQuery] = useState("");
  const [activeGenre, setActiveGenre] = useState("All");
  const [genres, setGenres] = useState(FALLBACK_GENRES);
  const [genreMap, setGenreMap] = useState(new Map());
  const [titles, setTitles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(TMDB_API_KEY));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!TMDB_API_KEY) {
      setError("Add your TMDB key to .env as VITE_TMDB_API_KEY, then restart npm run dev.");
      return;
    }

    let isMounted = true;

    async function loadTmdbHome() {
      try {
        setIsLoading(true);
        const [genreData, trendingData] = await Promise.all([
          fetchTmdb("/genre/tv/list"),
          fetchTmdb("/trending/tv/week")
        ]);
        const nextGenreMap = new Map(genreData.genres.map((genre) => [genre.id, genre.name]));
        const normalized = trendingData.results.slice(0, 18).map((show, index) => normalizeShow(show, nextGenreMap, index));

        if (isMounted) {
          setGenreMap(nextGenreMap);
          setGenres(["All", ...genreData.genres.map((genre) => genre.name)]);
          setTitles(normalized);
          setSelected(normalized[0]);
          setWatchlist(normalized.slice(0, 3).map((show) => show.id));
          setError("");
        }
      } catch {
        if (isMounted) {
          setError("TMDB could not be loaded. Check that your API key is valid and restart the dev server.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadTmdbHome();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!TMDB_API_KEY || !query.trim()) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        const data = await fetchTmdb("/search/tv", { query: query.trim(), include_adult: "false" });
        const normalized = data.results.slice(0, 18).map((show, index) => normalizeShow(show, genreMap, index));

        setTitles(normalized);
        setSelected((current) => normalized.find((show) => show.id === current?.id) || normalized[0] || current);
        setActiveGenre("All");
        setError("");
      } catch {
        setError("TMDB search failed. Try again in a moment.");
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [genreMap, query]);

  async function hydrateShow(show) {
    if (!TMDB_API_KEY) {
      return;
    }

    try {
      const details = await fetchTmdb(`/tv/${show.id}`, { append_to_response: "videos,watch/providers" });
      const hydrated = normalizeShow({ ...details, genre_ids: details.genres?.map((genre) => genre.id) }, genreMap, show.rank - 1);
      setSelected(hydrated);
      setTitles((current) => current.map((item) => (item.id === hydrated.id ? { ...item, ...hydrated } : item)));
    } catch {
      setSelected(show);
    }
  }

  const filteredTitles = useMemo(() => {
    return titles.filter((item) => activeGenre === "All" || item.genres.includes(activeGenre));
  }, [activeGenre, titles]);

  const featured = selected || filteredTitles[0] || titles[0];
  const inWatchlist = featured ? watchlist.includes(featured.id) : false;

  function toggleWatchlist(id) {
    setWatchlist((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function openWatchPage(show) {
    window.open(show.trailerUrl || show.officialSite || show.sourceUrl, "_blank", "noopener,noreferrer");
  }

  if (!featured && isLoading) {
    return <main className="app app--loading">Loading TMDB shows...</main>;
  }

  return (
    <main className="app">
      <nav className="nav" aria-label="Primary">
        <a className="brand" href="#top" aria-label="Streamline home">
          <span>STREAM</span>LINE
        </a>
        <div className="nav__links">
          <a href="#browse">Browse</a>
          <a href="#analytics">TMDB Data</a>
          <a href="#watchlist">My List</a>
        </div>
        <div className="profile" aria-label="Profile initials">IU</div>
      </nav>

      {featured ? (
        <section
          id="top"
          className="hero"
          style={{ "--hero-image": `url(${featured.image})`, "--accent": featured.accent }}
        >
          <div className="hero__content">
            <div className="eyebrow">
              <Sparkles size={16} />
              Real TV metadata from TMDB
            </div>
            <p className="hero__meta">
              #{featured.rank} trending | {featured.type} | {featured.year} | {featured.rating}
            </p>
            <h1>{featured.title}</h1>
            <p className="hero__description">{featured.description}</p>
            <div className="hero__actions">
              <button className="button button--primary" type="button" onClick={() => openWatchPage(featured)}>
                <Play size={18} fill="currentColor" />
                {featured.trailerUrl ? "Watch Trailer" : "Open TMDB"}
              </button>
              <button className="button button--ghost" type="button" onClick={() => toggleWatchlist(featured.id)}>
                {inWatchlist ? <Check size={18} /> : <Bookmark size={18} />}
                {inWatchlist ? "Saved" : "My List"}
              </button>
              <a className="icon-button" href={featured.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${featured.title} on TMDB`}>
                <ExternalLink size={20} />
              </a>
            </div>
          </div>
          <aside className="spotlight" aria-label="Featured title details">
            <p className="spotlight__label">TMDB score</p>
            <strong>{featured.match}%</strong>
            <span>{featured.duration}</span>
            <div className="detail-list">
              <p>{featured.network}</p>
              <p>{featured.schedule}</p>
            </div>
            <div className="tag-list">
              {featured.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </aside>
        </section>
      ) : (
        <section id="top" className="hero hero--setup">
          <div className="hero__content">
            <div className="eyebrow">
              <Sparkles size={16} />
              TMDB setup needed
            </div>
            <h1>Add your API key</h1>
            <p className="hero__description">{error}</p>
          </div>
        </section>
      )}

      <section id="analytics" className="metrics" aria-label="Project highlights">
        <article>
          <TrendingUp size={20} />
          <strong>TMDB catalog</strong>
          <span>Trending TV and live search powered by TMDB</span>
        </article>
        <article>
          <Star size={20} />
          <strong>Real posters</strong>
          <span>Backdrops, summaries, ratings, genres, and season data</span>
        </article>
        <article>
          <Calendar size={20} />
          <strong>Legal playback paths</strong>
          <span>Trailer, official site, and TMDB links instead of hosted episodes</span>
        </article>
      </section>

      <section id="browse" className="browse">
        <div className="section-header">
          <div>
            <p className="section-kicker">Browse TMDB TV shows</p>
            <h2>Trending and searchable series</h2>
          </div>
          <label className="search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search shows like Suits or The Office"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {error && <p className="notice">{error}</p>}
        {isLoading && <p className="notice">Loading TMDB shows...</p>}

        <div className="filters" aria-label="Genre filters">
          {genres.map((genre) => (
            <button
              key={genre}
              className={genre === activeGenre ? "filter filter--active" : "filter"}
              type="button"
              onClick={() => setActiveGenre(genre)}
            >
              {genre}
            </button>
          ))}
        </div>

        <div className="title-grid">
          {filteredTitles.map((item) => (
            <button
              key={item.id}
              className="title-card"
              type="button"
              onClick={() => hydrateShow(item)}
              style={{ "--accent": item.accent, "--poster": `url(${item.poster || item.image})` }}
            >
              <span className="title-card__rank">#{item.rank}</span>
              <span className="title-card__save" aria-label={watchlist.includes(item.id) ? "Saved" : "Not saved"}>
                {watchlist.includes(item.id) ? <Check size={16} /> : <Bookmark size={16} />}
              </span>
              <span className="title-card__content">
                <strong>{item.title}</strong>
                <small>{item.genre} | {item.match}% score</small>
              </span>
            </button>
          ))}
        </div>

        {filteredTitles.length === 0 && !isLoading && (
          <p className="empty">No shows match that genre. Try another filter or search.</p>
        )}
      </section>

      <section id="watchlist" className="watchlist">
        <div>
          <p className="section-kicker">My List</p>
          <h2>{watchlist.length} saved shows</h2>
        </div>
        <div className="watchlist__items">
          {titles
            .filter((item) => watchlist.includes(item.id))
            .map((item) => (
              <button key={item.id} type="button" onClick={() => hydrateShow(item)}>
                <span>{item.title}</span>
                <small>{item.rating}</small>
              </button>
            ))}
        </div>
      </section>
    </main>
  );
}

export default App;
