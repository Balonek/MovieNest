from __future__ import annotations
import ast
from dataclasses import dataclass
from typing import Iterable
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.metrics.pairwise import linear_kernel, cosine_similarity


def parse_if_str(x):
    if isinstance(x, str):
        return ast.literal_eval(x)
    return x


def safe_parse_list(x):
    if isinstance(x, list):
        return x
    if isinstance(x, str):
        x = x.strip()
        if x == "" or x.lower() == "nan":
            return []
        try:
            v = ast.literal_eval(x)
            return v if isinstance(v, list) else []
        except Exception:
            return []
    return []


def get_top_n_names(list_of_dicts, n: int):
    if not isinstance(list_of_dicts, list):
        return []
    out = []
    for d in list_of_dicts:
        if isinstance(d, dict):
            name = d.get("name", "")
            if name:
                out.append(name)
        if len(out) >= n:
            break
    return out


def clean_list(xs: Iterable[str]) -> list[str]:
    out = []
    for x in xs:
        if not isinstance(x, str):
            continue
        x = x.lower().replace(" ", "")
        if x:
            out.append(x)
    return out


def clean_str(s: str) -> str:
    if not isinstance(s, str):
        return ""
    return s.lower().replace(" ", "")


def get_director(crew_list) -> str:
    if not isinstance(crew_list, list):
        return ""
    for d in crew_list:
        if isinstance(d, dict) and d.get("job") == "Director":
            return d.get("name", "")
    return ""


def create_soup(row: pd.Series) -> str:
    return (
        " ".join(row.get("keywords_clean", [])) + " " +
        " ".join(row.get("actors", [])) + " " +
        row.get("director", "") + " " +
        " ".join(row.get("genres_clean", [])) + " " +
        " ".join(row.get("prod_clean", [])) + " " +
        row.get("tagline_clean", "") + " " +
        row.get("original_title_clean", "")
    ).strip()


def prepare_tmdb_metadata(
    df_tmdb: pd.DataFrame,
    top_actors = 3,
    top_keywords = 6,
    top_companies = 2,
) -> pd.DataFrame:

    df = df_tmdb.copy()

    list_cols = ["cast", "crew", "genres", "keywords", "production_companies"]

    for c in list_cols:
        df[c] = df[c].fillna("[]").apply(safe_parse_list)

    if "tagline" not in df.columns:
        df["tagline"] = ""
    df["tagline"] = df["tagline"].fillna("").astype(str)

    if "original_title" not in df.columns:
        df["original_title"] = df.get("title", "").fillna("").astype(str)
    df["original_title"] = df["original_title"].fillna("").astype(str)

    df["director"] = df["crew"].apply(get_director).apply(clean_str)
    df["actors"] = df["cast"].apply(lambda x: clean_list(get_top_n_names(x, top_actors)))
    df["keywords_clean"] = df["keywords"].apply(lambda x: clean_list(get_top_n_names(x, top_keywords)))
    df["genres_clean"] = df["genres"].apply(lambda x: clean_list(get_top_n_names(x, 50)))
    df["prod_clean"] = df["production_companies"].apply(lambda x: clean_list(get_top_n_names(x, top_companies)))
    df["tagline_clean"] = df["tagline"].apply(clean_str)
    df["original_title_clean"] = df["original_title"].apply(clean_str)

    df["soup"] = df.apply(create_soup, axis=1)
    return df


@dataclass
class OverviewTfidfRecommender:
    df: pd.DataFrame
    title_col = "title"
    text_col = "overview"

    def __post_init__(self):
        self.df = self.df.copy()
        self.df[self.text_col] = self.df[self.text_col].fillna("").astype(str)

        self._tfidf = TfidfVectorizer(stop_words="english")
        self._tfidf_matrix = self._tfidf.fit_transform(self.df[self.text_col])

        self._cosine = linear_kernel(self._tfidf_matrix, self._tfidf_matrix)
        self._indices = pd.Series(self.df.index, index=self.df[self.title_col]).drop_duplicates()

    def recommend(self, title: str, top_k: int = 10) -> pd.DataFrame:
        if title not in self._indices:
            raise KeyError(f"Title not found: {title}")

        idx = int(self._indices[title])
        sim_scores = list(enumerate(self._cosine[idx]))
        sim_scores.sort(key=lambda x: x[1], reverse=True)
        sim_scores = sim_scores[1 : top_k + 1]
        movie_indices = [i for i, _ in sim_scores]

        cols = [c for c in ["id", self.title_col, "vote_average", "vote_count"] if c in self.df.columns]
        return self.df.iloc[movie_indices][cols].reset_index(drop=True)


@dataclass
class MetadataSoupRecommender:
    df: pd.DataFrame
    title_col = "original_title"
    soup_col = "soup"

    def __post_init__(self):
        self.df = self.df.copy()
        self.df[self.soup_col] = self.df[self.soup_col].fillna("").astype(str)

        self._cv = CountVectorizer(stop_words="english")
        self._cv_matrix = self._cv.fit_transform(self.df[self.soup_col])

        self._cosine = cosine_similarity(self._cv_matrix, self._cv_matrix)
        self._indices = pd.Series(self.df.index, index=self.df[self.title_col]).drop_duplicates()

    def recommend(self, title: str, top_k: int = 10) -> pd.DataFrame:
        if title not in self._indices:
            raise KeyError(f"Title not found: {title}")

        idx = int(self._indices[title])
        sim_scores = list(enumerate(self._cosine[idx]))
        sim_scores.sort(key=lambda x: x[1], reverse=True)
        sim_scores = sim_scores[1 : top_k + 1]
        movie_indices = [i for i, _ in sim_scores]

        cols = [c for c in ["id", self.title_col, "vote_average", "vote_count"] if c in self.df.columns]
        return self.df.iloc[movie_indices][cols].reset_index(drop=True)
