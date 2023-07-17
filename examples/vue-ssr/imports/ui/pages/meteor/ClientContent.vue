<template>
  <div>
    <h5>Meteor Release</h5>
    <pre>{{ Meteor.release }}</pre>
  </div>
  <div>
    <h5>Last session ID</h5>
    <pre>{{ Meteor.connection.lastSessionId }}</pre>
  </div>
</template>

<script lang="ts" setup>
import { Meteor } from 'meteor/meteor';
</script>