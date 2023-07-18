import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

export const CollectionName = 'chat';
export const Collection = new Mongo.Collection(CollectionName);
export const Methods = {
    send(message: unknown) {
        if (Meteor.isServer) {
            if (typeof message !== 'string') {
                throw new Meteor.Error('Your message needs to be a plain string!');
            }
            return Collection.insert({ message });
        }
        
        Meteor.call(`${CollectionName}.send`, message, (err) => {
            if (err) {
                throw err;
            }
        })
    }
};
export const Publications = {
    'all'() {
        if (Meteor.isServer) {
            return Collection.find();
        }
        
        return Meteor.subscribe(`${CollectionName}.all`);
    }
}

if (Meteor.isServer) {
    Meteor.methods(
        Object.fromEntries(Object.entries(Methods).map(([method, handler]) => [`${CollectionName}.${method}`, handler]))
    )
    Object.entries(Publications).forEach(([name, handler]) => {
        Meteor.publish(name, handler);
    })
}