const completedHandlers = new Set<number>;
const teardownHandlers: TeardownHandler[] = [];
type TeardownHandler = (event: string) => void;
export function onTeardown(handler: TeardownHandler) {
    teardownHandlers.push(handler);
}

['exit', 'SIGINT', 'SIGHUP', 'SIGTERM'].forEach(event => {
    process.once(event, () => {
        teardownHandlers.forEach((teardown, index) => {
            if (completedHandlers.has(index)) return;
            completedHandlers.add(index);
            teardown(event);
        })
    })
});