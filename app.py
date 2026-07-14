import os
import pickle
import math
import requests
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, 'model')

with open(os.path.join(MODEL_DIR, 'movies_data.pkl'), 'rb') as f:
    movies_data = pickle.load(f)

with open(os.path.join(MODEL_DIR, 'similarity_indices.pkl'), 'rb') as f:
    similarity_indices = pickle.load(f)

with open(os.path.join(MODEL_DIR, 'filter_options.pkl'), 'rb') as f:
    filter_options = pickle.load(f)


def movie_to_dict(row):
    return {
        'movie_id': int(row['movie_id']),
        'title': row['title'],
        'release_date': row['release_date'],
        'vote_average': float(row['vote_average']),
        'popularity': float(row['popularity']),
        'genres': row['genres'],
        'industry': row['industry'],
        'cast': row['cast'],
        'director': row['director'],
        'rating_tier': row['rating_tier'],
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/filters')
def get_filters():
    return jsonify(filter_options)


@app.route('/api/movies')
def get_movies():
    result = []
    for idx, row in movies_data.iterrows():
        result.append({
            'id': int(row['movie_id']),
            'title': row['title'],
            'index': idx,
        })
    result.sort(key=lambda m: m['title'])
    return jsonify(result)


@app.route('/api/discover', methods=['POST'])
def discover():
    data = request.get_json(force=True)
    df = movies_data.copy()

    industry = data.get('industry', '')
    genre = data.get('genre', '')
    rating_tier = data.get('rating_tier', '')
    actor = data.get('actor', '')
    sort_by = data.get('sort_by', 'popularity')
    page = int(data.get('page', 1))
    per_page = 12

    if industry:
        df = df[df['industry'] == industry]

    if genre:
        df = df[df['genres'].apply(lambda g: genre in g)]

    if rating_tier:
        df = df[df['rating_tier'] == rating_tier]

    if actor:
        actor_lower = actor.lower()
        df = df[df['cast'].apply(lambda c: any(actor_lower in name.lower() for name in c))]

    if sort_by == 'rating':
        df = df.sort_values('vote_average', ascending=False)
    elif sort_by == 'year':
        df = df.sort_values('release_date', ascending=False)
    else:
        df = df.sort_values('popularity', ascending=False)

    total_count = len(df)
    total_pages = max(1, math.ceil(total_count / per_page))
    page = max(1, min(page, total_pages))

    start = (page - 1) * per_page
    end = start + per_page
    page_df = df.iloc[start:end]

    movies = [movie_to_dict(row) for _, row in page_df.iterrows()]

    return jsonify({
        'movies': movies,
        'total_count': total_count,
        'page': page,
        'total_pages': total_pages,
    })


@app.route('/api/recommend', methods=['POST'])
def recommend():
    data = request.get_json(force=True)

    movie_index = data.get('movie_index')
    movie_id = data.get('movie_id')

    if movie_index is not None:
        movie_index = int(movie_index)
    elif movie_id is not None:
        matches = movies_data[movies_data['movie_id'] == int(movie_id)]
        if matches.empty:
            return jsonify({'error': 'Movie not found'}), 404
        movie_index = matches.index[0]
    else:
        return jsonify({'error': 'Provide movie_index or movie_id'}), 400

    if movie_index < 0 or movie_index >= len(movies_data):
        return jsonify({'error': 'Invalid movie index'}), 400

    selected = movie_to_dict(movies_data.iloc[movie_index])
    similar_indices = similarity_indices[movie_index]
    recommendations = [movie_to_dict(movies_data.iloc[int(i)]) for i in similar_indices]

    return jsonify({
        'selected_movie': selected,
        'recommendations': recommendations,
    })


@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'movies_count': len(movies_data)})


@app.route('/api/tmdb/<int:movie_id>')
def tmdb_proxy(movie_id):
    api_key = os.environ.get('TMDB_API_KEY', '')
    if not api_key:
        return jsonify({'poster': None, 'backdrop': None})
    
    try:
        url = f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={api_key}"
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            data = res.json()
            return jsonify({
                'poster': f"https://image.tmdb.org/t/p/w500{data['poster_path']}" if data.get('poster_path') else None,
                'backdrop': f"https://image.tmdb.org/t/p/w1280{data['backdrop_path']}" if data.get('backdrop_path') else None,
            })
    except Exception:
        pass
        
    return jsonify({'poster': None, 'backdrop': None})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
