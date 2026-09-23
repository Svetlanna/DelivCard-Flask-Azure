'use strict';

// URL de l'API Flask (même domaine => chemin relatif)
var API_URL = '/api/cards';

$(document).ready(function() {

  var animating = false;
  var step1 = 500;
  var step2 = 500;
  var step3 = 500;
  var reqStep1 = 600;
  var reqStep2 = 800;
  var reqClosingStep1 = 500;
  var reqClosingStep2 = 500;
  var $scrollCont = $(".phone__scroll-cont");

  // Carte Leaflet + OpenStreetMap (gratuit, sans clé API)
  function initMap($card) {
    if (typeof L === 'undefined') return;

    var card = angular.element($card[0]).scope().card;
    var color = card.themeColorHex;
    var from = [card.fromLat, card.fromLng];
    var to = [card.toLat, card.toLng];
    var container = $(".card__map__inner", $card)[0];

    // Déjà créée ? On la redimensionne simplement
    var existing = $card.data("leafletMap");
    if (existing) {
      setTimeout(function() { existing.invalidateSize(); existing.fitBounds([from, to], {padding: [40, 40]}); }, reqStep1 + 100);
      return;
    }

    var map = L.map(container, {
      zoomControl: false,
      attributionControl: true
    });
    $card.data("leafletMap", map);

    // Fond de carte OpenStreetMap (style classique, gratuit, sans clé)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    var pin = { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 };
    L.circleMarker(from, pin).addTo(map).bindTooltip('From');
    L.circleMarker(to, pin).addTo(map).bindTooltip('To');

    // Tracé du trajet : vient du backend (/api/cards/<id>/route)
    var line = L.polyline([from, to], { color: color, weight: 3, dashArray: '6 6' }).addTo(map);
    map.fitBounds([from, to], {padding: [40, 40]});

    function drawRoute(route) {
      if (route.geometry && route.geometry.length > 2) {
        line.setLatLngs(route.geometry).setStyle({ dashArray: null });
      }
    }
    if (card.route) drawRoute(card.route);
    else $.getJSON(API_URL + '/' + card.id + '/route').done(drawRoute);

    // La carte s'agrandit pendant l'animation : on recalcule sa taille à la fin
    setTimeout(function() {
      map.invalidateSize();
      map.fitBounds(line.getBounds(), {padding: [40, 40]});
    }, reqStep1 + 100);
  }

  // Envoie la requête au backend Flask et met à jour la carte (Angular)
  function sendRequestToApi($card) {
    var cardId = $card.data("id");
    $.ajax({ url: API_URL + '/' + cardId + '/request', method: 'POST' })
      .done(function(updatedCard) {
        var scope = angular.element($card[0]).scope();
        scope.$apply(function() {
          scope.card.requests = updatedCard.requests;
        });
      })
      .fail(function() {
        console.log("Erreur API pour la carte " + cardId);
      });
  }

  // Compte à rebours "temps restant avant l'arrivée"
  function startCountdown($card) {
    stopCountdown($card);
    var scope = angular.element($card[0]).scope();
    if (!scope.card.route) return;
    var end = Date.now() + scope.card.route.duration_s * 1000;

    function tick() {
      var left = Math.max(0, Math.round((end - Date.now()) / 1000));
      var min = Math.floor(left / 60);
      var sec = left % 60;
      scope.$apply(function() {
        scope.card.countdownText = left > 0
          ? min + ' min ' + (sec < 10 ? '0' : '') + sec + ' sec'
          : 'Arrived!';
      });
      if (left === 0) stopCountdown($card);
    }
    tick();
    $card.data("timer", setInterval(tick, 1000));
  }

  function stopCountdown($card) {
    clearInterval($card.data("timer"));
    $card.removeData("timer");
    var scope = angular.element($card[0]).scope();
    if (scope && scope.card) scope.card.countdownText = null;
  }

  // Ouvrir une carte
  $(document).on("click", ".card:not(.active)", function() {
    if (animating) return;
    animating = true;

    var $card = $(this);
    var scrollTopVal = $card.position().top - 30;
    $card.addClass("flip-step1 active");

    $scrollCont.animate({scrollTop: scrollTopVal}, step1);

    setTimeout(function() {
      $scrollCont.animate({scrollTop: scrollTopVal}, step2);
      $card.addClass("flip-step2");

      setTimeout(function() {
        $scrollCont.animate({scrollTop: scrollTopVal}, step3);
        $card.addClass("flip-step3");

        setTimeout(function() {
          animating = false;
        }, step3);

      }, step2 * 0.5);

    }, step1 * 0.65);
  });

  // Fermer une carte
  $(document).on("click", ".card:not(.req-active1) .card__header__close-btn", function() {
    if (animating) return;
    animating = true;

    var $card = $(this).parents(".card");
    $card.removeClass("flip-step3 active");

    setTimeout(function() {
      $card.removeClass("flip-step2");

      setTimeout(function() {
        $card.removeClass("flip-step1");

        setTimeout(function() {
          animating = false;
        }, step1);

      }, step2 * 0.65);

    }, step3 / 2);
  });

  // Bouton "Request"
  $(document).on("click", ".card:not(.req-active1) .card__request-btn", function() {
    if (animating) return;
    animating = true;

    var $card = $(this).parents(".card");
    var scrollTopVal = $card.position().top - 30;

    $card.addClass("req-active1 map-active");

    initMap($card);
    sendRequestToApi($card);
    startCountdown($card);

    setTimeout(function() {
      $card.addClass("req-active2");
      $scrollCont.animate({scrollTop: scrollTopVal}, reqStep2);

      setTimeout(function() {
        animating = false;
      }, reqStep2);

    }, reqStep1);
  });

  // Fermer le mode "request"
  $(document).on("click",
                 ".card.req-active1 .card__header__close-btn, .card.req-active1 .card__request-btn",
                 function() {
    if (animating) return;
    animating = true;

    var $card = $(this).parents(".card");
    stopCountdown($card);

    $card.addClass("req-closing1");

    setTimeout(function() {
      $card.addClass("req-closing2");

      setTimeout(function() {
        $card.addClass("no-transition hidden-hack");
        $card.css("top");
        $card.removeClass("req-closing2 req-closing1 req-active2 req-active1 map-active flip-step3 flip-step2 flip-step1 active");
        $card.css("top");
        $card.removeClass("no-transition hidden-hack");
        animating = false;
      }, reqClosingStep2);

    }, reqClosingStep1);
  });

});

