import { CreateService } from '/imports/api/Factory';
import { Mongo } from 'meteor/mongo';

interface LinkDocument {
    href: string;
    title: string;
}

export default CreateService({
    setup() {
        return {
            namespace: 'links',
            getCollection: (name) => new Mongo.Collection<LinkDocument>(name),
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
            add(link: LinkDocument) {
                collection.upsert(link, link);
            }
        }
    }
})