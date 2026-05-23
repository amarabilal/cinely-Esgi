<template>
  <div class="min-h-screen bg-white">
    <nav class="border-b border-gray-100 px-6 py-4 max-w-4xl mx-auto">
      <router-link to="/" class="text-xl font-bold text-primary-600">Notes</router-link>
    </nav>

    <div class="max-w-3xl mx-auto py-16 px-6 prose prose-gray">
      <h1>Politique de Confidentialité</h1>
      <p class="text-gray-500">Dernière mise à jour : 29 mai 2026</p>

      <h2>1. Responsable du traitement</h2>
      <p>Notes App est responsable du traitement de vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD).</p>

      <h2>2. Données collectées</h2>
      <p>Nous collectons les données suivantes :</p>
      <ul>
        <li><strong>Données de compte</strong> : adresse email, prénom, nom, mot de passe haché (Argon2id)</li>
        <li><strong>Données de contenu</strong> : notes, dossiers, tags créés par l'utilisateur</li>
        <li><strong>Données de session</strong> : tokens d'authentification hashés</li>
        <li><strong>Données d'utilisation</strong> : statistiques d'utilisation anonymisées via Matomo</li>
      </ul>

      <h2>3. Finalités du traitement</h2>
      <p>Vos données sont utilisées pour :</p>
      <ul>
        <li>Fournir et améliorer le Service</li>
        <li>Sécuriser votre compte (authentification, détection de fraude)</li>
        <li>Vous contacter en cas de nécessité (reset mot de passe, vérification email)</li>
        <li>Analyser l'utilisation du Service de façon anonyme</li>
      </ul>

      <h2>4. Conservation des données</h2>
      <p>Vos données sont conservées tant que votre compte est actif. En cas de suppression de compte, vos données sont supprimées sous 30 jours.</p>

      <h2>5. Vos droits</h2>
      <p>Conformément au RGPD, vous disposez des droits suivants :</p>
      <ul>
        <li>Droit d'accès à vos données</li>
        <li>Droit de rectification</li>
        <li>Droit à l'effacement (« droit à l'oubli »)</li>
        <li>Droit à la portabilité</li>
        <li>Droit d'opposition au traitement</li>
      </ul>
      <p>Pour exercer ces droits, contactez-nous via la <router-link to="/contact">page de contact</router-link>.</p>

      <h2>6. Sécurité</h2>
      <p>Nous mettons en œuvre des mesures techniques appropriées pour protéger vos données : chiffrement en transit (HTTPS/TLS), hachage des mots de passe (Argon2id), authentification à deux facteurs, et audit de sécurité régulier.</p>

      <h2>7. Cookies</h2>
      <p>Notre utilisation des cookies est décrite dans notre <router-link to="/legal/cookies">Politique de Cookies</router-link>.</p>

      <h2>8. Transferts hors UE</h2>
      <p>Vos données sont hébergées au sein de l'Union Européenne. Aucun transfert vers des pays tiers n'est effectué.</p>
    </div>
  </div>
</template>