// Angular : les données viennent du backend Flask (CSV)
var app = angular.module("delivcard", []);
app.controller("DelivCtrl", ['$scope', '$http', '$interval', function($scope, $http, $interval) {
  $scope.cards = [];

  // Calcule l'heure d'arrivée réelle = maintenant + durée du trajet
  function updateEta(card) {
    if (!card.route) return;
    var now = new Date();
    var arrival = new Date(now.getTime() + card.route.duration_s * 1000);
    var tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);

    card.delivTime = arrival.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    card.delivDate = arrival.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    card.delivDateNoun = arrival.toDateString() === now.toDateString() ? 'Today'
                       : arrival.toDateString() === tomorrow.toDateString() ? 'Tomorrow'
                       : arrival.toLocaleDateString('en-US', { weekday: 'long' });
    card.distanceKm = (card.route.distance_m / 1000).toFixed(1);
    card.durationText = Math.max(1, Math.round(card.route.duration_s / 60)) + ' min';
  }

  var routeCache = {};                // trajets déjà reçus (par id de carte)
  $scope.filter = { region: 'Occitanie' };   // région par défaut
  $scope.regions = [];
  $scope.totalCount = 0;
  $scope.loaded = false;

  // Liste des régions pour le menu déroulant
  $http.get('/api/regions').then(function(res) {
    $scope.regions = res.data;
    $scope.totalCount = res.data.reduce(function(sum, r) { return sum + r.count; }, 0);
  });

  // Charge les cartes (toutes, ou d'une seule région)
  $scope.loadCards = function() {
    var params = $scope.filter.region ? { region: $scope.filter.region } : {};
    $http.get(API_URL, { params: params }).then(function(response) {
      $scope.cards = response.data;
      $scope.loaded = true;

      // Pour chaque carte, on demande le trajet réel au backend (une seule fois)
      $scope.cards.forEach(function(card) {
        if (routeCache[card.id]) {
          card.route = routeCache[card.id];
          updateEta(card);
          return;
        }
        $http.get(API_URL + '/' + card.id + '/route').then(function(res) {
          routeCache[card.id] = res.data;
          card.route = res.data;
          updateEta(card);
        });
      });
    }, function(error) {
      console.log("Impossible de charger les cartes", error);
    });
  };

  $scope.loadCards();

  // L'heure d'arrivée avance avec le temps : mise à jour toutes les 30 s
  $interval(function() {
    $scope.cards.forEach(updateEta);
  }, 30000);
}]);
