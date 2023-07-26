import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

const MeteorReady = new Promise<void>((resolve, reject) => {
    Meteor.startup(() => resolve())
});

const services = new Map<string, Mongo.Collection<any>>();

/**
 * Just a handy helper function for quickly composing new type-safe Meteor methods and publications.
 * You can of course use the traditional Meteor.publish(...) and Meteor.methods(...) approach if you prefer that.
 *
 * You may not want to use this in production as your service code may be included in your client bundle.
 */
export function CreateService<
    Methods extends Record<string, (...params: any[]) => unknown>,
    Publications extends Record<string, (...params: any[]) => Mongo.Cursor<unknown>>,
    Collection extends Mongo.Collection<any>,
>(service: {
    setup(): { namespace: string, getCollection: (name: string) => Collection };
    publications(collection: Collection): Publications;
    methods(collection: Collection): Methods;
}) {
    const { namespace, getCollection } = service.setup();
    const collection = (services.get(namespace) || services.set(namespace, getCollection(namespace)).get(namespace)!) as Collection
    
    const subscribe = {} as {
        [key in keyof Publications]: (...params: Parameters<Publications[key]>) => Promise<Meteor.SubscriptionHandle>
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
        
        subscribe[name] = (...params) => MeteorReady.then(() => Meteor.subscribe(publicationName, ...params));
    });
    
    return {
        methods,
        subscribe,
        collection,
    }
}