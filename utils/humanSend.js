const MIN_DELAY = 100;
const MAX_DELAY = 1200;

function randomDelay() {
    return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
}

function sendTyping(api, threadID) {
    if (typeof api.sendTyping !== 'function') return;
    try {
        api.sendTyping(threadID);
    } catch (error) {}
}

module.exports = function createHumanSend(api) {
    const originalSendMessage = api.sendMessage.bind(api);

    return function humanSendMessage(message, threadID, callbackOrReplyTo, replyTo) {
        const callback = typeof callbackOrReplyTo === 'function' ? callbackOrReplyTo : null;
        const callbackReplyTo = callback ? replyTo : callbackOrReplyTo;
        const delay = randomDelay();

        sendTyping(api, threadID);

        return setTimeout(() => {
            if (callback) {
                originalSendMessage(message, threadID, callback, callbackReplyTo);
                return;
            }
            originalSendMessage(message, threadID, callbackReplyTo);
        }, delay);
    };
};