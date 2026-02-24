from __future__ import annotations
from dataclasses import dataclass
import pandas as pd
from surprise import Dataset, Reader, SVD
from surprise.model_selection import cross_validate


@dataclass
class SvdRecommender:
    n_factors = 100
    n_epochs = 20
    random_state = 42

    def __post_init__(self):
        self._df_ratings = None
        self._user_rated = {}
        self._all_movies = []
        

    def fit(self, df_ratings: pd.DataFrame):
        self._df_ratings = df_ratings.copy()
        
        self.model = SVD(n_factors=self.n_factors, n_epochs=self.n_epochs, random_state=self.random_state)
        reader = Reader()
        data = Dataset.load_from_df(self._df_ratings[["userId", "movieId", "rating"]], reader)
        trainset = data.build_full_trainset()
        self.model.fit(trainset)

        self._user_rated = self._df_ratings.groupby("userId")["movieId"].apply(set).to_dict()
        self._all_movies = self._df_ratings["movieId"].unique().tolist()
        return self

    def recommend_top_k(self, user_id: int, k: int = 10) -> list[tuple[int, float]]:
        if self._df_ratings is None:
            raise RuntimeError("Call fit(df_ratings) before recommending.")

        rated = self._user_rated.get(user_id, set())
        candidates = [m for m in self._all_movies if m not in rated]

        preds: list[tuple[int, float]] = []
        for movie_id in candidates:
            preds.append((movie_id, self.model.predict(user_id, movie_id).est))

        preds.sort(key=lambda x: x[1], reverse=True)
        return preds[:k]

    def cross_validate(self, df_ratings: pd.DataFrame, cv: int = 5):
        reader = Reader()
        data = Dataset.load_from_df(df_ratings[["userId", "movieId", "rating"]], reader)
        return cross_validate(self.model, data, measures=["RMSE", "MAE"], cv=cv, verbose=False)
