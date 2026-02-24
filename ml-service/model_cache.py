from __future__ import annotations
import os
import joblib
from datetime import datetime, timedelta

ONE_DAY = timedelta(days=1)

def _is_fresh(model_path: str) -> bool:
    if not os.path.exists(model_path):
        return False
    mtime = datetime.fromtimestamp(os.path.getmtime(model_path))
    return datetime.now() - mtime < ONE_DAY

def load_or_train_svd(df_ratings, model_path="ml-service/data/svd_model.pkl", n_factors=100, n_epochs=20):
    if _is_fresh(model_path):
        return joblib.load(model_path)
    from movie_reco.collaborative import SvdRecommender
    svd = SvdRecommender(n_factors=n_factors, n_epochs=n_epochs).fit(df_ratings)
    joblib.dump(svd, model_path)
    return svd

def load_or_train_overview(df_tmdb, model_path="ml-service/data/overview_model.pkl"):
    if _is_fresh(model_path):
        return joblib.load(model_path)
    from movie_reco.content import OverviewTfidfRecommender
    rec = OverviewTfidfRecommender(df_tmdb, title_col="title", text_col="overview")
    joblib.dump(rec, model_path)
    return rec

def load_or_train_soup(df_meta, model_path="ml-service/data/soup_model.pkl"):
    if _is_fresh(model_path):
        return joblib.load(model_path)
    from movie_reco.content import MetadataSoupRecommender
    rec = MetadataSoupRecommender(df_meta, title_col="original_title", soup_col="soup")
    joblib.dump(rec, model_path)
    return rec
