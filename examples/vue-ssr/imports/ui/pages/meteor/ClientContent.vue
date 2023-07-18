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
    <pre>
      <span style="display: block" v-for="{message} in messages">{{ message }}</span>
    </pre>
    <input type="text" v-model="message">
  </form>
</template>

<script lang="ts" setup>
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { Methods, Collection, Publications } from '../../../api/chat/index';
import { ref } from 'vue';
const message = ref('');
const messages = ref([]);
function send() {
    Methods.send(message);
}
Tracker.autorun(() => {
    const sub = Publications.all();
    messages.value = Collection.find().fetch();
})
</script>