# DelivCard – Flask + Azure

## Structure
```
delivcard/
├── app.py               # backend Flask (API + sert le frontend)
├── requirements.txt     # Flask + gunicorn
├── data/cards.csv       # les données des cartes
├── scss/style.scss      # SCSS d'origine (pour info)
└── static/
    ├── index.html
    ├── css/style.css    # SCSS converti en CSS
    └── js/app.js
```

## Données
`data/cards.csv` : 25 livraisons dans 9 régions (colonne `region`). Ouvre-le avec Excel pour ajouter des lignes ; garde les mêmes colonnes et un `id` unique. Coordonnées GPS : clic droit sur Google Maps pour les copier.

## API
| Méthode | URL | Rôle |
|---|---|---|
| GET  | `/` | la page de l'app |
| GET  | `/api/health` | test : `{"status":"ok"}` |
| GET  | `/api/regions` | liste des régions + nombre de livraisons |
| GET  | `/api/cards` | toutes les cartes (depuis le CSV) |
| GET  | `/api/cards?region=Occitanie` | cartes d'une seule région |
| GET  | `/api/cards/<id>` | une carte |
| GET  | `/api/cards/<id>/route` | trajet réel : distance, durée, tracé (OSRM) |
| POST | `/api/cards/<id>/request` | +1 « requests » (bouton Request) |

## Lancer en local
```bash
python -m venv venv
# Windows : venv\Scripts\activate    |  Mac/Linux : source venv/bin/activate
pip install -r requirements.txt
python app.py
```
Ouvrir http://localhost:5000
