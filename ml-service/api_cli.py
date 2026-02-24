import argparse
import json
import os
import sys
from movie_reco import (
    load_all,
    top_weighted,
    prepare_tmdb_metadata,
)
from model_cache import load_or_train_svd, load_or_train_overview, load_or_train_soup

def _ok(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))


def _err(message, code=2, **extra):
    payload = {"ok": False, "message": message}
    payload.update(extra)
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.exit(code)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data-dir",
        default=os.path.abspath(os.path.join(os.path.dirname(__file__), "data")),
    )
    parser.add_argument("--mode", required=True, choices=["popular", "overview", "soup", "svd"]) 
    parser.add_argument("--title")
    parser.add_argument("--user-id", type=int)
    parser.add_argument("--top-n", type=int, default=10)
    parser.add_argument("--k", type=int, default=10)

    args = parser.parse_args()

    try:
        df_tmdb, df_ratings = load_all(args.data_dir)
    except Exception as e:
        _err("Datasets not found or invalid", details=str(e), data_dir=args.data_dir)

    try:
        if args.mode == "popular":
            df = top_weighted(df_tmdb, top_n=args.top_n)
            _ok({"ok": True, "mode": args.mode, "items": df.to_dict(orient="records")})
            return

        if args.mode == "overview":
            if not args.title:
                _err("Missing title")
            rec = load_or_train_overview(df_tmdb)
            df = rec.recommend(args.title, top_k=args.k)
            _ok({"ok": True, "mode": args.mode, "seed": args.title, "items": df.to_dict(orient="records")})
            return

        if args.mode == "soup":
            if not args.title:
                _err("Missing title")
            df_meta = prepare_tmdb_metadata(df_tmdb)
            rec = load_or_train_soup(df_meta)
            df = rec.recommend(args.title, top_k=args.k)
            _ok({"ok": True, "mode": args.mode, "seed": args.title, "items": df.to_dict(orient="records")})
            return

        if args.mode == "svd":
            if args.user_id is None:
                _err("Missing user-id")
            svd = load_or_train_svd(df_ratings)
            items = svd.recommend_top_k(args.user_id, k=args.k)
            _ok({"ok": True, "mode": args.mode, "userId": args.user_id, "items": [{"movieId": m, "score": s} for m, s in items]})
            return

        _err("Unsupported mode")

    except KeyError as e:
        _err("Seed not found", details=str(e))
    except Exception as e:
        _err("Internal python error", details=str(e))


if __name__ == "__main__":
    main()
