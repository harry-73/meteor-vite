import { renderPage } from 'vite-plugin-ssr/server';
import { WebApp } from 'meteor/webapp';
import { Meteor } from 'meteor/meteor'

if (Meteor.isProduction) {
    import '/vite/server/importBuild.cjs';
}

WebApp.connectHandlers.use('/', async (req, res, next) => {
    const pageContextInit = {
        urlOriginal: req.originalUrl
    }
    const pageContext = await renderPage(pageContextInit)
    const { httpResponse } = pageContext
    if (!httpResponse) return next()
    const { body, statusCode, contentType, earlyHints } = httpResponse
    if (res.writeEarlyHints) res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
    res.status(statusCode).type(contentType).send(body)
});
