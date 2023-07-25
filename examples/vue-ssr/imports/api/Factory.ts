import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

/**
 * Just a handy helper function for quickly composing new type-safe Meteor methods and publications.
 * You can of course use the traditional Meteor.publish(...) and Meteor.methods(...) approach if you prefer that.
 */
export function CreateService<
    Methods extends Record<string, (...params: any[]) => unknown>,
    Publications extends Record<string, (...params: any[]) => Mongo.Cursor<unknown>>,
    Schema extends object,
    Collection extends Mongo.Collection<any>,
>(service: {
    collection(): Collection;
    publications(collection: Collection): Publications;
    methods(collection: Collection): Methods;
}) {
    const collection = service.collection() as Collection & { _name: string };
    const namespace = collection._name;
    
    const subscribe = {} as {
        [key in keyof Publications]: (...params: Parameters<Publications[key]>) => Meteor.SubscriptionHandle
    };
    const methods = {} as {
        [key in keyof Methods]: (...params: Parameters<Methods[key]>) => ReturnType<Methods[key]>
    };
    
    Object.entries(service.methods(collection)).forEach(([name, handler]: [keyof Methods, any]) => {
        const methodName = `${namespace}.${name.toString()}`
        
        if (Meteor.isServer) {
            Meteor.methods({ [methodName]: handler })
        }
        
        methods[name] = (...params) => Meteor.call(methodName, ...params);
    })
    
    Object.entries(service.publications(collection)).forEach(([name, handler]: [keyof Publications, any]) => {
        const publicationName = `${namespace}.${name.toString()}`
        
        if (Meteor.isServer) {
            Meteor.publish(publicationName, handler);
        }
        
        subscribe[name] = (...params) => Meteor.subscribe(publicationName, ...params);
    });
    
    return {
        methods,
        subscribe,
        collection,
    }
}