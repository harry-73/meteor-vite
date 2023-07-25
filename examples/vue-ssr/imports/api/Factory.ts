
export function CreateService<CollectionSchema>(service: {
    name: string;
    publications<Publications>(collection: Mongo.Collection<CollectionSchema>): Publications;
    methods<Methods extends Record<string, () => unknown>>(collection: Mongo.Collection<CollectionSchema>): Methods;
}) {
    type Publications = ReturnType<typeof service.publications>;
    type Methods = ReturnType<typeof service.methods>;
    
    const collection = new Mongo.Collection<CollectionSchema>(service.name);
    const publications = {} as {
        [key in keyof Publications]: (...params: Parameters<Publications[key]>) => Meteor.SubscriptionHandle
    };
    const methods = {} as {
        [key in keyof Methods]: (...params: Parameters<Methods[key]>) => ReturnType<Methods[key]>
    };
    
    
    Object.entries(service.publications(collection)).forEach(([name, handler]) => {
        const publicationName = `${service.name}.${name}`
        
        if (Meteor.isServer) {
            Meteor.publish(publicationName, handler);
            return;
        }
        
        publications[name] = (...params) => Meteor.subscribe(publicationName, ...params);
    });
    
    if (Meteor.isServer) {
        Meteor.methods(service.methods(collection));
    } else {
        Object.entries(service.methods(collection)).forEach(([name]) => {
            const methodName = `${service.name}.${name}`
            methods[name] = (...params) => Meteor.subscribe(methodName, ...params);
        })
    }
    
    return {
        Methods: methods,
        Collection: collection,
        Subscribe: publications,
    }
}