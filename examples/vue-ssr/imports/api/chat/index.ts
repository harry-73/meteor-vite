import { CreateService } from '/imports/api/Factory';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';

export default CreateService({
    setup() {
        return {
            namespace: 'chat',
            getCollection: (name) => new Mongo.Collection<{
                message: string,
                timestamp: number
            }>(name)
        }
    },
    publications(collection) {
        return {
            all() {
                return collection.find();
            }
        }
    },
    methods(collection) {
        return {
            send(message: unknown): void {
                if (typeof message !== 'string') {
                    throw new Meteor.Error('Your message needs to be a plain string!');
                }
                
                collection.insert({ message, timestamp: Date.now() })
            },
        }
    }
})