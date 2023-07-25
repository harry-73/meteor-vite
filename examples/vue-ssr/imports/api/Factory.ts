/**
 * Just a handy helper function for quickly composing new type-safe Meteor methods and publications.
 * You can of course use the traditional Meteor.publish(...) and Meteor.methods(...) approach if you prefer that.
 */
export function CreateService<CollectionSchema>(service: {
    name: string;
    publications<Publications>(collection: Mongo.Collection<CollectionSchema>): Publications;
    methods<Methods extends Record<string, () => unknown>>(collection: Mongo.Collection<CollectionSchema>): Methods;
}) {
    type Publications = ReturnType<typeof service.publications>;
    type Methods = ReturnType<typeof service.methods>;
    
    const collection = new Mongo.Collection<CollectionSchema>(service.name);
    const subscribe = {} as {
        [key in keyof Publications]: (...params: Parameters<Publications[key]>) => Meteor.SubscriptionHandle
    };
    const methods = {} as {
        [key in keyof Methods]: (...params: Parameters<Methods[key]>) => ReturnType<Methods[key]>
    };
    
    if (Meteor.isServer) {
        Meteor.methods(service.methods(collection));
    }
    
    Object.entries(service.methods(collection)).forEach(([name]) => {
        const methodName = `${service.name}.${name}`
        methods[name] = (...params) => Meteor.call(methodName, ...params);
    })
    
    Object.entries(service.publications(collection)).forEach(([name, handler]) => {
        const publicationName = `${service.name}.${name}`
        
        if (Meteor.isServer) {
            Meteor.publish(publicationName, handler);
        }
        
        subscribe[name] = (...params) => Meteor.subscribe(publicationName, ...params);
    });
    
    return {
        methods,
        collection,
        subscribe,
    }
}