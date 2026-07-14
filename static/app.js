const state = {
  moviesList: [],
  actorsList: [],
  currentPage: 1,
  currentFilters: {},
  tmdbCache: new Map(),
  tmdbCache: new Map(),
};

const $ = (id) => document.getElementById(id);

// --- Init ---

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadFilters(), loadMovies()]);
  setupEventListeners();
});

async function loadFilters() {
  try {
    const res = await fetch('/api/filters');
    const data = await res.json();
    populateDropdown($('filter-industry'), data.industries);
    populateDropdown($('filter-genre'), data.genres);
    populateDropdown($('filter-rating'), data.rating_tiers);
    state.actorsList = data.actors || [];
  } catch (e) {
    console.error('Failed to load filters:', e);
  }
}

async function loadMovies() {
  try {
    const res = await fetch('/api/movies');
    state.moviesList = await res.json();
  } catch (e) {
    console.error('Failed to load movies:', e);
  }
}

function populateDropdown(select, items) {
  select.innerHTML = '<option value="">All</option>';
  items.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
}

// --- Event Listeners ---

function setupEventListeners() {
  $('discover-btn').addEventListener('click', () => discover(1));
  $('reset-btn').addEventListener('click', resetFilters);
  $('filter-actor').addEventListener('input', onActorInput);
  $('search-input').addEventListener('input', onSearchInput);
  $('search-input').addEventListener('keydown', onSearchKeydown);
  $('clear-search').addEventListener('click', clearSearch);
  $('clear-search').addEventListener('click', clearSearch);
  $('retry-btn').addEventListener('click', () => discover(state.currentPage));

  document.querySelectorAll('.tag-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const title = btn.textContent.trim();
      const movie = state.moviesList.find((m) => m.title.toLowerCase() === title.toLowerCase());
      if (movie) {
        $('search-input').value = movie.title;
        getRecommendations(movie.index);
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!$('filter-actor').contains(e.target) && !$('actor-suggestions').contains(e.target)) {
      $('actor-suggestions').classList.remove('active');
    }
    if (!$('search-container').contains(e.target)) {
      $('suggestions-dropdown').classList.remove('active');
    }
  });
}

// --- State Management ---

function showState(stateId) {
  ['welcome-state', 'loading-state', 'error-state', 'results-state'].forEach((id) => {
    $(id).classList.toggle('hidden', id !== stateId);
  });
}

function showError(msg) {
  $('error-message').textContent = msg;
  showState('error-state');
}

// --- Discovery ---

async function discover(page) {
  state.currentPage = page;
  state.currentFilters = {
    industry: $('filter-industry').value,
    genre: $('filter-genre').value,
    rating_tier: $('filter-rating').value,
    actor: $('filter-actor').value,
    sort_by: 'popularity',
    page,
  };

  showState('loading-state');
  $('spotlight-section').classList.add('hidden');

  try {
    const res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.currentFilters),
    });
    const data = await res.json();

    $('results-header').textContent = `Showing ${data.movies.length} of ${data.total_count} movies`;
    await renderMovieCards(data.movies);
    renderPagination(data.page, data.total_pages);
    showState('results-state');
  } catch (e) {
    showError('Failed to fetch movies. Please try again.');
  }
}

function resetFilters() {
  $('filter-industry').selectedIndex = 0;
  $('filter-genre').selectedIndex = 0;
  $('filter-rating').selectedIndex = 0;
  $('filter-actor').value = '';
  $('search-input').value = '';
  $('spotlight-section').classList.add('hidden');
  showState('welcome-state');
}

// --- Recommendations ---

async function getRecommendations(movieIndex) {
  showState('loading-state');
  $('suggestions-dropdown').classList.add('hidden');

  try {
    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movie_index: movieIndex }),
    });
    const data = await res.json();

    renderSpotlight(data.selected_movie);
    $('results-header').textContent = `Movies similar to: ${data.selected_movie.title}`;
    await renderMovieCards(data.recommendations);
    $('pagination').innerHTML = '';
    showState('results-state');
  } catch (e) {
    showError('Failed to get recommendations. Please try again.');
  }
}

// --- Spotlight ---

async function renderSpotlight(movie) {
  $('spotlight-title').textContent = movie.title;
  $('spotlight-rating').textContent = `★ ${movie.vote_average.toFixed(1)}`;
  $('spotlight-year').textContent = movie.release_date ? movie.release_date.substring(0, 4) : '—';
  $('spotlight-popularity').textContent = `Popularity: ${Math.round(movie.popularity)}`;
  $('spotlight-director').textContent = movie.director || 'Unknown';

  $('spotlight-genres').innerHTML = (movie.genres || [])
    .map((g) => `<span class="genre-tag">${g}</span>`)
    .join('');

  $('spotlight-cast').textContent = (movie.cast || []).slice(0, 6).join(', ') || 'N/A';

  const tmdb = await getTMDB(movie.movie_id);
  const poster = $('spotlight-poster');
  const placeholder = $('spotlight-poster-placeholder');
  const backdrop = $('spotlight-backdrop');

  if (tmdb && tmdb.poster) {
    poster.src = tmdb.poster;
    poster.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    poster.style.display = 'none';
    placeholder.style.display = 'flex';
  }

  if (backdrop && tmdb && tmdb.backdrop) {
    backdrop.style.backgroundImage = `url(${tmdb.backdrop})`;
    backdrop.classList.remove('hidden');
  } else if (backdrop) {
    backdrop.style.backgroundImage = '';
    backdrop.classList.add('hidden');
  }

  $('spotlight-section').classList.remove('hidden');
}

