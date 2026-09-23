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
cd delivcard
python -m venv venv
# Windows : venv\Scripts\activate    |  Mac/Linux : source venv/bin/activate
pip install -r requirements.txt
python app.py
```
Ouvrir http://localhost:5000

## Déployer sur Azure (App Service)
Installer Azure CLI, puis dans le dossier `delivcard` :
```bash
az login
az webapp up --runtime PYTHON:3.12 --sku B1 --name delivcard-sveta --location francecentral
```
(`--sku F1` = gratuit. Le nom doit être unique dans tout Azure.)

Azure détecte `app.py` + `app` et lance gunicorn tout seul.
URL : `https://delivcard-sveta.azurewebsites.net`

Mettre à jour après une modification : relancer `az webapp up` (même commande).
Voir les logs : `az webapp log tail --name delivcard-sveta --resource-group <ton-groupe>`

## Carte
Leaflet + OpenStreetMap : gratuit, sans clé API. Coordonnées GPS dans le CSV (fromLat, fromLng, toLat, toLng).
Itinéraire routier + durée réelle via OSRM (gratuit). Heure d’arrivée = maintenant + durée (calculée dans le navigateur, mise à jour toutes les 30 s). Si OSRM ne répond pas : estimation à 25 km/h.

## Note
Le CSV est modifié par le bouton Request. Sur Azure, il sera remis à zéro à chaque
redéploiement. Pour la suite : passer à une base (Azure SQL / Cosmos DB / Table Storage).

## Docker

### Tester en local (Docker Desktop)
```bash
cd C:\python-projs\mini-azure-app
docker compose up --build
```
Ouvrir http://localhost:5000 — arrêter : `Ctrl + C` puis `docker compose down`.

Sans compose :
```bash
docker build -t delivcard .
docker run -p 5000:8000 delivcard
```

### Déployer sur Azure Container Apps (Docker pas obligatoire sur ton PC)
L'image est construite directement dans Azure à partir du Dockerfile.
```bash
az login
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

az containerapp up ^
  --name delivcard ^
  --resource-group delivcard-rg ^
  --location francecentral ^
  --source . ^
  --ingress external ^
  --target-port 8000
```
(Sur PowerShell, remplace `^` par `` ` ``.) À la fin, Azure affiche l'URL : `https://delivcard.<...>.francecentral.azurecontainerapps.io`

Mettre à jour après une modification : relancer la même commande `az containerapp up`.
Voir les logs : `az containerapp logs show -n delivcard -g delivcard-rg --follow`

Coût : Container Apps a une part gratuite chaque mois ; le registre d'images (Azure Container Registry, Basic) coûte quelques euros par mois.
Tout supprimer après le test : `az group delete -n delivcard-rg --yes`
