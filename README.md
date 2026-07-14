# TMDB Movie Recommendation System
This repository contains a full-stack Machine Learning application that recommends similar movies using content-based filtering. The system is trained on the TMDB 5000 Movies dataset and built with an optimized data pipeline designed for lightweight, memory-efficient production deployments.

Live Web Application: https://movie-recommender-XXXX.onrender.com/

---

## Table of Contents
- Project Architecture
- Key Features
- Technical Stack
- Project Directory Structure
- Model Training & Performance
- Deployment Configuration

---

## Project Architecture

The application is built on a decoupled client-server architecture:

1. Jupyter Notebook: Performs EDA, cleans JSON structures (genres, keywords, cast, crew), computes CountVectorizer bag-of-words representation, calculates Cosine Similarity, and precomputes recommendation indices.
2. Flask API: Serves as the web backend, loading the serialized list of movies and precomputed recommendation indices.
3. Web Interface: Provides a search input with instant autocomplete suggestions, renders clean responsive movie cards, and queries TMDB API on the client-side to fetch movie posters.

---

## Key Features

- **Autocomplete Search Box:** High-speed dropdown suggestions filtering over 4,800 movies.
- **Client-Side Poster Fetching:** Real-time integration with TMDB API. If a user inputs their API key, it displays official high-quality posters and backdrops. If not, it falls back to a clean minimalist text placeholder.
- **Optimized Memory Export:** Instead of saving a 100MB+ float matrix, the system precomputes and saves only the top 8 recommendation indices as an integer array. This reduces model files to **less than 100KB**, ensuring it runs reliably on free deployment platforms with tight memory limits (e.g. Render).
- **Responsive Slate UI:** A clean, flat design styled with slate-based colors, crisp boundaries, and smooth transitions. No neon glows or distracting layouts.

---

## Technical Stack

- Data Analysis & Modeling: Python, Pandas, NumPy, Scikit-Learn (CountVectorizer, Cosine Similarity)
- Backend Framework: Flask (WSGI Web Server Gateway Interface)
- Production Server: Gunicorn
- Frontend: HTML5, CSS3 (Slate Grid System), JavaScript (ES6 Fetch API)
- Deployment Platform: Render

---

## Project Directory Structure

```
movie-recommender/
├── notebook/
│   └── movie_recommender.ipynb  # Data cleaning, modeling, and index precomputation
├── data/
│   ├── tmdb_5000_movies.csv     # Raw movies dataset
│   └── tmdb_5000_credits.csv    # Raw credits dataset
├── model/
│   ├── movies_list.pkl          # Cleaned movie metadata list (exported)
│   └── similarity_indices.pkl   # Tiny precomputed recommendation indices map (exported)
├── templates/
│   └── index.html               # Web dashboard template
├── static/
│   ├── style.css                # Slate-themed stylesheet
│   └── app.js                   # Client-side auto-complete and fetch logic
├── app.py                       # Flask server entry point
├── requirements.txt             # Python dependencies
├── Procfile                     # Deployment start command for Render
└── README.md                    # Project documentation
```

---

## Model Training & Performance

### Preprocessing Steps
1. Merged movie datasets on title.
2. Cleaned JSON string formats for genres, keywords, cast, and crew.
3. Collapsed spaces in words (e.g., "science fiction" to "sciencefiction") to prevent vocabulary separation in vectorization.
4. Combined keywords, cast, crew, genres, and overview into a single text features column (`tags`).

### Vectorization Details
- Vectorizer: CountVectorizer (Bag of Words)
- Max Features: 5,000 words
- Stop Words: English
- Similarity Metric: Cosine Similarity

---

## Deployment Configuration

The application is deployed on Render's Free tier using the following build settings:
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app`
