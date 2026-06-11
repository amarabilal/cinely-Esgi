<script setup lang="ts">
import { RouterLink } from 'vue-router';
import PublicLayout from '@/components/layout/PublicLayout.vue';
</script>

<template>
  <PublicLayout>
    <article class="prose prose-zinc dark:prose-invert mx-auto max-w-3xl px-6 py-12">
      <h1>Politique de Cookies</h1>
      <p class="text-muted-foreground">Dernière mise à jour : 29 mai 2026</p>

      <h2>1. Qu'est-ce qu'un cookie ?</h2>
      <p>Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, smartphone) lors de la visite d'un site web. Il permet de mémoriser des informations entre les visites.</p>

      <h2>2. Cookies que nous utilisons</h2>

      <h3>Cookies strictement nécessaires</h3>
      <p>Ces cookies sont indispensables au fonctionnement du Service et ne peuvent pas être désactivés :</p>
      <div class="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Nom</th><th>Durée</th><th>Finalité</th></tr>
          </thead>
          <tbody>
            <tr><td>refreshToken</td><td>7 jours</td><td>Maintien de la session d'authentification (HttpOnly, Secure)</td></tr>
          </tbody>
        </table>
      </div>

      <h3>Cookies analytiques</h3>
      <p>Ces cookies collectent des informations sur la façon dont vous utilisez notre site. Ils nécessitent votre consentement et peuvent être refusés via la bannière de cookies :</p>
      <div class="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Nom</th><th>Durée</th><th>Finalité</th></tr>
          </thead>
          <tbody>
            <tr><td>_pk_id.*</td><td>13 mois</td><td>Matomo Analytics — identification de l'utilisateur (anonymisé)</td></tr>
            <tr><td>_pk_ses.*</td><td>30 minutes</td><td>Matomo Analytics — session en cours</td></tr>
          </tbody>
        </table>
      </div>

      <h2>3. Gestion de vos préférences</h2>
      <p>Vous pouvez accepter ou refuser les cookies analytiques via la bannière affichée lors de votre première visite. Vous pouvez modifier vos préférences à tout moment depuis le pied de page de l'application.</p>

      <h2>4. Désactivation des cookies</h2>
      <p>Vous pouvez également configurer votre navigateur pour refuser tous les cookies. Cependant, certaines fonctionnalités du Service pourraient ne plus fonctionner correctement.</p>

      <h2>5. Contact</h2>
      <p>Pour toute question relative à notre utilisation des cookies, contactez-nous via la <RouterLink to="/contact">page de contact</RouterLink>.</p>
    </article>
  </PublicLayout>
</template>
