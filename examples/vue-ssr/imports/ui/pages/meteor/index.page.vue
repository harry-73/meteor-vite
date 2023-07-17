<template>
  <h1>Meteor SSR</h1>
  <div>
    <h3>Pre-rendered content</h3>
    <ServerContent />
  </div>
  <ClientOnly>
    <h3>Client Only Content</h3>
    <ClientContent />
  </ClientOnly>
</template>

<script lang="ts" setup>
import ClientContent from '/imports/ui/pages/meteor/ClientContent.vue';
import ServerContent from '/imports/ui/pages/meteor/ServerContent.vue';
</script>