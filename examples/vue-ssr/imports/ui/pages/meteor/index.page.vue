<template>
  <h1>Meteor SSR</h1>
  <div>
    <h3>Pre-rendered content</h3>
    <ServerContent />
  </div>
  
  <h3>Meteor DDP</h3>
  <ClientContent />
</template>

<script lang="ts" setup>
import ClientContent from '/imports/ui/pages/meteor/DDPExample.vue';
import ServerContent from '/imports/ui/pages/meteor/ServerContent.vue';
</script>