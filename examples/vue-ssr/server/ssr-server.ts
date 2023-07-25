import { renderPage } from 'vite-plugin-ssr/server';
import { WebApp, WebAppInternals } from 'meteor/webapp';
import { Meteor } from 'meteor/meteor'

if (Meteor.isProduction) {
    import '/vite/vite-server/importBuild.cjs';
}

WebAppInternals.registerBoilerplateDataCallback('ssr-server', async (req, data) => {
    const pageContextInit = {
        urlOriginal: req.url.href
    }
    
    console.log('Received request:', { pageContextInit });
    
    const { httpResponse } = await renderPage(pageContextInit)
    
    const { body, statusCode, contentType, earlyHints } = httpResponse
    
    data.dynamicBody = body;
    
});

WebApp.connectHandlers.use('/ssr', async (req, res, next) => {
    console.log(WebApp.clientPrograms['web.browser'])
    const pageContextInit = {
        urlOriginal: req.originalUrl
    }
    
    console.log('Received request:', { pageContextInit,  });
    
    const { httpResponse } = await renderPage(pageContextInit)
    
    if (!httpResponse) {
        return next()
    }
    
    const { body, statusCode, contentType, earlyHints } = httpResponse
    
    if (res.writeEarlyHints) {
        res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
    }
    
    res.setHeader('Content-Type', contentType).writeHead(statusCode).end(body);
});
