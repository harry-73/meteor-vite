<template>
  <div>
    <h5>Meteor Release</h5>
    <pre>{{ Meteor.release }}</pre>
  </div>
  <div>
    <h5>Last session ID</h5>
    <pre>{{ Meteor.connection.lastSessionId }}</pre>
  </div>
  <form @submit.prevent="send">
    <h5>Meteor Chat</h5>
      <div style="display: block; width: 100%; margin-bottom: 0.8rem" v-for="{message, timestamp} in messages">
        <div style="font-size: 0.8rem; margin-bottom: 0.2rem; opacity: 0.5; font-weight: 600; letter-spacing: -0.05rem; text-align: right">{{ formatTimestamp(timestamp) }}</div>
        <div style="font-weight: 600; opacity: 0.8">- {{ message }}</div>
      </div>
    <input type="text" v-model="message">
  </form>
</template>

<script lang="ts" setup>
import { Meteor } from 'meteor/meteor';
import { Methods, Collection, Publications } from '../../../api/chat/index';
import { ref } from 'vue';
const message = ref('');
function send() {
    Methods.send(message.value);
    message.value = '';
}
function formatTimestamp(time: number) {
    const date = new Date(time || 0);
    return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
}
</script>

<script lang="ts">
import { Tracker } from '/.meteor-vite/meteor/tracker/template';
const messages = ref([]);

Tracker.autorun(() => {
    const sub = Publications.all();
    messages.value = Collection.find().fetch();
    console.log(messages.value);
})
</script>