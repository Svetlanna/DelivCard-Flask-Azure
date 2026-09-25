
import csv
import json
import math
import os
import threading
import urllib.request

from flask import Flask, jsonify, abort, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data", "cards.csv")

INT_FIELDS = {"price", "requests", "pledge", "weight", "rating", "ratingCount"}
# Colonnes GPS (décimales)
FLOAT_FIELDS = {"fromLat", "fromLng", "toLat", "toLng"}

# Itinéraire : service gratuit OSRM (OpenStreetMap)
OSRM_URL = ("https://router.project-osrm.org/route/v1/driving/"
            "{fromLng},{fromLat};{toLng},{toLat}?overview=full&geometries=geojson")
AVG_SPEED_KMH = 25        # vitesse moyenne en ville (si OSRM ne répond pas)
ROUTE_CACHE = {}          # garde les trajets déjà calculés en mémoire

app = Flask(__name__, static_folder="static", static_url_path="/static")
lock = threading.Lock()


def read_cards():
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        cards = list(csv.DictReader(f))
    for card in cards:
        for key in INT_FIELDS:
            card[key] = int(card[key])
        for key in FLOAT_FIELDS:
            card[key] = float(card[key])
    return cards


def write_cards(cards):
    fieldnames = list(cards[0].keys())
    with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(cards)


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(a))


def compute_route(card):

    key = (card["fromLat"], card["fromLng"], card["toLat"], card["toLng"])
    if key in ROUTE_CACHE:
        return ROUTE_CACHE[key]




    try:
        url = OSRM_URL.format(**card)
        req = urllib.request.Request(url, headers={"User-Agent": "delivcard/1.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.load(resp)
        route = data["routes"][0]
        result = {
            "source": "osrm",
            "distance_m": round(route["distance"]),
            "duration_s": round(route["duration"]),
            # OSRM donne [lng, lat] -> Leaflet veut [lat, lng]
            "geometry": [[lat, lng] for lng, lat in route["geometry"]["coordinates"]],
        }
        ROUTE_CACHE[key] = result
        return result
    except Exception as err:
        app.logger.warning("OSRM indisponible (%s) -> estimation", err)
        km = haversine_km(*key) * 1.3          # +30 % car les rues ne sont pas droites
        return {
            "source": "estimate",
            "distance_m": round(km * 1000),
            "duration_s": round(km / AVG_SPEED_KMH * 3600),
            "geometry": [[key[0], key[1]], [key[2], key[3]]],
        }


# ---------- Frontend ----------
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


# ---------- API ----------
@app.route("/api/health")
def health():
    return jsonify(status="ok")


@app.route("/api/regions", methods=["GET"])
def get_regions():
    """Liste des régions + nombre de livraisons dans chacune."""
    counts = {}
    for card in read_cards():
        counts[card["region"]] = counts.get(card["region"], 0) + 1
    return jsonify([{"name": name, "count": n} for name, n in sorted(counts.items())])


@app.route("/api/cards", methods=["GET"])
def get_cards():

    cards = read_cards()
    region = request.args.get("region")
    if region:
        cards = [c for c in cards if c["region"] == region]
    return jsonify(cards)


@app.route("/api/cards/<card_id>", methods=["GET"])
def get_card(card_id):
    card = next((c for c in read_cards() if c["id"] == card_id), None)
    if card is None:
        abort(404, description="Card not found")
    return jsonify(card)


@app.route("/api/cards/<card_id>/route", methods=["GET"])
def get_route(card_id):
    """Trajet réel : distance (m), durée (s) et tracé pour la carte."""
    card = next((c for c in read_cards() if c["id"] == card_id), None)
    if card is None:
        abort(404, description="Card not found")
    return jsonify(compute_route(card))


@app.route("/api/cards/<card_id>/request", methods=["POST"])
def request_card(card_id):

    with lock:
        cards = read_cards()
        card = next((c for c in cards if c["id"] == card_id), None)
        if card is None:
            abort(404, description="Card not found")
        card["requests"] += 1
        write_cards(cards)
    return jsonify(card)


@app.errorhandler(404)
def not_found(e):
    return jsonify(error=str(e.description)), 404


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
