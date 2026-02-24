const express = require('express');
const app = express();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend'), {
  extensions: ['html']
}));

const userRoutes = require('./routes/user');
const movieRoutes = require('./routes/movies');
const recommendationRoutes = require('./routes/recommendations');
const favoritesRoutes = require('./routes/favorites');
const { errorHandler } = require('./middleware/errorHandler');

app.use('/api/users', userRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/favorites', favoritesRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
