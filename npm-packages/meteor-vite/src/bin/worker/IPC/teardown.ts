import CreateIPCInterface from './interface';

const completedHandlers = new Set<number>;
const teardownHandlers: TeardownHandler[] = [];
type TeardownHandler = (event: string) => void;
export function onTeardown(handler: TeardownHandler) {
    let id = teardownHandlers.length;
    
    teardownHandlers.push((event) => {
        if (completedHandlers.has(id)) return;
        completedHandlers.add(id);
        handler(event);
    })
}

function teardownAll(event: string) {
    teardownHandlers.forEach((teardown) => teardown(event))
}

['exit', 'SIGINT', 'SIGHUP', 'SIGTERM'].forEach(event => {
    process.once(event, () => {
        teardownAll(event);
    })
});

export default CreateIPCInterface({
    async 'ipc.teardown'() {
        teardownAll('ipc.teardown');
    }
})