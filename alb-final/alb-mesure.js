// Compte la visite sans rien déposer sur l'appareil.
// Rien n'est envoyé si le navigateur demande « ne pas me suivre »,
// ni depuis l'appareil de Joce (marqué à l'ouverture de Statistiques).
(function () {
  try {
    var nav = window.navigator || {};
    if (nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.msDoNotTrack === '1' || nav.globalPrivacyControl === true) return;
    try { if (window.localStorage.getItem('alb-pas-compter') === '1') return; } catch (e) {}

    var donnees = JSON.stringify({
      page: window.location.pathname,
      source: document.referrer || '',
      utm: (new URLSearchParams(window.location.search).get('utm_source') || '').slice(0, 40)
    });
    var adresse = '/.netlify/functions/compter-visite';

    if (nav.sendBeacon) {
      nav.sendBeacon(adresse, new Blob([donnees], { type: 'text/plain' }));
    } else if (window.fetch) {
      window.fetch(adresse, { method: 'POST', body: donnees, keepalive: true });
    }
  } catch (e) {}
})();
