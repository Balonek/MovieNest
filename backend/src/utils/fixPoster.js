function fixPoster(movie) {
    if (movie && movie.posterUrl && !movie.posterUrl.startsWith('http')) {
        movie.posterUrl = 'https://image.tmdb.org/t/p/w500' + movie.posterUrl;
    }
    return movie;
}

module.exports = { fixPoster };
