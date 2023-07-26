import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { Tracker } from 'meteor/tracker';

const MeteorReady = new Promise<void>((resolve, reject) => {
    Meteor.startup(() => resolve())
});

const ServiceMap = new Map<string, { collection: unknown, subscribe: unknown, methods: unknown }>();

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
    type Result = APIService<Methods, Publications, Collection>;
    const { namespace, getCollection } = service.setup();
    const existingService = ServiceMap.get(namespace) as Result | undefined;
    
    if (existingService) {
        return existingService;
    }
    
    const subscribe = {} as {
        [key in keyof Publications]: (...params: Parameters<Publications[key]>) => Promise<Meteor.SubscriptionHandle>
    };
    const methods = {} as {
        [key in keyof Methods]: (...params: Parameters<Methods[key]>) => ReturnType<Methods[key]>
    };
    
    let collection = ServiceMap.get(namespace)?.collection as Result['collection'] | undefined;
    
    try {
        if (!collection) {
            collection = getCollection(namespace);
        }
    } catch (error: unknown) {
        if (error instanceof Error && error.message.startsWith('There is already a collection')) {
            collection = ServiceMap.get(namespace)?.collection as Result['collection'];
        } else {
            throw error;
        }
    }
    
    ServiceMap.set(namespace, { collection, subscribe, methods });
    
    Object.entries(service.methods(collection)).forEach(([name, handler]: [keyof Methods, any]) => {
        const methodName = `${namespace}.${name.toString()}`
        methods[name] = (...params) => Meteor.call(methodName, ...params);
        
        try {
            if (Meteor.isServer) {
                Meteor.methods({ [methodName]: handler })
            }
        } catch (error) {
            if (error instanceof Error && error.message.startsWith('A method named')) {
                console.warn('Skipping duplicate method declaration', { error });
                return;
            }
            throw error;
        }
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

/**
 * Cross-platform tracker for server-side rendered components.
 * As Meteor doesn't allow trackers to run on the server, we just immediately fire the handler once when Meteor is
 * ready if the current environment is the server. On the client we just run the tracker like normal.
 * @type {{autorun(handler: () => void): (void | any)}}
 */
export const TrackerSSR = {
    autorun: Meteor.isServer
             ? Meteor.bindEnvironment(() => (handler: () => void) => {
                 Promise.await(MeteorReady);
                 return handler();
             })
             : Tracker.autorun
}

type APIService<
    Methods extends Record<string, (...params: any[]) => unknown>,
    Publications extends Record<string, (...params: any[]) => Mongo.Cursor<unknown>>,
    Collection extends Mongo.Collection<any>,
> = {
    collection: Collection;
    methods: {
        [key in keyof Methods]: (...params: Parameters<Methods[key]>) => ReturnType<Methods[key]>
    };
    subscribe: {
        [key in keyof Publications]: (...params: Parameters<Publications[key]>) => Promise<Meteor.SubscriptionHandle>
    }
}