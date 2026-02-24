from __future__ import annotations

import os
import pandas as pd


def load_tmdb(credits_csv: str, movies_csv: str) -> pd.DataFrame:
    df_credits = pd.read_csv(credits_csv)
    df_movies = pd.read_csv(movies_csv)
    df_credits = df_credits.rename(columns={"movie_id": "id"})
    df_movies = df_movies.drop(columns=["title"], errors="ignore")

    df_tmdb = pd.merge(df_credits, df_movies, on="id", how="inner")
    return df_tmdb


def load_ratings(ratings_csv: str) -> pd.DataFrame:
    return pd.read_csv(ratings_csv)


def load_all(data_dir: str = "data") -> tuple[pd.DataFrame, pd.DataFrame]:
    credits = os.path.join(data_dir, "tmdb_5000_credits.csv")
    movies = os.path.join(data_dir, "tmdb_5000_movies.csv")
    ratings = os.path.join(data_dir, "ratings_small.csv")
    return load_tmdb(credits, movies), load_ratings(ratings)