// --- Movie Cards ---

async function renderMovieCards(movies) {
  const grid = $('movies-grid');
  grid.innerHTML = '';

  const tmdbResults = await Promise.all(
    movies.map((m) => getTMDB(m.movie_id))
  );

  movies.forEach((movie, i) => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.addEventListener('click', () => {
      const match = state.moviesList.find((m) => m.id === movie.movie_id || m.title === movie.title);
      if (match) getRecommendations(match.index);
    });

    const tmdb = tmdbResults[i];
    const year = movie.release_date ? movie.release_date.substring(0, 4) : '—';
    const genre = (movie.genres && movie.genres[0]) || '';

    card.innerHTML = `
      <div class="card-poster">
        ${tmdb && tmdb.poster
          ? `<img src="${tmdb.poster}" alt="${movie.title}" loading="lazy">`
          : `<div class="card-poster-placeholder"><span>🎬</span></div>`}
        <div class="card-rating">★ ${movie.vote_average.toFixed(1)}</div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${movie.title}</h3>
        <p class="card-meta">${year}${genre ? ' · ' + genre : ''}</p>
        ${movie.industry ? `<span class="card-industry">${movie.industry}</span>` : ''}
        ${movie.director ? `<p class="card-director">${movie.director}</p>` : ''}
      </div>
    `;

    grid.appendChild(card);
  });
}

// --- Pagination ---

function renderPagination(current, total) {
  const container = $('pagination');
  container.innerHTML = '';
  if (total <= 1) return;

  const addBtn = (label, page, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'page-btn' + (active ? ' active' : '');
    btn.disabled = disabled;
    if (!disabled && !active) btn.addEventListener('click', () => discover(page));
    container.appendChild(btn);
  };

  addBtn('←', current - 1, current === 1);

  let start = Math.max(1, current - 2);
  let end = Math.min(total, start + 4);
  start = Math.max(1, end - 4);

  for (let i = start; i <= end; i++) {
    addBtn(i, i, false, i === current);
  }

  addBtn('→', current + 1, current === total);
}

// --- Actor Autocomplete ---

function onActorInput() {
  const val = $('filter-actor').value.toLowerCase().trim();
  const dropdown = $('actor-suggestions');

  if (val.length < 2) {
    dropdown.classList.add('hidden');
    return;
  }

  const matches = state.actorsList
    .filter((a) => a.toLowerCase().includes(val))
    .slice(0, 8);

  if (!matches.length) {
    dropdown.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = matches
    .map((a) => `<div class="suggestion-item">${a}</div>`)
    .join('');

  dropdown.querySelectorAll('.suggestion-item').forEach((item) => {
    item.addEventListener('click', () => {
      $('filter-actor').value = item.textContent;
      dropdown.classList.add('hidden');
    });
  });

  dropdown.classList.remove('hidden');
}

// --- Movie Search ---

let searchHighlight = -1;

function onSearchInput() {
  const val = $('search-input').value.toLowerCase().trim();
  const dropdown = $('suggestions-dropdown');
  searchHighlight = -1;

  if (val.length < 2) {
    dropdown.classList.remove('active');
    return;
  }

  const matches = state.moviesList
    .filter((m) => m.title.toLowerCase().includes(val))
    .slice(0, 8);

  if (!matches.length) {
    dropdown.classList.remove('active');
    return;
  }

  dropdown.innerHTML = matches
    .map((m, i) => `<div class="suggestion-item" data-index="${m.index}" data-pos="${i}">${m.title}</div>`)
    .join('');

  dropdown.querySelectorAll('.suggestion-item').forEach((item) => {
    item.addEventListener('click', () => {
      $('search-input').value = item.textContent;
      getRecommendations(parseInt(item.dataset.index));
    });
  });

  dropdown.classList.remove('hidden');
}

function onSearchKeydown(e) {
  const dropdown = $('suggestions-dropdown');
  const items = dropdown.querySelectorAll('.suggestion-item');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    searchHighlight = Math.min(searchHighlight + 1, items.length - 1);
    updateSearchHighlight(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    searchHighlight = Math.max(searchHighlight - 1, 0);
    updateSearchHighlight(items);
  } else if (e.key === 'Enter' && searchHighlight >= 0) {
    e.preventDefault();
    items[searchHighlight].click();
  } else if (e.key === 'Escape') {
    dropdown.classList.remove('active');
    searchHighlight = -1;
  }
}

function updateSearchHighlight(items) {
  items.forEach((item, i) => {
    item.classList.toggle('highlighted', i === searchHighlight);
  });
}

function clearSearch() {
  $('search-input').value = '';
  $('suggestions-dropdown').classList.remove('active');
}

// --- TMDB ---

async function getTMDB(movieId) {
  if (!movieId) return null;
  if (state.tmdbCache.has(movieId)) return state.tmdbCache.get(movieId);

  try {
    const res = await fetch(`/api/tmdb/${movieId}`);
    if (!res.ok) return null;
    const data = await res.json();
    state.tmdbCache.set(movieId, data);
    return data;
  } catch {
    return null;
  }
}

