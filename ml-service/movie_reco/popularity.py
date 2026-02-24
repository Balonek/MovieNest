from __future__ import annotations
import pandas as pd


def weighted_rating(row: pd.Series, m: float, C: float) -> float:
    vote_count = row["vote_count"]
    vote_avg = row["vote_average"]
    return (vote_count / (vote_count + m)) * vote_avg + (m / (vote_count + m)) * C


def top_weighted(
    df_tmdb: pd.DataFrame,
    top_n = 10,
    vote_count_quantile = 0.90,
    title_col = "title",
) -> pd.DataFrame:

    df = df_tmdb.copy()
    df["vote_average"] = pd.to_numeric(df["vote_average"], errors="coerce")
    df["vote_count"] = pd.to_numeric(df["vote_count"], errors="coerce")

    C = df["vote_average"].mean()
    m = df["vote_count"].quantile(vote_count_quantile)

    qualified = df[df["vote_count"] >= m].copy()
    qualified["score"] = qualified.apply(weighted_rating, axis=1, m=m, C=C)

    cols = [c for c in ["id", title_col, "vote_count", "vote_average", "score"] if c in qualified.columns]
    return qualified.sort_values("score", ascending=False)[cols].head(top_n).reset_index(drop=True)
